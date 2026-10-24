import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.11";
import {
  buildPlanAssistantGatewayRequest,
  cleanSupportChunkForAndroid,
} from "./gatewayMessages.ts";
import type { PlanIaSupportChunk } from "../_shared/aiRuntime.ts";
import type { EventPortfolioSnapshot } from "../_shared/planAssistantEventPortfolio.ts";

const mockPortfolio: EventPortfolioSnapshot = {
  totalCount: 2,
  activeCount: 1,
  completedCount: 1,
  nextEvent: null,
  activeEvents: [],
};

Deno.test("cleanSupportChunkForAndroid replaces web routes with mobile tabs and buttons", () => {
  const input = "Acesse /dashboard/eventos para gerenciar e /dashboard/financeiro para caixa.";
  const cleaned = cleanSupportChunkForAndroid(input);
  assertEquals(cleaned, "Acesse aba **Eventos** para gerenciar e aba **Finanças** para caixa.");
});

Deno.test("buildPlanAssistantGatewayRequest injects ANDROID_NAVIGATION_SYSTEM_PROMPT when isAndroidClient is true", () => {
  const supportChunk: PlanIaSupportChunk = {
    chunk_id: "chunk-1",
    document_id: "doc-1",
    knowledge_scope: "logged_dashboard",
    tenant_id: null,
    chunk_text: "Para criar evento, acesse /dashboard/eventos.",
    module_key: "events",
    title: "Criação de eventos",
    route_patterns: ["/dashboard/eventos"],
    doc_type: "article",
    metadata: {},
    base_similarity: 1,
    route_score: 1,
    module_score: 1,
    final_score: 1,
  };

  const result = buildPlanAssistantGatewayRequest(
    {
      userName: "Marina",
      question: "como cadastrar um evento?",
      path: "/dashboard/eventos",
      signupPlan: null,
      event: null,
      eventPortfolio: mockPortfolio,
      finance: null,
      docs: [],
      hints: [],
      supportChunks: [supportChunk],
      isAndroidClient: true,
    },
    {
      activePrompt: "",
      maxTokens: 500,
    },
  );

  const systemMessage = result.messages.find((m) => m.role === "system");
  assertEquals(Boolean(systemMessage), true);
  assertStringIncludes(systemMessage?.content || "", "DIRETRIZES DE NAVEGAÇÃO E EXPERIÊNCIA NATIVA NO APLICATIVO ANDROID:");
  assertStringIncludes(systemMessage?.content || "", "Toque na aba **Eventos** no menu inferior");

  const userMessage = result.messages.find((m) => m.role === "user");
  assertEquals(Boolean(userMessage), true);
  // Verify support chunk was cleaned
  assertStringIncludes(userMessage?.content || "", "aba **Eventos**");
  assertEquals((userMessage?.content || "").includes("/dashboard/eventos"), false);
});

Deno.test("buildPlanAssistantGatewayRequest omits Android navigation prompt when isAndroidClient is false", () => {
  const result = buildPlanAssistantGatewayRequest(
    {
      userName: "Marina",
      question: "como cadastrar um evento?",
      path: "/dashboard/eventos",
      signupPlan: null,
      event: null,
      eventPortfolio: mockPortfolio,
      finance: null,
      docs: [],
      hints: [],
      isAndroidClient: false,
    },
    {
      activePrompt: "",
      maxTokens: 500,
    },
  );

  const systemMessage = result.messages.find((m) => m.role === "system");
  assertEquals(Boolean(systemMessage), true);
  assertEquals((systemMessage?.content || "").includes("DIRETRIZES DE NAVEGAÇÃO E EXPERIÊNCIA NATIVA NO APLICATIVO ANDROID:"), false);
});
