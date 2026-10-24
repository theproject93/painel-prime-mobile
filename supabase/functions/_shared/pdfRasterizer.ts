import { unzipSync } from 'npm:fflate@0.8.2';
import {
  createDownloadUrl,
  createR2Config,
  getObjectBytes,
  putObject,
  type R2Config,
} from './storageR2.ts';

export interface RasterizePdfParams {
  pdfBytes: Uint8Array;
  tenantId: string;
  documentId: string;
  revisionId: string;
  r2Config?: R2Config;
  stirlingUrl?: string;
  dpi?: number;
}

export interface RasterizePdfResult {
  pageCount: number;
  pageImageKeys: string[];
}

/**
 * Converte um PDF em páginas WebP de alta resolução (150 DPI) usando o Stirling PDF
 * e armazena os arquivos no Cloudflare R2 sob a chave canônica da revisão.
 */
export async function rasterizePdfPages(params: RasterizePdfParams): Promise<RasterizePdfResult> {
  const stirlingUrl =
    params.stirlingUrl ||
    Deno.env.get('STIRLING_API_URL') ||
    'http://100.87.120.82:8084';

  const form = new FormData();
  form.append('fileInput', new Blob([params.pdfBytes as BlobPart], { type: 'application/pdf' }), 'document.pdf');
  form.append('imageFormat', 'webp');
  form.append('singleOrMultiple', 'multiple');
  form.append('dpi', String(params.dpi ?? 150));

  let response: Response;
  try {
    response = await fetch(`${stirlingUrl.replace(/\/+$/, '')}/api/v1/convert/pdf/img`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
  } catch (fetchErr) {
    console.error('pdfRasterizer: failed to connect to Stirling PDF:', fetchErr);
    return { pageCount: 0, pageImageKeys: [] };
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`pdfRasterizer: Stirling returned HTTP ${response.status}: ${errText}`);
    return { pageCount: 0, pageImageKeys: [] };
  }

  const zipBytes = new Uint8Array(await response.arrayBuffer());
  if (zipBytes.byteLength < 100) {
    console.error('pdfRasterizer: ZIP payload too small');
    return { pageCount: 0, pageImageKeys: [] };
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch (unzipErr) {
    console.error('pdfRasterizer: Failed to unzip Stirling result:', unzipErr);
    return { pageCount: 0, pageImageKeys: [] };
  }

  // Filtrar apenas arquivos WebP
  const entries = Object.entries(unzipped).filter(([name]) =>
    name.toLowerCase().endsWith('.webp')
  );

  if (entries.length === 0) {
    console.warn('pdfRasterizer: No WebP files found in Stirling ZIP');
    return { pageCount: 0, pageImageKeys: [] };
  }

  // Ordenar naturalmente (ex: page_1.webp, page_2.webp, ..., page_10.webp)
  entries.sort(([a], [b]) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  const r2 = params.r2Config || createR2Config();
  const pageImageKeys: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const pageNumber = i + 1;
    const [, pageBytes] = entries[i];
    const objectKey = `crm/${params.tenantId}/documents/${params.documentId}/revisions/${params.revisionId}/pages/page_${pageNumber}.webp`;

    await putObject({
      config: r2,
      bucket: r2.privateBucket,
      objectKey,
      contentType: 'image/webp',
      body: pageBytes,
    });

    pageImageKeys.push(objectKey);
  }

  return {
    pageCount: pageImageKeys.length,
    pageImageKeys,
  };
}

/**
 * Garante que as páginas WebP existam para uma revisão.
 * Se já existirem, apenas retorna as URLs assinadas.
 * Se ainda não foram geradas, executa a rasterização sob demanda e atualiza o banco.
 */
export async function getOrRasterizeRevisionPages(params: {
  serviceClient: any;
  revisionId: string;
  tenantId: string;
  documentId: string;
  canonicalPdfFileId: string | null | undefined;
  r2Config?: R2Config;
  ttlSeconds?: number;
}): Promise<{ pageUrls: string[]; pageCount: number }> {
  if (!params.canonicalPdfFileId) {
    return { pageUrls: [], pageCount: 0 };
  }

  const r2 = params.r2Config || createR2Config();
  const ttl = Math.min(params.ttlSeconds ?? 600, 600);

  // 1. Verificar se a revisão já possui as páginas prontas
  const { data: revision } = await params.serviceClient
    .from('crm_document_revisions')
    .select('id, page_count, pages_status, page_image_keys')
    .eq('id', params.revisionId)
    .maybeSingle();

  if (
    revision?.pages_status === 'ready' &&
    Array.isArray(revision.page_image_keys) &&
    revision.page_image_keys.length > 0
  ) {
    const pageUrls: string[] = [];
    for (const key of revision.page_image_keys) {
      const url = await createDownloadUrl({
        config: r2,
        bucket: r2.privateBucket,
        objectKey: key,
        originalName: key.split('/').pop() || 'page.webp',
        contentType: 'image/webp',
        ttlSeconds: ttl,
      });
      pageUrls.push(url);
    }
    return { pageUrls, pageCount: pageUrls.length };
  }

  // 2. Se não estiver pronto, buscar o PDF original no R2
  const { data: fileRow } = await params.serviceClient
    .from('stored_files')
    .select('bucket, object_key, original_name, content_type')
    .eq('id', params.canonicalPdfFileId)
    .maybeSingle();

  if (!fileRow) {
    return { pageUrls: [], pageCount: 0 };
  }

  try {
    const pdfBytes = await getObjectBytes({
      config: r2,
      bucket: fileRow.bucket,
      objectKey: fileRow.object_key,
    });

    if (!pdfBytes || pdfBytes.byteLength === 0) {
      return { pageUrls: [], pageCount: 0 };
    }

    const { pageCount, pageImageKeys } = await rasterizePdfPages({
      pdfBytes,
      tenantId: params.tenantId,
      documentId: params.documentId,
      revisionId: params.revisionId,
      r2Config: r2,
    });

    if (pageCount > 0 && pageImageKeys.length > 0) {
      await params.serviceClient
        .from('crm_document_revisions')
        .update({
          page_count: pageCount,
          pages_status: 'ready',
          page_image_keys: pageImageKeys,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.revisionId);

      const pageUrls: string[] = [];
      for (const key of pageImageKeys) {
        const url = await createDownloadUrl({
          config: r2,
          bucket: r2.privateBucket,
          objectKey: key,
          originalName: key.split('/').pop() || 'page.webp',
          contentType: 'image/webp',
          ttlSeconds: ttl,
        });
        pageUrls.push(url);
      }
      return { pageUrls, pageCount };
    }
  } catch (err) {
    console.error('getOrRasterizeRevisionPages: Error rasterizing on demand:', err);
  }

  return { pageUrls: [], pageCount: 0 };
}
