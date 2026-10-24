import { signOnlyOfficeToken } from './onlyofficeJwt.ts';
import { buildOnlyOfficeJwtHeaders } from './onlyofficeCallback.ts';

interface ConversionResponse {
  endConvert?: unknown;
  error?: unknown;
  fileType?: unknown;
  fileUrl?: unknown;
  percent?: unknown;
}

export interface OnlyOfficeConversionOptions {
  baseUrl: string;
  documentUrl: string;
  documentKey: string;
  title: string;
  jwtSecret: string;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  maxPolls?: number;
  pollIntervalMs?: number;
  maxPdfBytes?: number;
}

const encoder = new TextEncoder();
const PDF_SIGNATURE = encoder.encode('%PDF-');

function assertPdf(bytes: Uint8Array, contentType: string, maxPdfBytes: number): void {
  if (bytes.byteLength < PDF_SIGNATURE.byteLength || bytes.byteLength > maxPdfBytes) {
    throw new Error('onlyoffice_conversion_pdf_invalid');
  }
  if (contentType && contentType !== 'application/pdf' && contentType !== 'application/octet-stream') {
    throw new Error('onlyoffice_conversion_pdf_invalid');
  }
  for (let index = 0; index < PDF_SIGNATURE.byteLength; index += 1) {
    if (bytes[index] !== PDF_SIGNATURE[index]) throw new Error('onlyoffice_conversion_pdf_invalid');
  }
}

function assertResultUrl(value: unknown, baseUrl: URL): URL {
  if (typeof value !== 'string') throw new Error('onlyoffice_conversion_url_missing');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('onlyoffice_conversion_url_invalid');
  }
  if (url.protocol !== 'https:' || url.origin !== baseUrl.origin) {
    throw new Error('onlyoffice_conversion_url_forbidden');
  }
  return url;
}

async function hash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function convertOnlyOfficeFileToPdf(filetype: 'docx' | 'html', options: OnlyOfficeConversionOptions) {
  const baseUrl = new URL(options.baseUrl.replace(/\/+$/u, ''));
  if (baseUrl.protocol !== 'https:') throw new Error('onlyoffice_conversion_base_url_invalid');
  const maxPolls = options.maxPolls ?? 20;
  if (!Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 60) {
    throw new Error('onlyoffice_conversion_polls_invalid');
  }
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const requestPayload = {
    async: true,
    filetype,
    key: options.documentKey,
    outputtype: 'pdf',
    title: options.title,
    url: options.documentUrl,
    region: 'pt-BR',
    documentLayout: { isPrint: true, drawPlaceHolders: false, drawFormHighlight: false },
  };
  const token = await signOnlyOfficeToken(requestPayload, options.jwtSecret, { ttlSeconds: 300 });
  const converterUrl = new URL('/converter', baseUrl);
  converterUrl.searchParams.set('shardkey', options.documentKey);
  let conversion: ConversionResponse | null = null;

  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    const headers = buildOnlyOfficeJwtHeaders(token);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    const response = await fetcher(converterUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...requestPayload, token }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`onlyoffice_conversion_http_${response.status}`);
    conversion = await response.json().catch(() => null) as ConversionResponse | null;
    if (!conversion) throw new Error('onlyoffice_conversion_response_invalid');
    if (typeof conversion.error === 'number') {
      throw new Error(`onlyoffice_conversion_error_${conversion.error}`);
    }
    if (conversion.endConvert === true) break;
    if (attempt < maxPolls) await sleep(options.pollIntervalMs ?? 1_500);
  }

  if (conversion?.endConvert !== true) throw new Error('onlyoffice_conversion_timeout');
  const resultUrl = assertResultUrl(conversion.fileUrl, baseUrl);
  const result = await fetcher(resultUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!result.ok) throw new Error(`onlyoffice_conversion_download_http_${result.status}`);
  const maxPdfBytes = options.maxPdfBytes ?? 25 * 1024 * 1024;
  const contentLength = Number(result.headers.get('content-length') ?? 0);
  if (contentLength > maxPdfBytes) throw new Error('onlyoffice_conversion_pdf_invalid');
  const bytes = new Uint8Array(await result.arrayBuffer());
  assertPdf(bytes, result.headers.get('content-type')?.split(';')[0]?.trim() ?? '', maxPdfBytes);
  return {
    bytes,
    sha256: await hash(bytes),
    percent: typeof conversion.percent === 'number' ? conversion.percent : 100,
  };
}

export async function convertOnlyOfficeDocxToPdf(options: OnlyOfficeConversionOptions) {
  return await convertOnlyOfficeFileToPdf('docx', options);
}

export type ConvertOnlyOfficeHtmlOptions = OnlyOfficeConversionOptions;

export async function convertOnlyOfficeHtmlToPdf(options: ConvertOnlyOfficeHtmlOptions) {
  return await convertOnlyOfficeFileToPdf('html', options);
}
