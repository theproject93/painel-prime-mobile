import { createClient } from 'npm:@supabase/supabase-js@2';
import { createDownloadUrl, createR2Config, deleteObject, getObjectBytes, putObject } from './storageR2.ts';
import { convertOnlyOfficeHtmlToPdf } from './onlyofficeConversion.ts';
import {
  STORAGE_ENTITY_CONFIG,
  buildObjectKey,
  sanitizeFileName,
} from './storagePolicy.ts';
import {
  createDefaultDocumentTemplatePayload,
  normalizeDocumentTemplatePayload,
  renderDocumentTemplateHtml,
  toTemplateKind,
} from './crmDocumentTemplates.ts';

type ServiceClient = any;

export type DocumentType = 'budget' | 'contract';

export interface TenantBranding {
  app_name?: string;
  logo_url?: string;
}

interface DocumentTemplateRef {
  id: string;
  tenant_id: string;
  document_kind: string;
  name: string;
  logo_url: string;
}

interface DocumentTemplateVersionRef {
  id: string;
  rendered_html?: string | null;
  editor_payload?: unknown;
}

export interface DocumentVariables {
  nome_cliente: string;
  email_cliente: string;
  telefone_cliente: string;
  cpf_cliente: string;
  tipo_evento: string;
  data_evento: string;
  valor_total: string;
  escopo_servico: string;
  condicoes_pagamento: string;
  condicoes_cancelamento: string;
  foro: string;
  notas: string;
  nome_assessoria: string;
  logo_url: string;
  conteudo_documento?: string;
}

export const crmDocumentCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...crmDocumentCorsHeaders, 'Content-Type': 'application/json' },
  });
}

export function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readEnv(name: string) {
  return Deno.env.get(name)?.trim() ?? '';
}

export function requireEnv() {
  const supabaseUrl = readEnv('SUPABASE_URL');
  const supabaseAnonKey = readEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('server_misconfigured');
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

export function createServiceClient() {
  const { supabaseUrl, serviceRoleKey } = requireEnv();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAuthenticatedContext(request: Request) {
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = requireEnv();
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return { ok: false as const, response: jsonResponse(401, { error: 'missing_authorization' }) };
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return { ok: false as const, response: jsonResponse(401, { error: 'unauthorized' }) };
  }

  const { data: tenantId } = await serviceClient.rpc('resolve_primary_tenant_id', {
    p_user_id: data.user.id,
  });

  return {
    ok: true as const,
    context: {
      actor: {
        id: data.user.id as string,
        email: data.user.email ?? null,
        name:
          typeof data.user.user_metadata?.name === 'string'
            ? data.user.user_metadata.name
            : typeof data.user.user_metadata?.full_name === 'string'
              ? data.user.user_metadata.full_name
              : null,
      },
      serviceClient,
      userClient,
      tenantId: typeof tenantId === 'string' ? tenantId : null,
      appBaseUrl: resolveAppBaseUrl(request),
    },
  };
}

export function resolveAppBaseUrl(request: Request) {
  const configured = readEnv('PUBLIC_APP_URL') || readEnv('SITE_URL') || readEnv('APP_BASE_URL');
  if (configured) return configured.replace(/\/$/, '');

  const origin = request.headers.get('origin')?.trim();
  if (origin) return origin.replace(/\/$/, '');

  const referer = request.headers.get('referer')?.trim();
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      return referer.replace(/\/$/, '');
    }
  }

  return 'http://localhost:3000';
}

export function getRequestIp(request: Request) {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0],
    request.headers.get('x-real-ip'),
  ];
  return candidates.map((value) => value?.trim()).find(Boolean) ?? '0.0.0.0';
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

function randomTokenBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function createPublicToken() {
  const bytes = randomTokenBytes();
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function normalizeCpf(value: unknown) {
  return textValue(value).replace(/\D/g, '');
}

export function isValidCpf(value: unknown) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map((digit) => Number(digit));
  const check = (size: number) => {
    const sum = digits
      .slice(0, size)
      .reduce((acc, digit, index) => acc + digit * (size + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9) === digits[9] && check(10) === digits[10];
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function interpolateDocumentHtml(
  template: string,
  variables: DocumentVariables,
  options?: { rawKeys?: string[] }
) {
  const rawKeys = new Set(options?.rawKeys ?? []);
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawKey: string) => {
    const key = normalizeTemplateVariableKey(rawKey);
    const value = variables[key as keyof DocumentVariables];
    return rawKeys.has(key) ? String(value ?? '') : escapeHtml(value ?? '');
  });
}

function normalizeTemplateVariableKey(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function defaultDocumentHtml(type: DocumentType) {
  return renderDocumentTemplateHtml(
    createDefaultDocumentTemplatePayload(type === 'budget' ? 'quote' : 'contract')
  );
}

export function wrapPrintableHtml(params: {
  title: string;
  bodyHtml: string;
  logoUrl?: string | null;
  sealHtml?: string;
}) {
  const logoImg = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="" class="document-logo" />`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.title)}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 22mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; background: #ffffff; letter-spacing: 0; }
    h1 { margin: 0; font-size: 29px; line-height: 1.14; color: #111827; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 14px; line-height: 1.25; color: #111827; page-break-after: avoid; letter-spacing: 0; }
    p { margin: 0 0 9px; }
    ul, ol { margin: 0 0 10px 18px; padding: 0; }
    li { margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    th, td { border: 1px solid #d8dee8; padding: 8px; text-align: left; vertical-align: top; }
    .document-template { --document-accent: #7c3aed; --document-soft: #f6f3ff; --document-border: #d8dee8; color: #111827; }
    .document-margin-compact { --document-gap: 12px; }
    .document-margin-standard { --document-gap: 16px; }
    .document-margin-wide { --document-gap: 20px; }
    .document-cover { margin-bottom: 22px; padding: 0 0 18px; border-bottom: 3px solid var(--document-accent); page-break-after: avoid; }
    .document-logo { display: inline-block; max-height: 90px; max-width: 260px; object-fit: contain; margin-bottom: 18px; }
    .document-kicker { margin: 0 0 6px; color: var(--document-accent); font-size: 10px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    .document-subtitle { margin: 8px 0 0; max-width: 560px; color: #475569; font-size: 12px; }
    .document-hero-grid,
    .document-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 14px 0 12px; text-align: left; }
    .document-hero-grid div,
    .document-summary div { border: 1px solid var(--document-border); border-radius: 7px; padding: 9px 11px; background: #f8fafc; break-inside: avoid; }
    .document-hero-grid dt,
    .document-summary dt { margin: 0 0 3px; color: #64748b; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
    .document-hero-grid dd,
    .document-summary dd { margin: 0; color: #111827; font-weight: 700; }
    .document-block { page-break-inside: avoid; margin-top: var(--document-gap); padding-top: 2px; }
    .document-block h2 { padding: 8px 10px; border-left: 4px solid var(--document-accent); background: #f8fafc; border-radius: 0 7px 7px 0; }
    .document-block p,
    .document-block li { color: #1f2937; }
    .document-block-investment .document-summary div { background: var(--document-soft); border-color: #c4b5fd; }
    .document-footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--document-border); color: #64748b; font-size: 10.5px; page-break-inside: avoid; }
    .signature-panel { margin-top: 34px; page-break-inside: avoid; }
    .signature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: end; }
    .signature-box { min-height: 92px; padding-top: 18px; }
    .signature-name { min-height: 32px; font-family: "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive; font-size: 27px; line-height: 1; color: #111827; text-align: center; }
    .signature-line { border-top: 1px solid #111827; margin-top: 6px; padding-top: 6px; text-align: center; font-size: 10.5px; color: #475569; }
    .signature-meta { margin-top: 6px; color: #64748b; font-size: 9.5px; text-align: center; }
    .signature-pending { color: #94a3b8; font-size: 11px; text-align: center; }
    .seal { margin-top: 32px; padding: 16px 18px; border: 1px solid var(--document-border); background: #f8fafc; font-size: 10.5px; page-break-inside: avoid; border-radius: 8px; }
    .hash { word-break: break-all; font-family: "Courier New", monospace; }
  </style>
</head>
<body>
${params.bodyHtml.replace('{{logo_img}}', logoImg)}
${params.sealHtml ?? ''}
</body>
</html>`;
}

export async function loadClientContext(params: {
  serviceClient: ServiceClient;
  clientId: string;
  userId: string;
}) {
  const { data: client, error } = await params.serviceClient
    .from('crm_clients')
    .select(
      'id,user_id,tenant_id,name,email,phone,stage,event_type,event_date_expected,budget_expected,notes'
    )
    .eq('id', params.clientId)
    .maybeSingle();

  if (error) throw error;
  if (!client) throw new Error('client_not_found');

  const isOwner = client.user_id === params.userId;
  const tenantId = typeof client.tenant_id === 'string' ? client.tenant_id : null;
  let hasMembership = false;
  if (!isOwner && tenantId) {
    const { data } = await params.serviceClient.rpc('user_has_tenant_membership', {
      p_tenant_id: tenantId,
      p_user_id: params.userId,
    });
    hasMembership = data === true;
  }

  if (!isOwner && !hasMembership) throw new Error('client_forbidden');

  const [{ data: contractData }, { data: people }, { data: tenant }] = await Promise.all([
    params.serviceClient
      .from('crm_contract_data')
      .select('total_value,currency,service_scope,payment_terms,cancellation_terms,foro_city,notes')
      .eq('client_id', params.clientId)
      .maybeSingle(),
    params.serviceClient
      .from('crm_client_people')
      .select('role_label,full_name,email,phone,cpf,rg,birth_date,nationality,civil_status,profession')
      .eq('client_id', params.clientId)
      .order('created_at', { ascending: true }),
    tenantId
      ? params.serviceClient
          .from('platform_tenants')
          .select('id,name,branding,logo_file_id')
          .eq('id', tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    client,
    contractData: contractData ?? null,
    people: people ?? [],
    tenant: tenant ?? null,
    tenantId,
  };
}

function formatCurrency(value: unknown, currency = 'BRL') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(number);
}

export function buildDocumentVariables(context: Awaited<ReturnType<typeof loadClientContext>>): DocumentVariables {
  const branding =
    context.tenant?.branding && typeof context.tenant.branding === 'object'
      ? (context.tenant.branding as TenantBranding)
      : {};
  const principal = Array.isArray(context.people) ? context.people[0] : null;
  const currency = textValue(context.contractData?.currency) || 'BRL';
  const value =
    context.contractData?.total_value ?? context.client.budget_expected ?? null;

  return {
    nome_cliente: context.client.name,
    email_cliente: context.client.email ?? principal?.email ?? '',
    telefone_cliente: context.client.phone ?? principal?.phone ?? '',
    cpf_cliente: principal?.cpf ?? '',
    tipo_evento: context.client.event_type ?? '',
    data_evento: context.client.event_date_expected ?? '',
    valor_total: formatCurrency(value, currency),
    escopo_servico: context.contractData?.service_scope ?? '',
    condicoes_pagamento: context.contractData?.payment_terms ?? '',
    condicoes_cancelamento: context.contractData?.cancellation_terms ?? '',
    foro: context.contractData?.foro_city ?? '',
    notas: context.contractData?.notes ?? context.client.notes ?? '',
    nome_assessoria: textValue(branding.app_name) || context.tenant?.name || 'Painel Prime',
    logo_url: textValue(branding.logo_url),
  };
}

export async function loadTemplateHtml(params: {
  serviceClient: ServiceClient;
  tenantId: string | null;
  documentType: DocumentType;
  templateVersionId?: string | null;
}) {
  const kind = toTemplateKind(params.documentType);

  if (params.templateVersionId) {
    const { data, error } = await params.serviceClient
      .from('document_template_versions')
      .select('id,rendered_html,editor_payload,template:document_templates(id,tenant_id,document_kind,name,logo_url)')
      .eq('id', params.templateVersionId)
      .maybeSingle();
    if (error) throw error;
    if (data?.rendered_html || data?.editor_payload) {
      const payload = normalizeDocumentTemplatePayload(
        kind,
        data.editor_payload,
        data.rendered_html
      );
      return {
        versionId: data.id as string,
        html:
          payload.format === 'visual_blocks'
            ? renderDocumentTemplateHtml(payload)
            : (data.rendered_html as string),
        logoUrl:
          payload.style.headerImageUrl ||
          textValue((data.template as DocumentTemplateRef | null)?.logo_url),
      };
    }
  }

  if (params.tenantId) {
    const { data, error } = await params.serviceClient
      .from('document_templates')
      .select('id,current_version_id,logo_url,current_version:document_template_versions!document_templates_current_version_id_fkey(id,rendered_html,editor_payload)')
      .eq('tenant_id', params.tenantId)
      .eq('document_kind', kind)
      .eq('is_default', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const currentVersion = data?.current_version as DocumentTemplateVersionRef | null;
    if (currentVersion?.rendered_html || currentVersion?.editor_payload) {
      const payload = normalizeDocumentTemplatePayload(
        kind,
        currentVersion.editor_payload,
        currentVersion.rendered_html as string | null
      );
      return {
        versionId: textValue(currentVersion.id),
        html:
          payload.format === 'visual_blocks'
            ? renderDocumentTemplateHtml(payload)
            : (currentVersion.rendered_html as string),
        logoUrl: payload.style.headerImageUrl || textValue(data?.logo_url),
      };
    }
  }

  return {
    versionId: null,
    html: defaultDocumentHtml(params.documentType),
    logoUrl: '',
  };
}

export async function callDocumentWorker(
  params: {
    endpoint: '/documents/render-pdf' | '/documents/seal-pdf';
    html: string;
    objectKey: string;
    title: string;
    metadata?: Record<string, unknown>;
  },
  options?: {
    fetcher?: typeof fetch;
    r2Config?: ReturnType<typeof createR2Config>;
  }
) {
  const officeBaseUrl = Deno.env.get('ONLYOFFICE_BASE_URL')?.trim();
  const officeJwtSecret = Deno.env.get('ONLYOFFICE_JWT_SECRET')?.trim();

  if (officeBaseUrl && officeJwtSecret) {
    const r2 = options?.r2Config ?? createR2Config();
    const tempHtmlKey = `temp/html-render/${crypto.randomUUID()}.html`;
    try {
      await putObject({
        config: r2,
        bucket: r2.privateBucket,
        objectKey: tempHtmlKey,
        contentType: 'text/html; charset=utf-8',
        body: new TextEncoder().encode(params.html),
      });

      const documentUrl = await createDownloadUrl({
        config: r2,
        bucket: r2.privateBucket,
        objectKey: tempHtmlKey,
        originalName: `${sanitizeFileName(params.title || 'documento')}.html`,
        contentType: 'text/html; charset=utf-8',
        ttlSeconds: 300,
      });

      const converted = await convertOnlyOfficeHtmlToPdf({
        baseUrl: officeBaseUrl,
        jwtSecret: officeJwtSecret,
        documentUrl,
        documentKey: crypto.randomUUID().replace(/-/g, ''),
        title: `${sanitizeFileName(params.title || 'documento')}.html`,
        fetcher: options?.fetcher,
      });

      await putObject({
        config: r2,
        bucket: r2.privateBucket,
        objectKey: params.objectKey,
        contentType: 'application/pdf',
        body: converted.bytes,
      });

      return {
        byteSize: converted.bytes.byteLength,
        bucket: r2.privateBucket,
        objectKey: params.objectKey,
      };
    } finally {
      await deleteObject({
        config: r2,
        bucket: r2.privateBucket,
        objectKey: tempHtmlKey,
      }).catch(() => undefined);
    }
  }

  const workerUrl = readEnv('PLAN_IA_CONTRACT_WORKER_URL');
  const workerToken = readEnv('PLAN_IA_CONTRACT_WORKER_TOKEN');
  if (!workerUrl || !workerToken) throw new Error('document_worker_misconfigured');

  const fetcher = options?.fetcher ?? fetch;
  const response = await fetcher(`${workerUrl.replace(/\/$/, '')}${params.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-token': workerToken,
    },
    body: JSON.stringify({
      html: params.html,
      object_key: params.objectKey,
      title: params.title,
      metadata: params.metadata ?? {},
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; byte_size?: number; bucket?: string; object_key?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `document_worker_http_${response.status}`);
  }

  return {
    byteSize: typeof payload?.byte_size === 'number' ? payload.byte_size : 0,
    bucket: textValue(payload?.bucket) || readEnv('R2_BUCKET_PRIVATE') || 'painelpro-private',
    objectKey: textValue(payload?.object_key) || params.objectKey,
  };
}

function decodeHtmlAttribute(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function canInlineDocumentImage(src: string) {
  try {
    const url = new URL(decodeHtmlAttribute(src));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

    let publicBaseUrl = '';
    try {
      publicBaseUrl = readEnv('R2_PUBLIC_BASE_URL');
    } catch {
      publicBaseUrl = '';
    }
    if (publicBaseUrl) {
      try {
        if (url.hostname === new URL(publicBaseUrl).hostname) return true;
      } catch {
        // Ignore malformed optional configuration and fall back to R2 host checks.
      }
    }

    try {
      const supabaseUrl = readEnv('SUPABASE_URL');
      const supabaseHost = new URL(supabaseUrl).hostname;
      if (
        url.hostname === supabaseHost &&
        url.pathname.endsWith('/functions/v1/storage-r2') &&
        url.searchParams.get('asset') === 'document-header'
      ) {
        return true;
      }
    } catch {
      // SUPABASE_URL is already required elsewhere; keep image inlining best effort.
    }

    return (
      url.hostname === 'r2.cloudflarestorage.com' ||
      url.hostname.endsWith('.r2.cloudflarestorage.com')
    );
  } catch {
    return false;
  }
}

export async function inlineRemoteDocumentImages(html: string) {
  const imageMatches = Array.from(
    html.matchAll(/<img\b[^>]*\bsrc=(["'])(https?:\/\/[^"']+)\1/gi)
  );
  if (imageMatches.length === 0) return html;

  let output = html;
  const replacements = new Map<string, string>();
  const maxBytes = STORAGE_ENTITY_CONFIG.crm_document_header_image.maxBytes;

  for (const match of imageMatches) {
    const originalSrc = match[2];
    if (!originalSrc || replacements.has(originalSrc) || !canInlineDocumentImage(originalSrc)) {
      continue;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(decodeHtmlAttribute(originalSrc), {
        signal: controller.signal,
      });
      if (!response.ok) continue;

      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
      if (!contentType.startsWith('image/')) continue;

      const contentLength = Number(response.headers.get('content-length') ?? '0');
      if (contentLength > maxBytes) continue;

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > maxBytes) continue;

      replacements.set(originalSrc, `data:${contentType};base64,${bytesToBase64(bytes)}`);
    } catch {
      replacements.set(originalSrc, originalSrc);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  for (const [originalSrc, dataUrl] of replacements) {
    if (dataUrl !== originalSrc) {
      output = output.split(originalSrc).join(dataUrl);
    }
  }

  return output;
}

export async function createReadyPdfStoredFile(params: {
  serviceClient: ServiceClient;
  ownerUserId: string;
  entityId: string;
  title: string;
  metadata?: Record<string, unknown>;
  html: string;
  seal?: boolean;
}) {
  const fileId = crypto.randomUUID();
  const fileName = `${sanitizeFileName(params.title || 'documento')}.pdf`;
  const config = STORAGE_ENTITY_CONFIG.crm_client_document_pdf;
  const objectKey = buildObjectKey(
    params.ownerUserId,
    'crm_client_document_pdf',
    fileId,
    fileName
  );
  const html = await inlineRemoteDocumentImages(params.html);

  const rendered = await callDocumentWorker({
    endpoint: params.seal ? '/documents/seal-pdf' : '/documents/render-pdf',
    html,
    objectKey,
    title: params.title,
    metadata: params.metadata,
  });

  const { error } = await params.serviceClient.from('stored_files').insert({
    id: fileId,
    owner_user_id: params.ownerUserId,
    entity_type: 'crm_client_document_pdf',
    entity_id: params.entityId,
    provider: 'cloudflare_r2',
    bucket: rendered.bucket,
    object_key: rendered.objectKey,
    original_name: fileName,
    content_type: 'application/pdf',
    byte_size: rendered.byteSize,
    visibility: config.visibility,
    status: 'ready',
    metadata: params.metadata ?? {},
    uploaded_at: new Date().toISOString(),
  });
  if (error) throw error;

  return {
    fileId,
    bucket: rendered.bucket,
    objectKey: rendered.objectKey,
    byteSize: rendered.byteSize,
  };
}

export function buildAdvisorSignatureCanonicalPayload(params: {
  contractDocumentId: string;
  pdfFileId: string;
  advisorUserId: string;
  advisorName: string;
  advisorEmail: string;
  ip: string;
  userAgent: string;
  signedAtIso: string;
}) {
  return [
    params.contractDocumentId,
    params.pdfFileId,
    params.advisorUserId,
    params.advisorName,
    params.advisorEmail,
    params.ip,
    params.userAgent,
    params.signedAtIso,
  ].join(' | ');
}

export function buildAdvisorSignatureHtml(params: {
  advisorName?: string | null;
  advisorEmail?: string | null;
  signedAt?: string | null;
  hash?: string | null;
}) {
  const signed = Boolean(params.signedAt && params.advisorName);
  return `
    <section class="signature-panel">
      <h2>Assinaturas</h2>
      <div class="signature-grid">
        <div class="signature-box">
          ${
            signed
              ? `<div class="signature-name">${escapeHtml(params.advisorName)}</div>`
              : '<div class="signature-pending">Assinatura da assessoria pendente</div>'
          }
          <div class="signature-line">Assessoria contratada</div>
          ${
            signed
              ? `<div class="signature-meta">Assinado eletronicamente em ${escapeHtml(
                  params.signedAt
                )}<br />${escapeHtml(params.advisorEmail ?? '')}<br />Hash: ${escapeHtml(
                  params.hash ?? ''
                )}</div>`
              : ''
          }
        </div>
        <div class="signature-box">
          <div class="signature-pending">Assinatura do cliente na página pública</div>
          <div class="signature-line">Contratante - {{nome_cliente}}</div>
          <div class="signature-meta">CPF: {{cpf_cliente}}</div>
        </div>
      </div>
    </section>
  `;
}

export async function generateCrmDocumentPdf(params: {
  serviceClient: ServiceClient;
  userId: string;
  clientId: string;
  documentType: DocumentType;
  templateVersionId?: string | null;
}) {
  const context = await loadClientContext({
    serviceClient: params.serviceClient,
    clientId: params.clientId,
    userId: params.userId,
  });
  const template = await loadTemplateHtml({
    serviceClient: params.serviceClient,
    tenantId: context.tenantId,
    documentType: params.documentType,
    templateVersionId: params.templateVersionId,
  });
  const variables = buildDocumentVariables(context);

  const existing = await params.serviceClient
    .from('crm_client_documents')
    .select('id,content,title,advisor_signed_at,advisor_name,advisor_email,advisor_signature_hash_sha256')
    .eq('client_id', params.clientId)
    .eq('doc_type', params.documentType)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const title =
    textValue(existing.data?.title) ||
    `${params.documentType === 'budget' ? 'Orçamento' : 'Contrato'} - ${context.client.name}`;
  const documentContent = textValue(existing.data?.content) || variables.notas || '';
  const contentHtml = documentContent
    .split(/\n{2,}/)
    .map((paragraph: string) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
  const advisorSignatureHtml =
    params.documentType === 'contract'
      ? buildAdvisorSignatureHtml({
          advisorName: textValue(existing.data?.advisor_name),
          advisorEmail: textValue(existing.data?.advisor_email),
          signedAt: textValue(existing.data?.advisor_signed_at),
          hash: textValue(existing.data?.advisor_signature_hash_sha256),
        })
      : '';
  const htmlBody = interpolateDocumentHtml(`${template.html}${advisorSignatureHtml}`, {
    ...variables,
    conteudo_documento: contentHtml,
  }, { rawKeys: ['conteudo_documento'] });
  const logoUrl = template.logoUrl || variables.logo_url;
  const renderedHtml = wrapPrintableHtml({ title, bodyHtml: htmlBody, logoUrl });
  const sourceSnapshot = {
    client: context.client,
    contract_data: context.contractData,
    people: context.people,
    variables,
    advisor_signature:
      params.documentType === 'contract'
        ? {
            signed_at: existing.data?.advisor_signed_at ?? null,
            advisor_name: existing.data?.advisor_name ?? null,
            advisor_email: existing.data?.advisor_email ?? null,
            hash_sha256: existing.data?.advisor_signature_hash_sha256 ?? null,
          }
        : null,
    generated_at: new Date().toISOString(),
  };

  const documentRowPayload = {
    user_id: context.client.user_id,
    tenant_id: context.tenantId,
    client_id: params.clientId,
    doc_type: params.documentType,
    title,
    content: documentContent,
    status: 'draft',
    template_version_id: template.versionId,
    rendered_html: renderedHtml,
    source_data_snapshot: sourceSnapshot,
    updated_at: new Date().toISOString(),
  };

  const { data: documentRow, error: documentError } = existing.data?.id
    ? await params.serviceClient
        .from('crm_client_documents')
        .update(documentRowPayload)
        .eq('id', existing.data.id)
        .select('id,title,doc_type,client_id,status')
        .single()
    : await params.serviceClient
        .from('crm_client_documents')
        .insert(documentRowPayload)
        .select('id,title,doc_type,client_id,status')
        .single();

  if (documentError || !documentRow?.id) throw documentError ?? new Error('document_upsert_failed');

  const pdf = await createReadyPdfStoredFile({
    serviceClient: params.serviceClient,
    ownerUserId: context.client.user_id,
    entityId: documentRow.id,
    title,
    html: renderedHtml,
    metadata: {
      document_id: documentRow.id,
      client_id: params.clientId,
      document_type: params.documentType,
      template_version_id: template.versionId,
    },
  });

  const { data: updatedDocument, error: updateError } = await params.serviceClient
    .from('crm_client_documents')
    .update({
      pdf_file_id: pdf.fileId,
      pdf_file_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentRow.id)
    .select('id,title,doc_type,client_id,status,pdf_file_id,approval_status,approved_at,rendered_html,advisor_signed_at,advisor_name,advisor_email,advisor_signature_hash_sha256')
    .single();
  if (updateError) throw updateError;

  return {
    context,
    document: updatedDocument,
    pdf,
  };
}

export async function createPublicDownloadUrl(params: {
  serviceClient: ServiceClient;
  fileId: string | null | undefined;
  ttlSeconds?: number;
}) {
  if (!params.fileId) return null;
  const { data, error } = await params.serviceClient
    .from('stored_files')
    .select('id,bucket,object_key,original_name,content_type,status,deleted_at')
    .eq('id', params.fileId)
    .maybeSingle();
  if (error || !data || data.status !== 'ready' || data.deleted_at) return null;

  try {
    const r2 = createR2Config();
    const ttl = Math.min(params.ttlSeconds ?? 600, 600);
    return await createDownloadUrl({
      config: r2,
      bucket: data.bucket,
      objectKey: data.object_key,
      originalName: data.original_name || 'documento.pdf',
      contentType: data.content_type || 'application/pdf',
      ttlSeconds: ttl,
    });
  } catch (err) {
    console.error('Failed to create R2 signed url in crmDocumentAutomation', err);
    return null;
  }
}

export async function getPublicPdfBytes(params: {
  serviceClient: ServiceClient;
  fileId: string | null | undefined;
}): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!params.fileId) return null;
  const { data, error } = await params.serviceClient
    .from('stored_files')
    .select('bucket,object_key,status,deleted_at')
    .eq('id', params.fileId)
    .maybeSingle();
  if (error || !data || data.status !== 'ready' || data.deleted_at) return null;

  try {
    const r2 = createR2Config();
    const bytes = await getObjectBytes({
      config: r2,
      bucket: data.bucket,
      objectKey: data.object_key,
    });
    return bytes ? (new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) as Uint8Array<ArrayBuffer>) : null;
  } catch (err) {
    console.error('Failed to get R2 object bytes in crmDocumentAutomation', err);
    return null;
  }
}

export function buildSignatureCanonicalPayload(params: {
  contractDocumentId: string;
  pdfFileId: string;
  cpf: string;
  email: string;
  ip: string;
  userAgent: string;
  signedAtIso: string;
}) {
  return [
    params.contractDocumentId,
    params.pdfFileId,
    params.cpf,
    params.email,
    params.ip,
    params.userAgent,
    params.signedAtIso,
  ].join(' | ');
}
