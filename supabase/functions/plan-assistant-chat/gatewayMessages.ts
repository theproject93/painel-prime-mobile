import type {
  AiGatewayMessage,
  PlanIaKnowledgeChunk,
  PlanIaSupportChunk,
} from "../_shared/aiRuntime.ts";
import { formatPlanIaRagContext } from "../_shared/planIaRagContext.ts";
import type { RankedRagCandidate } from "../_shared/planIaRagClient.ts";
import {
  type EventPortfolioSnapshot,
  formatEventPortfolioContext,
} from "../_shared/planAssistantEventPortfolio.ts";
import type { EventSnapshot } from "../_shared/planAssistantEventSnapshot.ts";
import type { FinancialSummary } from "../_shared/planAssistantContracts.ts";
import {
  buildSignupConversationState,
  type PublicPlanId,
  type SignupHistoryMessage,
} from "./signupConversation.ts";
import {
  formatSignupConversationState,
  PUBLIC_PLANS,
} from "./signupResponses.ts";

export type GatewayHelpDoc = {
  module: string;
  title: string;
  content: string;
  keywords: string[];
};

export type GatewaySuggestedAction = { label: string; path: string };

export type PlanAssistantGatewayContext = {
  userName: string;
  question: string;
  path: string;
  signupPlan: PublicPlanId | null;
  event: EventSnapshot | null;
  eventPortfolio: EventPortfolioSnapshot;
  finance: FinancialSummary | null;
  docs: GatewayHelpDoc[];
  hints: GatewaySuggestedAction[];
  knowledgeChunks?: PlanIaKnowledgeChunk[];
  supportChunks?: PlanIaSupportChunk[];
  ragCandidates?: RankedRagCandidate[];
  messageHistory?: SignupHistoryMessage[];
  isAndroidClient?: boolean;
};

export type GatewayRuntime = {
  activePrompt?: string | null;
  maxTokens: number;
};

export {
  ANDROID_NAVIGATION_SYSTEM_PROMPT,
  DASHBOARD_SYSTEM_PROMPT,
  SIGNUP_SYSTEM_PROMPT,
} from "./promptArmor.ts";
import {
  ANDROID_NAVIGATION_SYSTEM_PROMPT,
  DASHBOARD_SYSTEM_PROMPT,
  SIGNUP_SYSTEM_PROMPT,
  buildArmorDelimitedUserPrompt,
} from "./promptArmor.ts";

