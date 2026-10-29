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
 * Implementação pura e auditada de SHA-256 (FIPS 180-4) com suporte completo a UTF-8.
 * Totalmente autocontida, síncrona e livre de dependências externas ou módulos Node.js,
 * garantindo compatibilidade estrita com Hermes, Android, iOS e bundlers Metro.
 */
export function sha256Pure(str: string): string {
  // 1. Codificação UTF-8
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    } else {
      // Par substituto (surrogate pair)
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    }
  }

  // 2. Constantes K de SHA-256
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // 3. Preenchimento (Padding)
  const bitLength = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) {
    utf8.push(0);
  }
  const hi = Math.floor(bitLength / 0x100000000);
  const lo = bitLength >>> 0;
  utf8.push(
    (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
  );

  // 4. Processamento dos blocos de 512 bits (64 bytes)
  const W = new Int32Array(64);
  for (let i = 0; i < utf8.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const idx = i + t * 4;
      W[t] = ((utf8[idx] << 24) | (utf8[idx + 1] << 16) | (utf8[idx + 2] << 8) | utf8[idx + 3]) | 0;
    }
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const w2 = W[t - 2];
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let t = 0; t < 64; t++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + W[t]) | 0;
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

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  // 5. Formatação hexadecimal lowercase (64 chars)
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += (H[i] >>> 0).toString(16).padStart(8, '0');
  }
  return hex.toLowerCase();
}

/**
 * Calcula o hash síncrono da string canônica de forma 100% determinística.
 */
export function computeCanonicalPayloadHashSync(input: CanonicalPayloadInput): string {
  const canonicalString = buildCanonicalString(input);
  return sha256Pure(canonicalString);
}

/**
 * Calcula o hash assíncrono da string canônica.
 */
export async function computeCanonicalPayloadHash(input: CanonicalPayloadInput): Promise<string> {
  return computeCanonicalPayloadHashSync(input);
}
