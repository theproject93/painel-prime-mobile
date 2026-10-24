import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createServiceRoleClient,
  ensurePrimaryTenantId,
  fetchPlanIaKnowledge,
  loadAiRuntimeConfig,
} from "../_shared/aiRuntime.ts";
import { normalizeContractAttachments } from "../_shared/planIaContractJobs.ts";
import { enforceUpstashPlanAssistantRateLimit } from "../_shared/upstash-rate-limiter.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import type { PlanAssistantRequest } from "../_shared/planAssistantContracts.ts";
import {
  extractSignupPlanFromPath,
  isSignupPath,
  resolveSignupUserName,
} from "./signupConversation.ts";
import { runSignupFlow } from "./signupFlow.ts";
import {
  publicSalesHttpResponse,
  readPublicSalesJob,
} from "./publicSalesQueue.ts";
import { createPublicSalesContactRequest } from "./publicSalesContact.ts";
import { loadDashboardContext } from "./dashboardContext.ts";
import { runContractFlow } from "./contractFlow.ts";
import { runRemoteDashboardFlow } from "./remoteChatFlow.ts";
import {
  isUuid,
  localAiHttpState,
  readLocalAiJob,
} from "../_shared/localAiQueue.ts";
import {
  evaluatePromptSecurity,
  logPromptSecurityEventAsync,
} from "../_shared/promptFirewall.ts";

function corsHeaders(request?: Request | null) {
  return buildCorsHeaders(request, {
    envNames: ["APP_ALLOWED_ORIGINS", "PLAN_ASSISTANT_ALLOWED_ORIGINS"],
    methods: "POST, OPTIONS",
  });
}

type HintInput = {
  id?: unknown;
  title?: unknown;
  ctaLabel?: unknown;
  ctaPath?: unknown;
};

type HistoryMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

type SuggestedAction = {
  label: string;
  path: string;
};

const DEFAULT_CONTRACT_UPLOAD_PROMPT =
  "Analise este contrato e me devolva um resumo, os termos financeiros e os principais riscos.";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  request?: Request | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

function streamResponse(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function normalizeString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const clean = value.trim();
  return clean || fallback;
}

function normalizeNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeName(value: unknown) {
  const raw = normalizeString(value);
  if (!raw) return "assessora";
  return raw.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 40) || "assessora";
}

function normalizeHints(value: unknown): SuggestedAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as HintInput;
      const label = normalizeString(row.ctaLabel, normalizeString(row.title));
      const path = normalizeString(row.ctaPath);
      if (!label || !path) return null;
      return { label: label.slice(0, 60), path: path.slice(0, 300) };
    })
    .filter((item): item is SuggestedAction => item !== null);
}

function extractEventId(path: string, explicitEventId: string) {
  if (explicitEventId) return explicitEventId;
  const match = path.match(/\/dashboard\/eventos\/([0-9a-fA-F-]{8,})/);
  return match?.[1] ?? "";
}