export function cleanSupportChunkForAndroid(text: string): string {
  if (!text) return "";
  return text
    .replace(/`?\/configura[cç][oõ]es\?tab=planos`?/gi, "aba **Mais** > **Assinatura e planos**")
    .replace(/`?\/dashboard\/configura[cç][oõ]es`?/gi, "aba **Mais** > **Configurações**")
    .replace(/`?\/dashboard\/equipe`?/gi, "aba **Mais** > **Sua equipe**")
    .replace(/`?\/dashboard\/perfil`?/gi, "aba **Mais** > **Perfil**")
    .replace(/`?\/dashboard\/saude-operacional`?/gi, "aba **Mais** > **Saúde operacional**")
    .replace(/`?\/dashboard\/faturamento`?/gi, "aba **Mais** > **Assinatura e planos**")
    .replace(/`?\/dashboard\/eventos(?:\/[a-zA-Z0-9_-]+)*`?/gi, "aba **Eventos**")
    .replace(/`?\/dashboard\/clientes(?:\/[a-zA-Z0-9_-]+)*`?/gi, "aba **Clientes**")
    .replace(/`?\/dashboard\/financeiro(?:\/[a-zA-Z0-9_-]+)*`?/gi, "aba **Finanças**")
    .replace(/`?\/dashboard\/fornecedores(?:\/[a-zA-Z0-9_-]+)*`?/gi, "aba **Fornec.**")
    .replace(/`?\/dashboard(?:\/[a-zA-Z0-9_-]+)*`?/gi, "aba **Início**");
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function isPlanAssistantSmallTalk(question: string) {
  const q = normalized(question);
  return q.includes("obrigad") || q.includes("valeu") || q.includes("show") ||
    q === "ok" || q === "blz" || q.includes("tudo bem") ||
    q.includes("como vai") ||
    q.includes("como voce") || q.includes("e voce") || q.includes("entendi") ||
    q.includes("ola");
}

export function planAssistantTemperature(question: string, signup: boolean) {
  if (signup) return 0.6;
  if (isPlanAssistantSmallTalk(question)) return 0.7;
  const q = normalized(question);
  const exact = [
    "financeir",
    "caixa",
    "pagament",
    "receber",
    "saldo",
    "fluxo",
    "documento",
    "comprovante",
    "arquivo",
    "anexo",
  ].some((term) => q.includes(term));
  return exact ? 0.2 : 0.5;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatPlanAssistantEventContext(
  event: EventSnapshot | null,
  finance: FinancialSummary | null,
  portfolio: EventPortfolioSnapshot,
) {
  if (!event) {
    let context = formatEventPortfolioContext(portfolio);
    if (finance) {
      const finLines: string[] = [];
      finLines.push(`- Saldo em caixa: ${money(finance.cash_balance)}`);
      if (finance.confirmed_in > 0) finLines.push(`- Entradas confirmadas: ${money(finance.confirmed_in)}`);
      if (finance.confirmed_out > 0) finLines.push(`- Despesas confirmadas: ${money(finance.confirmed_out)}`);
      if (finance.planned_in > 0) finLines.push(`- Receitas previstas: ${money(finance.planned_in)}`);
      if (finance.planned_out > 0) finLines.push(`- Despesas previstas: ${money(finance.planned_out)}`);
      context += `\n\nResumo financeiro da assessoria:\n${finLines.join("\n")}`;
    }
    return context;
  }
  let heading = `O evento "${event.name}"`;
  if (event.event_date) {
    const date = new Date(event.event_date);
    if (!Number.isNaN(date.getTime())) {
      const isPast = date.getTime() < Date.now();
      const dateStr = date.toLocaleDateString("pt-BR");
      heading += isPast ? ` teve data em ${dateStr} (já passou)` : ` está programado para ${dateStr}`;
    }
  }
  heading += ".";
  const lines: string[] = [];
  if (event.location) lines.push(`- Local: ${event.location}`);
  if (
    event.aggregates_available === true || event.guests_total > 0 ||
    event.guests_pending_rsvp > 0
  ) {
    lines.push(
      `- Convidados cadastrados: ${event.guests_total} (${event.guests_pending_rsvp} pendentes de RSVP)`,
    );
  }
  if (event.budget_total > 0) {
    lines.push(
      `- Orçamento: ${money(event.budget_total)} (${
        money(event.budget_spent)
      } gasto, ${money(event.budget_remaining)} restante)`,
    );
  }
  if (event.vendors_total > 0) {
    const pending = event.vendors_without_schedule > 0
      ? ` (${event.vendors_without_schedule} sem horário agendado)`
      : "";
    lines.push(`- Fornecedores: ${event.vendors_total}${pending}`);
  }
  if (event.buffet_registered) lines.push("- Buffet já registrado");
  else if (event.guests_total > 0) lines.push("- Buffet ainda não registrado");
  if (event.tasks_open > 0) {
    if (event.tasks_list?.length) {
      const titles = event.tasks_list.map((task) => task.title).slice(0, 15)
        .join("; ");
      const more = event.tasks_open > event.tasks_list.length
        ? ` (e mais ${event.tasks_open - event.tasks_list.length})`
        : "";
      lines.push(`- Tarefas abertas (${event.tasks_open}): ${titles}${more}`);
    } else {
      const overdue = event.tasks_overdue > 0
        ? ` (${event.tasks_overdue} atrasadas)`
        : "";
      lines.push(`- Tarefas abertas: ${event.tasks_open}${overdue}`);
    }
  }
  if (
    event.receivable_total > 0 &&
    event.receivable_total - event.receivable_paid > 0
  ) {
    lines.push(
      `- Cobranças: ${
        money(event.receivable_total - event.receivable_paid)
      } pendentes (${money(event.receivable_paid)} recebido)`,
    );
  }
  if (finance && finance.cash_balance !== 0) {
    lines.push(`- Saldo em caixa: ${money(finance.cash_balance)}`);
  }
  return lines.length > 0 ? `${heading}\n${lines.join("\n")}` : heading;
}

export function buildPlanAssistantGatewayRequest(
  context: PlanAssistantGatewayContext,
  runtime: GatewayRuntime,
) {
  const signup = context.path.startsWith("/cadastro");
  const systemPrompt = [
    runtime.activePrompt,
    signup ? SIGNUP_SYSTEM_PROMPT : DASHBOARD_SYSTEM_PROMPT,
    context.isAndroidClient ? ANDROID_NAVIGATION_SYSTEM_PROMPT : null,
  ]
    .filter((item): item is string =>
      typeof item === "string" && item.trim().length > 0
    )
    .join("\n\n");
  const docs = context.docs.length > 0
    ? `Artigos relevantes da base de conhecimento:\n${
      context.docs.map((doc) => {
        const docContent = context.isAndroidClient
          ? cleanSupportChunkForAndroid(doc.content)
          : doc.content;
        return `- ${doc.title} (${doc.module}): ${docContent.slice(0, 150)}...`;
      }).join("\n")
    }`
    : "Nenhum artigo relevante encontrado na base de conhecimento.";
  const rawSupportChunks = context.supportChunks ?? [];
  const support = rawSupportChunks.length
    ? `Trechos relevantes da base interna de suporte:\n${
      rawSupportChunks.map((chunk) => {
        const chunkText = context.isAndroidClient
          ? cleanSupportChunkForAndroid(chunk.chunk_text)
          : chunk.chunk_text;
        const routes = !context.isAndroidClient && Array.isArray(chunk.route_patterns) &&
            chunk.route_patterns.length > 0
          ? ` | rotas: ${chunk.route_patterns.join(", ")}`
          : "";
        return `- ${chunk.title} | módulo: ${chunk.module_key}${routes}: ${
          chunkText.slice(0, 260)
        }...`;
      }).join("\n")
    }`
    : "Nenhum trecho relevante da base interna foi recuperado.";
  const knowledge = context.knowledgeChunks?.length
    ? `Trechos recuperados por similaridade para a conversa pública:\n${
      context.knowledgeChunks.map((chunk) => {
        const source = chunk.source ? ` | origem: ${chunk.source}` : "";
        return `- ${chunk.title ?? "Base de conhecimento"}${source}: ${
          chunk.chunk_text.slice(0, 220)
        }...`;
      }).join("\n")
    }`
    : "Nenhum trecho adicional de conhecimento foi recuperado.";
  const state = signup
    ? formatSignupConversationState(buildSignupConversationState({
      question: context.question,
      userName: context.userName,
      path: context.path,
      messageHistory: context.messageHistory ?? [],
    }))
    : "";
  const todayStr = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const userPrompt = buildArmorDelimitedUserPrompt({
    todayStr,
    userName: context.userName,
    question: context.question,
    eventContext: formatPlanAssistantEventContext(
      context.event,
      context.finance,
      context.eventPortfolio,
    ),
    signup,
    signupPlan: context.signupPlan,
    state,
    hints: context.hints,
    support,
    ragContext: !signup
      ? (context.isAndroidClient
        ? cleanSupportChunkForAndroid(formatPlanIaRagContext(context.ragCandidates ?? []))
        : formatPlanIaRagContext(context.ragCandidates ?? []))
      : "",
    docs,
    knowledge: signup ? knowledge : "",
  });
  const messages: AiGatewayMessage[] = [{
    role: "system",
    content: systemPrompt,
  }];
  if (context.messageHistory?.length) messages.push(...context.messageHistory);
  messages.push({ role: "user", content: userPrompt });
  return {
    messages,
    userPrompt,
    request: {
      context: signup ? "public_sales" as const : "logged_dashboard" as const,
      messages,
      temperature: planAssistantTemperature(context.question, signup),
      maxTokens: runtime.maxTokens,
    },
  };
}
