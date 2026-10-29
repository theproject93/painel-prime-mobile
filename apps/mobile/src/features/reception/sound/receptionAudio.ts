import type { CheckInState } from '../types/receptionTypes';

/**
 * Utilitário de feedback sonoro do Portaria Prime.
 * Gera tons harmônicos e de alerta nativos para cada um dos 5 estados de badge.
 * Executa de forma segura e não bloqueante em qualquer ambiente.
 */

// Resolução segura de Platform e Audio para execução universal (Hermes, Android, iOS e Test Runners)
let isWebPlatform = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require('react-native');
  isWebPlatform = rn.Platform?.OS === 'web';
} catch {
  isWebPlatform = typeof window !== 'undefined';
}

function getAudioModule(): typeof import('expo-av').Audio | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoAv = require('expo-av');
    return expoAv.Audio || null;
  } catch {
    return null;
  }
}

// Gera sintetizador PCM WAV de 8-bit mono de 8000Hz em base64
export function generateToneWav(
  frequencies: Array<{ freq: number; durationMs: number; decay?: boolean }>,
  sampleRate = 8000,
): string {
  const totalSamples = frequencies.reduce(
    (acc, cur) => acc + Math.floor((cur.durationMs / 1000) * sampleRate),
    0,
  );
  const buffer = new Uint8Array(44 + totalSamples);

  // RIFF Chunk
  buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46; // "RIFF"
  const fileSize = 36 + totalSamples;
  buffer[4] = fileSize & 0xff;
  buffer[5] = (fileSize >> 8) & 0xff;
  buffer[6] = (fileSize >> 16) & 0xff;
  buffer[7] = (fileSize >> 24) & 0xff;
  buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45; // "WAVE"

  // fmt sub-chunk
  buffer[12] = 0x66; buffer[13] = 0x6d; buffer[14] = 0x74; buffer[15] = 0x20; // "fmt "
  buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0; // Subchunk1Size (16 for PCM)
  buffer[20] = 1; buffer[21] = 0; // AudioFormat (1 = PCM)
  buffer[22] = 1; buffer[23] = 0; // NumChannels (1 = Mono)
  buffer[24] = sampleRate & 0xff;
  buffer[25] = (sampleRate >> 8) & 0xff;
  buffer[26] = (sampleRate >> 16) & 0xff;
  buffer[27] = (sampleRate >> 24) & 0xff; // SampleRate
  buffer[28] = sampleRate & 0xff;
  buffer[29] = (sampleRate >> 8) & 0xff;
  buffer[30] = (sampleRate >> 16) & 0xff;
  buffer[31] = (sampleRate >> 24) & 0xff; // ByteRate
  buffer[32] = 1; buffer[33] = 0; // BlockAlign (1 byte)
  buffer[34] = 8; buffer[35] = 0; // BitsPerSample (8 bits)

  // data sub-chunk
  buffer[36] = 0x64; buffer[37] = 0x61; buffer[38] = 0x74; buffer[39] = 0x61; // "data"
  buffer[40] = totalSamples & 0xff;
  buffer[41] = (totalSamples >> 8) & 0xff;
  buffer[42] = (totalSamples >> 16) & 0xff;
  buffer[43] = (totalSamples >> 24) & 0xff;

  let offset = 44;
  for (const part of frequencies) {
    const samplesCount = Math.floor((part.durationMs / 1000) * sampleRate);
    const angularFreq = (2 * Math.PI * part.freq) / sampleRate;

    for (let i = 0; i < samplesCount; i++) {
      const envelope = part.decay ? Math.max(0, 1 - i / samplesCount) : 1;
      const sine = Math.sin(i * angularFreq);
      // Converte [-1, 1] para uint8 [0, 255] centrado em 128
      const val = Math.floor(128 + sine * 110 * envelope);
      buffer[offset++] = Math.max(0, Math.min(255, val));
    }
  }

  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  const base64 = encodeBase64(binary);
  return `data:audio/wav;base64,${base64}`;
}

function encodeBase64(binary: string): string {
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  const globalObj = globalThis as {
    Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } };
  };
  if (globalObj.Buffer) {
    return globalObj.Buffer.from(binary, 'binary').toString('base64');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < binary.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < binary.length ? chars[c & 63] : '=';
  }
  return result;
}

// Tons sintetizados para cada estado da Portaria Prime
const AUDIO_DATA_URIS: Record<CheckInState, string> = {
  // 🟢 Verde: Chime harmônico ascendente (C6 -> E6: 1046Hz -> 1318Hz)
  confirmed: generateToneWav([
    { freq: 1046, durationMs: 80, decay: false },
    { freq: 1318, durationMs: 160, decay: true },
  ]),

  // 🟡 Amarelo: Toque sutil local (D5: 587Hz)
  pending: generateToneWav([
    { freq: 587, durationMs: 90, decay: true },
  ]),

  // 🟡 Amarelo in_flight: Toque sutil local
  in_flight: generateToneWav([
    { freq: 587, durationMs: 90, decay: true },
  ]),

  // 🟠 Laranja: Alerta duplo (A4 -> F#4: 440Hz -> 370Hz)
  already_checked_in: generateToneWav([
    { freq: 440, durationMs: 70, decay: true },
    { freq: 0, durationMs: 25, decay: false }, // pausa
    { freq: 370, durationMs: 110, decay: true },
  ]),

  // 🔴 Vermelho: Tom grave de rejeição / erro (180Hz com harmônico rápido)
  rejected: generateToneWav([
    { freq: 180, durationMs: 180, decay: true },
  ]),

  // 🟣 Roxo: Alerta triplo de atenção manual (440Hz -> 660Hz -> 440Hz)
  needs_attention: generateToneWav([
    { freq: 440, durationMs: 60, decay: true },
    { freq: 660, durationMs: 70, decay: true },
    { freq: 440, durationMs: 90, decay: true },
  ]),
};

let audioModeConfigured = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeConfigured || isWebPlatform) return;
  try {
    const Audio = getAudioModule();
    if (Audio?.setAudioModeAsync) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      audioModeConfigured = true;
    }
  } catch {
    // Falha silenciosa
  }
}

/**
 * Toca o som correspondente ao estado de check-in na portaria.
 */
export async function playReceptionSound(state: CheckInState): Promise<void> {
  try {
    await ensureAudioMode();
    const uri = AUDIO_DATA_URIS[state];
    if (!uri) return;

    const Audio = getAudioModule();
    if (!Audio?.Sound) return;

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1.0 },
    );

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // Falha silenciosa em ambientes sem áudio/emuladores desativados
  }
}

export const receptionAudio = {
  play: playReceptionSound,
  getAudioDataUri: (state: CheckInState) => AUDIO_DATA_URIS[state],
};
