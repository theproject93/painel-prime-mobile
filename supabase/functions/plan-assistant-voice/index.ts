import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  createServiceRoleClient,
  ensurePrimaryTenantId,
} from "../_shared/aiRuntime.ts";
import {
  DEFAULT_USER_HOURLY_VOICE_LIMIT,
  validateVoiceInput,
} from "../_shared/voiceLimits.ts";
import { resolveReplyModality } from "../_shared/voiceModality.ts";
import { transcribeAudio } from "../_shared/awsTranscribe.ts";
import { synthesizeSpeech } from "../_shared/awsPollyTts.ts";
import { converseText } from "../_shared/bedrockConverse.ts";
import { getBedrockRuntimeClient } from "../_shared/awsClients.ts";

function corsHeaders(request?: Request | null) {
  return buildCorsHeaders(request, {
    envNames: ["APP_ALLOWED_ORIGINS", "PLAN_ASSISTANT_ALLOWED_ORIGINS"],
    methods: "POST, OPTIONS",
  });
}

function jsonResponse(data: unknown, status = 200, request?: Request | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, request);
  }

  const authHeader = request.headers.get("authorization") ||
    request.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse(
      { error: "unauthorized", message: "Token de autenticação ausente." },
      401,
      request,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user) {
    return jsonResponse(
      { error: "unauthorized", message: "Sessão inválida ou expirada." },
      401,
      request,
    );
  }

  const userId = authData.user.id;
  const serviceRoleClient = createServiceRoleClient();
  if (!serviceRoleClient) {
    return jsonResponse(
      { error: "server_misconfigured", message: "Configuração do servidor ausente." },
      500,
      request,
    );
  }
  const tenantId = await ensurePrimaryTenantId(serviceRoleClient, userId);

  // Parse multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return jsonResponse(
      {
        error: "invalid_form_data",
        message: "O corpo da requisição deve ser multipart/form-data.",
      },
      400,
      request,
    );
  }

  const audioEntry = formData.get("audio");
  if (!audioEntry || typeof audioEntry === "string") {
    return jsonResponse(
      {
        error: "missing_audio",
        message: "Arquivo de áudio não enviado no campo 'audio'.",
      },
      400,
      request,
    );
  }

  const channel = (formData.get("channel") as string) || "app_web";
  const clientPlatform = (formData.get("client_platform") as string) || "";
  const currentPath = (formData.get("current_path") as string) || "/dashboard";
  const currentEventId = (formData.get("current_event_id") as string) || null;
  const threadId = (formData.get("thread_id") as string) || null;
  const isAndroidClient =
    clientPlatform === "android" ||
    channel === "app_android" ||
    channel === "app_mobile";

  // 1. Validate audio size and MIME type
  const validation = validateVoiceInput({
    sizeBytes: audioEntry.size,
    mimeType: audioEntry.type,
  });

  if (!validation.valid) {
    return jsonResponse(
      { error: "invalid_audio_input", message: validation.error },
      400,
      request,
    );
  }

  // 2. Hourly Rate Limit Check (Defense in Depth / FinOps)
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count: hourlyUsageCount, error: countErr } = await serviceRoleClient
    .from("ai_voice_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  if (
    !countErr &&
    typeof hourlyUsageCount === "number" &&
    hourlyUsageCount >= DEFAULT_USER_HOURLY_VOICE_LIMIT
  ) {
    return jsonResponse(
      {
        error: "voice_hourly_limit_exceeded",
        message:
          `Você atingiu o limite de envio de áudios por hora (${DEFAULT_USER_HOURLY_VOICE_LIMIT} áudios). Aguarde alguns instantes ou continue por texto.`,
      },
      429,
      request,
    );
  }

  const audioBytes = new Uint8Array(await audioEntry.arrayBuffer());
  console.log(`[plan-assistant-voice] Recebido áudio de ${audioBytes.byteLength} bytes (tipo: ${audioEntry.type || 'desconhecido'}) de user=${userId}`);

  // 3. Speech-to-Text via Amazon Transcribe (Generates branded InboundAudioProof)
  let transcribeResult;
  try {
    transcribeResult = await transcribeAudio({
      bytes: audioBytes,
      mimeType: audioEntry.type,
      maxSeconds: 65,
    });
  } catch (sttError) {
    console.error("plan-assistant-voice: Falha no AWS Transcribe:", sttError);
    return jsonResponse(
      {
        error: "transcription_failed",
        message: "Não foi possível transcrever o áudio no momento. Tente novamente.",
      },
      502,
      request,
    );
  }

  const { text: userTranscript, durationSeconds, proof } = transcribeResult;
  const trimmedTranscript = userTranscript.trim();

  if (!trimmedTranscript) {
    return jsonResponse(
      {
        user_transcript: "",
        answer: "Não consegui identificar a fala no áudio enviado. Por favor, grave novamente em um ambiente com menos ruído.",
        reply_modality: "text",
        audio_data_url: null,
      },
      200,
      request,
    );
  }

  // 4. Generate Answer via Bedrock Converse (Nova Lite / Claude Haiku)
  const voiceSystemPrompt = [
    "Você é a Plan IA, assistente inteligente executiva do Painel Prime para assessores de eventos.",
    "O usuário enviou uma mensagem de voz que foi transcrita.",
    "Sua resposta será convertida em áudio neural e reproduzida para o usuário.",
    "Regras obrigatórias de resposta por voz:",
    "- Seja direta, acolhedora, concisa e executiva (no máximo 2 a 3 parágrafos curtos).",
    "- Escreva em português do Brasil com pontuação exemplar para naturalidade sonora.",
    "- Nunca use formatação markdown de tabelas, blocos de código ou listas exaustivas.",
    "- Responda com objetividade às dúvidas sobre a plataforma, eventos, convidados ou finanças.",
    isAndroidClient || channel.includes("app")
      ? [
          "DIRETRIZES DE NAVEGAÇÃO NO APLICATIVO ANDROID:",
          "- NUNCA cite rotas de URL como '/dashboard/...' ou caminhos web. No Android essas URLs não existem.",
          "- Use sempre verbos de toque: 'Toque na aba...', 'Toque no botão...', 'Selecione...'.",
          "- As 6 abas inferiores são: Início, Eventos, Clientes, Finanças, Fornec. e Mais.",
          "- Para cadastrar eventos: oriente o usuário a tocar na aba Eventos no menu inferior e depois no botão + Novo evento no canto superior direito.",
          "- Para seções de evento: oriente o usuário a tocar no evento e usar o seletor Navegar pelo evento ou as abas internas (Visão Geral, Checklist, Mesas, Padrinhos, Convidados, etc.).",
          "- Para configurações: toque na aba Mais e selecione Configurações.",
        ].join("\n")
      : "",
    currentEventId ? `Contexto do evento ativo: ${currentEventId}.` : "",
    currentPath && !(isAndroidClient || channel.includes("app")) ? `Tela atual do usuário: ${currentPath}.` : "",
  ].filter(Boolean).join("\n");

  let answer = "";
  try {
    answer = await converseText({
      modelProfile: "fast",
      system: voiceSystemPrompt,
      messages: [{ role: "user", content: trimmedTranscript }],
      temperature: 0.3,
      maxTokens: 500,
    });
  } catch (converseError) {
    console.error("plan-assistant-voice: Falha no Bedrock Converse:", converseError);
    answer = "Compreendi o seu áudio, mas tive uma oscilação momentânea ao consultar a inteligência. Por favor, pergunte novamente.";
  }

  // 5. Golden Rule Enforcement: Audio in -> Audio out
  const replyModality = resolveReplyModality("audio");
  let audioDataUrl: string | null = null;
  let audioBytesPolly: Uint8Array | null = null;

  if (replyModality === "audio") {
    try {
      audioBytesPolly = await synthesizeSpeech(proof, answer, {
        voiceId: "Camila",
        outputFormat: "mp3",
      });
      const base64Audio = uint8ArrayToBase64(audioBytesPolly);
      audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;
    } catch (ttsError) {
      console.error("plan-assistant-voice: Falha no AWS Polly:", ttsError);
      // Fallback gracioso para texto se o Polly falhar
    }
  }

  // 6. Record usage metrics (FinOps audit table)
  const sttCostUsd = (durationSeconds * 0.024) / 60;
  const ttsCostUsd = audioBytesPolly ? (answer.length * 16) / 1_000_000 : 0;

  void serviceRoleClient.from("ai_voice_usage").insert({
    tenant_id: tenantId,
    user_id: userId,
    channel: channel === "app_android" ? "app_android" : "app_web",
    stt_seconds: durationSeconds,
    tts_chars: answer.length,
    stt_cost_usd: sttCostUsd,
    tts_cost_usd: ttsCostUsd,
  }).then(({ error }) => {
    if (error) {
      console.error("plan-assistant-voice: Erro ao registrar ai_voice_usage:", error);
    }
  });

  // 7. Persist messages in plan_ai_messages if threadId is provided
  if (threadId) {
    void (async () => {
      try {
        await serviceRoleClient.from("plan_ai_messages").insert([
          {
            thread_id: threadId,
            tenant_id: tenantId,
            user_id: userId,
            role: "user",
            content: trimmedTranscript,
            input_modality: "audio",
            reply_modality: "text",
          },
          {
            thread_id: threadId,
            tenant_id: tenantId,
            user_id: userId,
            role: "assistant",
            content: answer,
            input_modality: "audio",
            reply_modality: audioDataUrl ? "audio" : "text",
            reply_audio_url: audioDataUrl,
            reply_audio_seconds: durationSeconds,
          },
        ]);
      } catch (dbErr) {
        console.error("plan-assistant-voice: Erro ao persistir histórico:", dbErr);
      }
    })();
  }

  return jsonResponse({
    user_transcript: trimmedTranscript,
    answer,
    reply_modality: audioDataUrl ? "audio" : "text",
    audio_data_url: audioDataUrl,
    duration_seconds: durationSeconds,
  }, 200, request);
});
