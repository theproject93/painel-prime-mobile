import { persistAiTurn } from "../_shared/aiRuntime.ts";
import { executePlanAssistantTool, PLAN_ASSISTANT_TOOLS } from "./planAssistantTools.ts";
import type { DashboardResponseInput } from "./dashboardResponse.ts";
import { resolveDeterministicDashboardResponse } from "./deterministicResponses.ts";
import { buildPlanAssistantGatewayRequest } from "./gatewayMessages.ts";
import {
  type ProviderCompletion,
  runPlanAssistantProviderChain,
} from "./streamingProviders.ts";

export type RemoteDashboardFlowInput = DashboardResponseInput & {
  requestId: string;
  bedrockAccessKeyId?: string;
  bedrockSecretAccessKey?: string;
  bedrockRegion?: string;
  bedrockModelId?: string;
  quota?: Record<string, unknown> | null;
  isAndroidClient?: boolean;
};

type RemoteDashboardFlowDependencies = {
  runProviders: typeof runPlanAssistantProviderChain;
  persistTurn: typeof persistAiTurn;
};

const defaultDependencies: RemoteDashboardFlowDependencies = {
  runProviders: runPlanAssistantProviderChain,
  persistTurn: persistAiTurn,
};

function deterministicResponse(answer: string) {
  return {
    kind: "response" as const,
    status: 200,
    body: {
      answer,
      suggested_actions: [],
      meta: { response_mode: "deterministic" as const },
    },
  };
}

function formatEventDate(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

function buildTrustedEventFallback(
  event: RemoteDashboardFlowInput["event"],
) {
  if (!event) return undefined;
  const facts: string[] = [];
  const date = formatEventDate(event.event_date);
  if (date) facts.push(`data ${date}`);
  if (event.location) facts.push(`local ${event.location}`);
  if (event.aggregates_available === true) {
    facts.push(
      `${event.guests_total} convidados cadastrados (${event.guests_pending_rsvp} pendentes de RSVP)`,
    );
  }
  if (facts.length === 0) {
    return `O evento ${event.name} estÃ¡ selecionado, mas os dados centrais dele nÃ£o estÃ£o preenchidos.`;
  }
  return `Tenho estes dados do evento ${event.name}: ${facts.join(" e ")}.`;
}

export async function runRemoteDashboardFlow(
  input: RemoteDashboardFlowInput,
  dependencies: RemoteDashboardFlowDependencies = defaultDependencies,
) {
  const deterministic = resolveDeterministicDashboardResponse(input);
  if (deterministic) {
    return { kind: "response" as const, ...deterministic };
  }

  const built = buildPlanAssistantGatewayRequest({
    userName: input.userName,
    question: input.question,
    path: input.currentPath,
    signupPlan: null,
    event: input.event,
    eventPortfolio: input.eventPortfolio,
    finance: input.finance,
    docs: input.helpDocs,
    hints: input.hints,
    supportChunks: input.supportChunks,
    ragCandidates: input.ragContext.promptCandidates,
    messageHistory: input.messageHistory,
    isAndroidClient: input.isAndroidClient,
  }, {
    activePrompt: input.runtimeConfig.activePrompt,
    maxTokens: 500,
  });

  const persistCompletion = async (completion: ProviderCompletion) => {
    const cleanAnswer = completion.answer
      .replace(/\s*(?:→|->|:)\s*`?(?:get|create|update|delete|check|search|notify|export|checkin|calculate|register)_[a-z0-9_]+`?/gi, "")
      .replace(/\(\s*`?(?:get|create|update|delete|check|search|notify|export|checkin|calculate|register)_[a-z0-9_]+`?\s*\)/gi, "")
      .replace(/`?(?:get|create|update|delete|check|search|notify|export|checkin|calculate|register)_[a-z0-9_]{3,35}`?/gi, "");

    await dependencies.persistTurn(input.serviceRoleClient, {
      userId: input.userId,
      tenantId: input.tenantId,
      source: "plan_assistant_chat",
      currentPath: input.currentPath,
      provider: completion.provider,
      model: completion.model,
      promptText: input.question,
      responseText: cleanAnswer,
      systemPromptVersionId: input.runtimeConfig.activePromptVersionId,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      latencyMs: completion.latencyMs,
      aiUsed: completion.provider !== "deterministic",
      errorCode: completion.errorCode,
      requestMetadata: {
        request_id: input.requestId,
        plan_id: input.planId,
        module_key: input.moduleKey,
        ttft_ms: completion.ttftMs,
        fallback_reason: completion.fallbackReason,
        support_chunks_count: input.supportChunks.length,
      },
      responseMetadata: { response_mode: "remote_stream" },
    });
  };

  const response = await dependencies.runProviders({
    requestId: input.requestId,
    question: input.question,
    currentPath: input.currentPath,
    userName: input.userName,
    messageHistory: input.messageHistory,
    messages: built.messages,
    temperature: built.request.temperature,
    responseMetadata: {
      support_chunks_count: input.supportChunks.length,
    },
    fallbackAnswer: buildTrustedEventFallback(input.event),
    quota: input.quota,
    tools: PLAN_ASSISTANT_TOOLS,
    toolExecutor: (toolName, args) =>
      executePlanAssistantTool(toolName, args, {
        serviceRoleClient: input.serviceRoleClient,
        tenantId: input.tenantId,
        currentEventId: input.event?.id,
        currentEvent: input.event,
        userId: input.userId,
      }),
    onComplete: persistCompletion,
  }, {
    bedrockAccessKeyId: input.bedrockAccessKeyId,
    bedrockSecretAccessKey: input.bedrockSecretAccessKey,
    bedrockRegion: input.bedrockRegion,
    bedrockModelId: input.bedrockModelId,
  });

  return { kind: "stream" as const, response };
}

