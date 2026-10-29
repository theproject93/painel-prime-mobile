/**
 * Portaria Prime Nativo - Hash Canônico Determinístico
 *
 * Calcula o SHA-256 normalizado e invariante à ordenação do array de convidados.
 * Satisfaz AC #1: determinismo absoluto indiferente à ordem dos IDs enviados.
 */

export interface CanonicalPayloadInput {
  clientScanId?: string;
  client_scan_id?: string;
  scannedQrToken?: string | null;
  scanned_qr_token?: string | null;
  scannedGuestId?: string | null;
  scanned_guest_id?: string | null;
  confirmedGuestIds?: string[];
  confirmed_guest_ids?: string[];
  eventId?: string;
  event_id?: string;
}

/**
 * Monta a string canônica normalizada:
 * `<clientScanId>|<scannedQrToken>|<scannedGuestId>|<sortedIdsJson>`
 * onde todos os identificadores são colocados em minúsculas, com trim(),
 * e os IDs de convidados confirmados são deduplicados, sanitizados e ordenados
 * lexicograficamente, serializados em JSON array.
 * Paridade exata com PostgreSQL calculate_reception_payload_hash.
 */
export function buildCanonicalString(input: CanonicalPayloadInput): string {
  const clientScanId = String(input.clientScanId || input.client_scan_id || '')
    .toLowerCase()
    .trim();
  const scannedQrToken = String(input.scannedQrToken || input.scanned_qr_token || '')
    .toLowerCase()
    .trim();
  const scannedGuestId = String(input.scannedGuestId || input.scanned_guest_id || '')
    .toLowerCase()
    .trim();

  const rawGuestIds = input.confirmedGuestIds || input.confirmed_guest_ids || [];
  const distinctSet = new Set<string>();
  for (const id of rawGuestIds) {
    if (id !== null && id !== undefined) {
      const normalized = String(id).toLowerCase().trim();
      if (normalized.length > 0) {
        distinctSet.add(normalized);
      }
    }
  }

  const sortedDistinctIds = Array.from(distinctSet).sort();
  const sortedIdsJson = JSON.stringify(sortedDistinctIds);

  return `${clientScanId}|${scannedQrToken}|${scannedGuestId}|${sortedIdsJson}`;
}

/**
 * Implementação pura de SHA-256 (FIPS 180-4) para compatibilidade universal:
 * Expo, Node.js (test runner / Vitest) e navegadores sem dependências nativas.
 */
function sha256Pure(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty as 'length'] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 300; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < ascii[lengthProperty as 'length']; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash.slice(0);

    for (i = 16; i < 64; i++) {
      const s0 =
        ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^
        ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^
        (w[i - 15] >>> 3);
      const s1 =
        ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^
        ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^
        (w[i - 2] >>> 10);
      w[i] = (((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0)) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((h + s1) | 0) + ((ch + k[i]) | 0) + w[i]) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result.toLowerCase();
}

/**
 * Calcula o hash síncrono da string canônica.
 */
export function computeCanonicalPayloadHashSync(input: CanonicalPayloadInput): string {
  const canonicalString = buildCanonicalString(input);

  // Se Node.js estiver disponível (test runner)
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require('crypto') as {
        createHash: (alg: string) => { update: (data: string) => { digest: (enc: string) => string } };
      };
      return nodeCrypto.createHash('sha256').update(canonicalString).digest('hex').toLowerCase();
    }
  } catch {
    // Prossegue para o fallback puro
  }

  return sha256Pure(canonicalString);
}

/**
 * Calcula o hash assíncrono usando expo-crypto quando presente,
 * com fallback transparente para Node.js crypto ou pure SHA-256.
 */
export async function computeCanonicalPayloadHash(input: CanonicalPayloadInput): Promise<string> {
  const canonicalString = buildCanonicalString(input);

  try {
    // Tenta expo-crypto dinamicamente se estiver no ambiente React Native / Expo
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoCrypto = require('expo-crypto') as {
      digestStringAsync?: (
        algorithm: string,
        data: string,
        options?: { encoding?: string },
      ) => Promise<string>;
      CryptoDigestAlgorithm?: { SHA256: string };
    };

    if (ExpoCrypto?.digestStringAsync) {
      const digest = await ExpoCrypto.digestStringAsync(
        ExpoCrypto.CryptoDigestAlgorithm?.SHA256 || 'SHA-256',
        canonicalString,
      );
      return digest.toLowerCase();
    }
  } catch {
    // Ambiente sem Expo nativo
  }

  // Tenta Web Crypto (browsers modernos / Hermes com globalThis.crypto)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(canonicalString);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    } catch {
      // Fallback
    }
  }

  return computeCanonicalPayloadHashSync(input);
}