Deno.serve(async (request) => {
  const respond = (status: number, body: Record<string, unknown>) =>
    jsonResponse(status, body, request);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return respond(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return respond(500, { error: "server_misconfigured" });
  }

  const authHeader = request.headers.get("Authorization");
  let payload: PlanAssistantRequest;
  try {
    payload = (await request.json()) as PlanAssistantRequest;
  } catch {
    return respond(400, { error: "invalid_json" });
  }

  const attachments = normalizeContractAttachments(payload.attachments);
  const localJobId = normalizeString(
    (payload as PlanAssistantRequest & { jobId?: unknown }).jobId,
  );
  const localRequestId = normalizeString(
    (payload as PlanAssistantRequest & { requestId?: unknown }).requestId ??
      payload.request_id,
  );
  const publicSalesJobId = normalizeString(payload.publicSalesJobId);
  const publicSalesJobToken = normalizeString(payload.publicSalesJobToken);
  const publicSalesConversationId = normalizeString(payload.conversation_id);
  const salesContact = payload.sales_contact;
  const messageText = normalizeString(payload.message);
  const question = messageText ||
    (attachments.length > 0 ? DEFAULT_CONTRACT_UPLOAD_PROMPT : "");
  if (!question && !localJobId && !publicSalesJobId && !salesContact) {
    return respond(400, { error: "message_required" });
  }

  const explicitContextType = normalizeString(payload.context_type);
  const explicitContextId = normalizeString(payload.context_id);
  let userName = normalizeName(payload.user_name);
  const currentPath = normalizeString(payload.current_path, "/dashboard");
  const clientPlatform = normalizeString(payload.client_platform);
  const channel = normalizeString(payload.channel);
  const isAndroidClient =
    clientPlatform === "android" ||
    channel === "app_android" ||
    channel === "app_mobile";
  const explicitEventId = normalizeString(
    payload.current_event_id,
    explicitContextType === "event" ? explicitContextId : "",
  );
  let eventId = extractEventId(currentPath, explicitEventId);
  const hints = normalizeHints(payload.hints);
  const signupMode = isSignupPath(currentPath);
  const signupPathPlan = extractSignupPlanFromPath(currentPath);
  const signupMessageHistory: HistoryMessage[] = [];
  if (payload.message_history && Array.isArray(payload.message_history)) {
    const rawHistory = payload.message_history as Array<{
      role?: unknown;
      content?: unknown;
    }>;
    for (const item of rawHistory) {
      const role = item.role;
      const content = item.content;
      if (
        typeof content === "string" &&
        (role === "assistant" || role === "user")
      ) {
        signupMessageHistory.push({ role, content });
      }
    }
  }
  userName = resolveSignupUserName(userName, question, signupMessageHistory);
  const serviceRoleClient = createServiceRoleClient();

  let supabase = createClient<any>(supabaseUrl, supabaseAnonKey);
  let userId: string | null = null;
  let tenantId: string | null = null;

  if (authHeader) {
    supabase = createClient<any>(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (!authError && authData?.user) {
      userId = authData.user.id;
      tenantId = await ensurePrimaryTenantId(serviceRoleClient, userId);
    }
  }

  // WAF de Prompts (Prompt Firewall) em Modo Escuta / Shadow Mode
  if (question && serviceRoleClient) {
    const firewallEval = evaluatePromptSecurity(question);
    const logPromise = logPromptSecurityEventAsync(serviceRoleClient, {
      tenantId,
      userId,
      surface: "web_plan_ia",
      senderIdentifier: userId || "anonymous_lead",
      rawPrompt: question,
      evaluation: firewallEval,
      clientMetadata: {
        currentPath,
        eventId: eventId || null,
        userAgent: request.headers.get("user-agent") || undefined,
        ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || undefined,
      },
    });

    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
      (globalThis as any).EdgeRuntime.waitUntil(logPromise);
    } else {
      await logPromise;
    }
  }

  if (localJobId) {
    if (!authHeader) {
      return respond(401, {
        code: 401,
        message: "Missing authorization header",
      });
    }
    if (!userId) return respond(401, { error: "unauthorized" });
    if (!tenantId) {
      return respond(503, { error: "tenant_context_unavailable" });
    }

    const job = await readLocalAiJob(serviceRoleClient, {
      jobId: localJobId,
      tenantId,
      kind: "plan.assistant",
    });
    if (!job) return respond(404, { error: "job_not_found" });
    const state = localAiHttpState(job);
    if (state.state === "completed") {
      return respond(200, {
        jobId: job.id,
        status: state.state,
        answer: typeof job.output?.answer === "string" ? job.output.answer : "",
        cited_source_ids: Array.isArray(job.output?.cited_source_ids)
          ? job.output.cited_source_ids
          : [],
        suggested_actions: [],
        proposed_actions: Array.isArray(job.output?.proposed_actions)
          ? job.output.proposed_actions
          : [],
        meta: {
          ai_used: true,
          ai_error: null,
          response_mode: "local_async",
        },
      });
    }
    return respond(state.httpStatus, {
      jobId: job.id,
      status: state.state,
      partial_answer: state.state === "pending"
        ? job.partial_answer ?? undefined
        : undefined,
      error: state.state === "failed" ? job.error_code : undefined,
    });
  }

  if (publicSalesJobId) {
    if (!publicSalesJobToken) {
      return respond(400, { error: "public_sales_job_token_required" });
    }
    const job = await readPublicSalesJob(serviceRoleClient, {
      jobId: publicSalesJobId,
      jobToken: publicSalesJobToken,
    });
    if (!job) return respond(404, { error: "job_not_found" });
    const result = publicSalesHttpResponse(job, {
      question,
      path: currentPath,
      messageHistory: signupMessageHistory,
    });
    return respond(result.status, result.body);
  }

  const distributedRateLimitResponse =
    await enforceUpstashPlanAssistantRateLimit({
      request,
      surface: signupMode ? "sales" : "dashboard",
      tenantId,
      responseHeaders: corsHeaders(request),
    });
  if (distributedRateLimitResponse) {
    return distributedRateLimitResponse;
  }

  if (salesContact) {
    if (
      !isSignupPath(currentPath) ||
      !isUuid(publicSalesConversationId) ||
      !isUuid(localRequestId)
    ) {
      return respond(400, { error: "invalid_sales_contact_identity" });
    }
    try {
      const contactRequestId = await createPublicSalesContactRequest(
        serviceRoleClient,
        {
          conversationId: publicSalesConversationId,
          requestId: localRequestId,
          value: salesContact,
        },
      );
      return respond(201, {
        contactRequestId,
        status: "received",
        message: "Pedido de contato recebido com seu consentimento.",
      });
    } catch {
      return respond(400, { error: "invalid_sales_contact_request" });
    }
  }

  if (signupMode && attachments.length > 0) {
    return respond(400, {
      error: "attachments_not_supported_in_signup_chat",
    });
  }

  if (signupMode) {
    const signupResult = await runSignupFlow({
      serviceRoleClient,
      userName,
      question,
      currentPath,
      signupPlan: signupPathPlan,
      messageHistory: signupMessageHistory,
    }, {
      loadRuntimeConfig: async (client) => ({
        ...(await loadAiRuntimeConfig(client, null)),
        enabled: false,
      }),
      fetchKnowledge: (client, params) => fetchPlanIaKnowledge(client, params),
      callGateway: () => {
        throw new Error("public_ai_disabled_local_strict");
      },
      logError: (message, error) => console.error(message, error),
    });
    return respond(signupResult.status, signupResult.body);
  }

  if (!authHeader) {
    return respond(401, {
      code: 401,
      message: "Missing authorization header",
    });
  }

  if (!userId) {
    return respond(401, { error: "unauthorized" });
  }

  if (!tenantId) {
    return respond(503, { error: "tenant_context_unavailable" });
  }

  if (!serviceRoleClient) {
    return respond(503, { error: "service_role_unavailable" });
  }

  if (attachments.length === 0 && !isUuid(localRequestId)) {
    return respond(400, { error: "invalid_request_id" });
  }

  const messageHistory = signupMessageHistory;
  console.log(
    "[plan-assistant-chat] Loaded message history:",
    messageHistory.length,
    "messages",
  );

  let quotaInfo: Record<string, unknown> | null = null;
  try {
    const { data: quotaData, error: quotaError } = await serviceRoleClient.rpc(
      "consume_plan_ia_interaction",
      {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_interaction_type: attachments.length > 0 ? "contract_analysis" : "chat",
        p_event_id: eventId || null,
      },
    );
    if (!quotaError && quotaData && typeof quotaData === "object") {
      quotaInfo = quotaData as Record<string, unknown>;
      if (quotaInfo.allowed === false) {
        const used = quotaInfo.used ?? 0;
        const limit = quotaInfo.limit ?? 0;
        const upgradePlan =
          quotaInfo.upgrade_recommended === "elite"
            ? "Elite"
            : quotaInfo.upgrade_recommended === "profissional"
            ? "Profissional"
            : "Superior";
        const cycleEndRaw = quotaInfo.cycle_end;
        let renewalText = "no próximo ciclo mensal";
        if (typeof cycleEndRaw === "string" && cycleEndRaw) {
          try {
            renewalText = `em ${new Date(cycleEndRaw).toLocaleDateString("pt-BR")}`;
          } catch {
            // observability-ignore: fallback para texto amigavel em caso de formato de data inesperado
          }
        }
        const quotaAnswer =
          `Você atingiu o limite mensal de interações da Plan IA para o seu plano (${used}/${limit}).\n\n` +
          `Sua franquia será renovada ${renewalText}.\n\n` +
          `Para continuar utilizando a assistente sem interrupções e com recursos avançados de equipe e inteligência, faça o upgrade para o **Plano ${upgradePlan}**.`;

        return respond(200, {
          answer: quotaAnswer,
          suggested_actions: [
            {
              label: `Conhecer Plano ${upgradePlan}`,
              path: "/configuracoes?tab=planos",
            },
          ],
          quota: quotaInfo,
          meta: {
            quota_exceeded: true,
            response_mode: "quota_gate",
          },
        });
      }
    }
  } catch (quotaErr) {
    // observability-ignore: falha na checagem de quota nao impede o uso da IA pelo usuario
    console.error("[plan-assistant-chat] quota_check_failed:", quotaErr);
  }

  const dashboardContext = await loadDashboardContext({
    serviceRoleClient,
    userClient: supabase,
    tenantId,
    userId,
    question,
    messageHistory,
    currentPath,
    eventId,
    includeExternalSupport: true,
    rag: {
      // O gateway MiniLM/Qdrant da OVH permanece desligado. O contexto semÃ¢ntico
      // ativo vem do Workers AI bge-m3 + pgvector via includeExternalSupport.
      enabled: false,
      gatewayUrl: undefined,
      gatewaySecret: undefined,
      requestId: localRequestId,
    },
  });
  const directResponse = dashboardContext.directResponse;
  if (directResponse) {
    return respond(
      directResponse.status,
      {
        ...directResponse.body,
        ...(quotaInfo ? { quota: quotaInfo } : {}),
      },
    );
  }

  const {
    runtimeConfig,
    planId,
    moduleKey,
    eventSnapshot,
    eventPortfolio,
    financeSnapshot,
    helpDocs,
    supportChunks,
    ragContext,
  } = dashboardContext;

  const effectiveQuestion = dashboardContext.contextualizedQuestion || question;

  const contractResult = await runContractFlow({
    serviceRoleClient,
    userId,
    tenantId,
    explicitContextType,
    currentPath,
    question: effectiveQuestion,
    event: eventSnapshot,
    attachments,
    hints,
  });
  if (contractResult) {
    return respond(contractResult.status, {
      ...contractResult.body,
      ...(quotaInfo ? { quota: quotaInfo } : {}),
    });
  }

  const dashboardResult = await runRemoteDashboardFlow({
    serviceRoleClient,
    userId,
    tenantId,
    currentPath,
    userName,
    question: effectiveQuestion,
    hints,
    event: eventSnapshot,
    eventPortfolio,
    finance: financeSnapshot,
    helpDocs,
    supportChunks,
    ragContext,
    runtimeConfig,
    planId,
    moduleKey,
    messageHistory,
    requestId: localRequestId,
    quota: quotaInfo,
    isAndroidClient,
    bedrockAccessKeyId: (Deno.env.get("BEDROCK_AWS_ACCESS_KEY_ID") || Deno.env.get("AWS_ACCESS_KEY_ID"))?.trim() || undefined,
    bedrockSecretAccessKey: (Deno.env.get("BEDROCK_AWS_SECRET_ACCESS_KEY") || Deno.env.get("AWS_SECRET_ACCESS_KEY"))?.trim() || undefined,
    bedrockRegion: (Deno.env.get("BEDROCK_AWS_REGION") || Deno.env.get("AWS_REGION"))?.trim() || undefined,
    bedrockModelId: Deno.env.get("BEDROCK_MODEL_ID")?.trim() || undefined,
  });
  if (dashboardResult.kind === "stream") {
    return streamResponse(dashboardResult.response, request);
  }
  return respond(dashboardResult.status, {
    ...dashboardResult.body,
    ...(quotaInfo ? { quota: quotaInfo } : {}),
  });
});

