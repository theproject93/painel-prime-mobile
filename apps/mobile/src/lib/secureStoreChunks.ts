export const SECURE_STORE_CHUNK_SIZE = 1800;

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function splitSecureValue(value: string, maxBytes = SECURE_STORE_CHUNK_SIZE): string[] {
  if (maxBytes < 1) throw new Error('maxBytes must be positive');
  if (value.length === 0) return [''];

  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (characterBytes > maxBytes) throw new Error('maxBytes cannot contain one UTF-8 character');
    if (chunk && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
