import { createClient } from 'npm:@supabase/supabase-js@2';
import { STORAGE_ENTITY_CONFIG, buildObjectKey, sanitizeFileName } from '../_shared/storagePolicy.ts';
import {
  enqueueLocalAiJob,
  isUuid,
  localAiHttpState,
  readLocalAiJob,
} from '../_shared/localAiQueue.ts';
import { converseText } from '../_shared/bedrockConverse.ts';
import { callDocumentWorker } from '../_shared/crmDocumentAutomation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing_auth' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { eventId, options, jobId, requestId } = body;

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (jobId !== undefined) {
      return await handleLocalAnalyticsPoll(
        req,
        adminSupabase,
        authData.user.id,
        typeof jobId === 'string' ? jobId : ''
      );
    }

    if (!eventId || !isUuid(requestId)) {
      return new Response(JSON.stringify({ error: 'missing_event_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch Event metadata & Tenant info
    const { data: event, error: eventErr } = await adminSupabase
      .from('events')
      .select('*, tenant:platform_tenants(id, name, branding, logo_file_id)')
      .eq('id', eventId)
      .maybeSingle();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: 'event_not_found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenant = event.tenant;
    const logoUrl = tenant?.branding?.logo_url || null;
    const { data: membership } = await adminSupabase
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('tenant_id', event.tenant_id)
      .eq('user_id', authData.user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch Guests analytics
    const { data: guests, error: guestsErr } = await adminSupabase
      .from('event_guests')
      .select('id, confirmed, checked_in_at, companion_names')
      .eq('event_id', eventId);

    if (guestsErr) throw guestsErr;

    const totalGuestsCount = guests.length;
    const confirmedCount = guests.filter((g: any) => g.confirmed).length;
    const checkedInCount = guests.filter((g: any) => g.checked_in_at !== null).length;
    const absentCount = Math.max(0, confirmedCount - checkedInCount);

    // 3. Fetch Financial analytics
    const { data: expenses, error: expensesErr } = await adminSupabase
      .from('event_expenses')
      .select('id, name, value')
      .eq('event_id', eventId);

    if (expensesErr) throw expensesErr;

    const { data: payments, error: paymentsErr } = await adminSupabase
      .from('expense_payments')
      .select('amount')
      .eq('event_id', eventId);

    if (paymentsErr) throw paymentsErr;

    const totalExpenses = expenses.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
    const totalPayments = payments.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
    const pendingPayment = Math.max(0, totalExpenses - totalPayments);

    // 4. Fetch Guestbook recados (if enabled in options)
    let guestbookMessages: any[] = [];
    if (options?.includeGuestbook) {
      const { data: messages, error: msgErr } = await adminSupabase
        .from('event_couple_updates')
        .select('author_name, message, created_at')
        .eq('event_id', eventId)
        .eq('author_role', 'guest')
        .eq('kind', 'celebration')
        .order('created_at', { ascending: true });

      if (!msgErr && messages) {
        guestbookMessages = messages;
      }
    }

    const queuedJobId = await enqueueLocalAiJob(adminSupabase, {
      tenantId: event.tenant_id,
      kind: 'event.analytics',
      requestId,
      input: {
        event: {
          id: event.id,
          name: event.name,
          event_date: event.event_date,
          location: event.location,
          logo_url: logoUrl,
          owner_user_id: event.user_id || authData.user.id,
        },
        metrics: {
          planned: event.guests_planned || 0,
          confirmed: confirmedCount,
          checked_in: checkedInCount,
          absent: absentCount,
          budget: event.budget_total || 0,
          total_expenses: totalExpenses,
          total_payments: totalPayments,
          pending_payment: pendingPayment,
          guestbook_messages: guestbookMessages,
        },
        report_options: {
          includeFinancials: options?.includeFinancials === true,
          includeCheckin: options?.includeCheckin === true,
          includeGuestbook: options?.includeGuestbook === true,
        },
      },
      priority: 3,
    });
    return new Response(
      JSON.stringify({ jobId: queuedJobId, status: 'pending' }),
      {
        status: 202,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      }
    );

    const metricsText = `
Resumo do Evento: ${event.name}
Data: ${event.event_date ? new Date(event.event_date).toLocaleDateString('pt-BR') : 'Não definida'}
Local: ${event.location || 'Não definido'}

Métricas de Convidados:
- Planejado: ${event.guests_planned || 0} convidados
- Confirmados no RSVP: ${confirmedCount} convidados
- Presença Confirmada (Bipados): ${checkedInCount} convidados
- Faltantes (No-Show): ${absentCount} convidados

Métricas Financeiras:
- Orçamento Planejado (Budget Inicial): R$ ${(event.budget_total || 0).toLocaleString('pt-BR')}
- Custo Efetivo Contratado: R$ ${totalExpenses.toLocaleString('pt-BR')}
- Total Pago aos Fornecedores: R$ ${totalPayments.toLocaleString('pt-BR')}
- Saldo de Pagamentos Pendentes: R$ ${pendingPayment.toLocaleString('pt-BR')}

Recados dos Convidados (Mural):
${guestbookMessages.length > 0
  ? guestbookMessages.map((m: any) => `- ${m.author_name || 'Convidado'}: "${m.message}"`).join('\n')
  : 'Nenhum recado cadastrado.'}
    `;

    const prompt = `Você é a Plan IA. Com base nas métricas consolidadas do evento abaixo, gere um Relatório Executivo Pós-Evento extremamente sofisticado, poético e elegante para o casal e a assessoria de eventos.
O tom deve ser de comemoração, alta costura e celebração de sucesso.
Divida o documento estritamente nas seguintes seções:
1. Resumo Executivo (Uma introdução poética e sofisticada celebrando o dia especial)
2. Análise de Comparecimento e Presença Real
3. Gestão Financeira e Conquistas de Budget
4. Destaques dos Recados dos Convidados (se houver recados, faça uma síntese emocionante; senão, fale sobre os votos de felicidade)

Métricas e dados do evento:
"""
${metricsText}
"""

Retorne apenas o Markdown limpo do relatório executivo pós-evento.`;

    const summaryMarkdown = await converseText({
      modelProfile: 'structured',
      system: 'Você é a Plan IA, a assistente oficial do Painel Prime e assessora virtual de casamentos e eventos.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.35,
    });

    // 6. Format to HTML with premium layout and logo
    const htmlContent = generateAnalyticsHtml({
      eventTitle: event.name,
      logoUrl,
      markdown: summaryMarkdown,
      dateStr: event.event_date ? new Date(event.event_date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      metrics: {
        planned: event.guests_planned || 0,
        confirmed: confirmedCount,
        checkedIn: checkedInCount,
        absent: absentCount,
        budget: event.budget_total || 0,
        totalExpenses,
        totalPayments,
        pendingPayment,
      },
      options,
    });

    // 7. Invoke PDF rendering worker
    const fileId = crypto.randomUUID();
    const safeTitle = sanitizeFileName(`Relatorio_Executivo_${event.name}`);
    const fileName = `${safeTitle}.pdf`;
    
    // Resolve ownerUserId fallback if needed
    const ownerUserId = event.user_id || authData.user!.id;
    const objectKey = buildObjectKey(ownerUserId, 'event_document', fileId, fileName);

    const rendered = await callDocumentWorker({
      endpoint: '/documents/render-pdf',
      html: htmlContent,
      objectKey,
      title: `Relatório Executivo - ${event.name}`,
      metadata: { eventId: event.id },
    });

    const bucket = rendered.bucket || Deno.env.get('R2_BUCKET_PRIVATE') || 'painelpro-private';

    // 8. Insert stored file record (entity_type = 'event_document')
    const { error: storeErr } = await adminSupabase.from('stored_files').insert({
      id: fileId,
      owner_user_id: ownerUserId,
      entity_type: 'event_document',
      entity_id: event.id,
      provider: 'cloudflare_r2',
      bucket,
      object_key: rendered.objectKey || objectKey,
      original_name: fileName,
      content_type: 'application/pdf',
      byte_size: rendered.byteSize || 0,
      visibility: 'private',
      status: 'ready',
      uploaded_at: new Date().toISOString(),
    });
    if (storeErr) throw storeErr;

    // 9. Save as a document record in event_documents if the table exists
    try {
      await adminSupabase.from('event_documents').insert({
        event_id: event.id,
        name: `Relatório Executivo Wedding Analytics - ${event.name}`,
        file_id: fileId,
        created_by: ownerUserId,
      });
    } catch (dbDocErr) {
      console.warn('Failed to insert into event_documents fallback:', dbDocErr);
    }

    return new Response(JSON.stringify({ success: true, fileId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleLocalAnalyticsPoll(
  request: Request,
  adminSupabase: any,
  userId: string,
  jobId: string
) {
  if (!isUuid(jobId)) {
    return new Response(JSON.stringify({ error: 'job_not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: memberships, error: membershipError } = await adminSupabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', userId);
  if (membershipError) throw membershipError;

  let job = null;
  for (const membership of memberships ?? []) {
    job = await readLocalAiJob(adminSupabase, {
      jobId,
      tenantId: membership.tenant_id,
      kind: 'event.analytics',
    });
    if (job) break;
  }
  if (!job) {
    return new Response(JSON.stringify({ error: 'job_not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const state = localAiHttpState(job);
  if (state.state !== 'completed') {
    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: state.state,
        error: state.state === 'failed' ? job.error_code : undefined,
      }),
      {
        status: state.httpStatus,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const { data: existingFile } = await adminSupabase
    .from('stored_files')
    .select('id,status')
    .eq('id', job.id)
    .eq('entity_type', 'event_document')
    .maybeSingle();
  if (existingFile?.status === 'ready') {
    return new Response(
      JSON.stringify({ success: true, status: 'completed', fileId: job.id }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const event = job.input.event as Record<string, unknown> | undefined;
  const metrics = job.input.metrics as Record<string, unknown> | undefined;
  const reportOptions = job.input.report_options as
    | Record<string, unknown>
    | undefined;
  const markdown = job.output?.markdown;
  if (
    !event ||
    !metrics ||
    typeof markdown !== 'string' ||
    !markdown.trim() ||
    !isUuid(event.id) ||
    !isUuid(event.owner_user_id)
  ) {
    throw new Error('local_analytics_output_invalid');
  }

  const htmlContent = generateAnalyticsHtml({
    eventTitle: String(event.name || 'Evento'),
    logoUrl: typeof event.logo_url === 'string' ? event.logo_url : null,
    markdown,
    dateStr: event.event_date
      ? new Date(String(event.event_date)).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR'),
    metrics: {
      planned: Number(metrics.planned) || 0,
      confirmed: Number(metrics.confirmed) || 0,
      checkedIn: Number(metrics.checked_in) || 0,
      absent: Number(metrics.absent) || 0,
      budget: Number(metrics.budget) || 0,
      totalExpenses: Number(metrics.total_expenses) || 0,
      totalPayments: Number(metrics.total_payments) || 0,
      pendingPayment: Number(metrics.pending_payment) || 0,
    },
    options: {
      includeFinancials: reportOptions?.includeFinancials === true,
      includeCheckin: reportOptions?.includeCheckin === true,
    },
  });

  const fileName = `${sanitizeFileName(
    `Relatorio_Executivo_${String(event.name || 'Evento')}`
  )}.pdf`;
  const objectKey = buildObjectKey(
    String(event.owner_user_id),
    'event_document',
    job.id,
    fileName
  );
  const rendered = await callDocumentWorker({
    endpoint: '/documents/render-pdf',
    html: htmlContent,
    objectKey,
    title: `Relatório Executivo - ${String(event.name || 'Evento')}`,
    metadata: { eventId: event.id, localAiJobId: job.id },
  });
  const bucket =
    rendered.bucket || Deno.env.get('R2_BUCKET_PRIVATE') || 'painelpro-private';

  const { error: storeError } = await adminSupabase.from('stored_files').insert({
    id: job.id,
    owner_user_id: event.owner_user_id,
    entity_type: 'event_document',
    entity_id: event.id,
    provider: 'cloudflare_r2',
    bucket,
    object_key: rendered.objectKey || objectKey,
    original_name: fileName,
    content_type: 'application/pdf',
    byte_size: rendered.byteSize || 0,
    visibility: 'private',
    status: 'ready',
    metadata: { local_ai_job_id: job.id },
    uploaded_at: new Date().toISOString(),
  });
  if (storeError && storeError.code !== '23505') throw storeError;

  await adminSupabase.from('event_documents').insert({
    event_id: event.id,
    name: `Relatório Executivo Wedding Analytics - ${String(event.name || 'Evento')}`,
    file_id: job.id,
    created_by: event.owner_user_id,
  });

  return new Response(
    JSON.stringify({ success: true, status: 'completed', fileId: job.id }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
  );
}

function generateAnalyticsHtml(params: {
  eventTitle: string;
  logoUrl: string | null;
  markdown: string;
  dateStr: string;
  metrics: {
    planned: number;
    confirmed: number;
    checkedIn: number;
    absent: number;
    budget: number;
    totalExpenses: number;
    totalPayments: number;
    pendingPayment: number;
  };
  options: {
    includeFinancials: boolean;
    includeCheckin: boolean;
  };
}) {
  let bodyHtml = params.markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  bodyHtml = bodyHtml.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
  bodyHtml = bodyHtml.split('\n\n').map(p => {
    if (p.trim().startsWith('<h') || p.trim().startsWith('<ul')) return p;
    return `<p>${p}</p>`;
  }).join('\n');

  const logoImg = params.logoUrl
    ? `<div class="logo-container"><img src="${params.logoUrl}" alt="Logo" class="logo-image" /></div>`
    : '';

  const rsvpRate = params.metrics.planned > 0
    ? ((params.metrics.confirmed / params.metrics.planned) * 100).toFixed(1)
    : '0';
  const attendanceRate = params.metrics.confirmed > 0
    ? ((params.metrics.checkedIn / params.metrics.confirmed) * 100).toFixed(1)
    : '0';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap');
        
        @page {
          size: A4;
          margin: 3cm 2.5cm 3cm 2.5cm;
          @bottom-center {
            content: "Wedding Analytics • Página " counter(page);
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 8px;
            color: #8c8c8c;
          }
        }
        
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #2b2b2b;
          margin: 0;
        }

        .logo-container {
          text-align: center;
          margin-bottom: 2em;
        }

        .logo-image {
          max-height: 80px;
          max-width: 250px;
          object-fit: contain;
        }

        h1, h2, h3 {
          font-family: 'Playfair Display', serif;
          color: #1a1a1a;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }

        h1 {
          font-size: 26pt;
          border-bottom: 1px double #c5a880;
          padding-bottom: 0.2em;
          text-align: center;
          margin-top: 0;
        }

        h2 {
          font-size: 15pt;
          border-bottom: 1px solid #e5dcd0;
          padding-bottom: 0.3em;
          color: #8c6f48;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        h3 {
          font-size: 12pt;
          font-weight: bold;
        }

        p {
          margin-top: 0;
          margin-bottom: 1em;
          text-align: justify;
        }

        ul {
          margin-top: 0;
          margin-bottom: 1.2em;
          padding-left: 1.5em;
        }

        li {
          margin-bottom: 0.4em;
        }

        .meta-box {
          border: 1px solid #e5dcd0;
          background-color: #faf8f5;
          padding: 1.2em;
          margin-bottom: 2em;
          display: flex;
          justify-content: space-between;
          font-size: 10pt;
        }

        .meta-item {
          margin-bottom: 0.3em;
        }

        .meta-label {
          font-weight: 600;
          color: #8c6f48;
        }

        .metrics-grid {
          display: grid;
          grid-template-cols: repeat(2, 1fr);
          gap: 1.5em;
          margin-bottom: 2em;
        }

        .metric-card {
          border: 1px solid #e5dcd0;
          border-radius: 12px;
          padding: 1.2em;
          background-color: #faf8f5;
          text-align: center;
        }

        .metric-title {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #8c8c8c;
          margin-bottom: 0.5em;
        }

        .metric-value {
          font-family: 'Playfair Display', serif;
          font-size: 22pt;
          font-weight: bold;
          color: #8c6f48;
        }

        .metric-sub {
          font-size: 8.5pt;
          color: #5c5c5c;
          margin-top: 0.3em;
        }

        .footer-sig {
          margin-top: 4em;
          border-top: 1px solid #e5dcd0;
          padding-top: 1em;
          text-align: center;
          font-size: 9pt;
          color: #8c8c8c;
          font-family: 'Playfair Display', serif;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      ${logoImg}
      
      <h1>Relatório Executivo Pós-Evento</h1>
      
      <div class="meta-box">
        <div>
          <div class="meta-item"><span class="meta-label">Evento:</span> ${params.eventTitle}</div>
          <div class="meta-item"><span class="meta-label">Data:</span> ${params.dateStr}</div>
        </div>
        <div style="text-align: right;">
          <div class="meta-item"><span class="meta-label">Métricas:</span> Wedding Analytics</div>
          <div class="meta-item"><span class="meta-label">Gerado por:</span> Plan IA</div>
        </div>
      </div>

      <div class="metrics-grid">
        ${params.options.includeCheckin ? `
          <div class="metric-card">
            <div class="metric-title">Adesão ao RSVP</div>
            <div class="metric-value">${rsvpRate}%</div>
            <div class="metric-sub">${params.metrics.confirmed} de ${params.metrics.planned} convidados confirmados</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Presença Real (QR Code)</div>
            <div class="metric-value">${attendanceRate}%</div>
            <div class="metric-sub">${params.metrics.checkedIn} convidados bipados na entrada (No-Show: ${params.metrics.absent})</div>
          </div>
        ` : ''}
        
        ${params.options.includeFinancials ? `
          <div class="metric-card">
            <div class="metric-title">Custo Efetivo Contratado</div>
            <div class="metric-value">R$ ${params.metrics.totalExpenses.toLocaleString('pt-BR')}</div>
            <div class="metric-sub">Orçamento Inicial: R$ ${params.metrics.budget.toLocaleString('pt-BR')}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Demonstrativo de Quitação</div>
            <div class="metric-value">R$ ${params.metrics.totalPayments.toLocaleString('pt-BR')}</div>
            <div class="metric-sub">Pago (Pendente: R$ ${params.metrics.pendingPayment.toLocaleString('pt-BR')})</div>
          </div>
        ` : ''}
      </div>

      <div class="content">
        ${bodyHtml}
      </div>

      <div class="footer-sig">
        Documento analítico gerado eletronicamente pela Plan IA.
      </div>
    </body>
    </html>
  `;
}
