import { S3Client } from 'npm:@aws-sdk/client-s3@3.750.0';
import {
  buildSignatureCanonicalPayload,
  callDocumentWorker,
  inlineRemoteDocumentImages,
  interpolateDocumentHtml,
  isValidCpf,
  sha256Hex,
  type DocumentVariables,
} from './crmDocumentAutomation.ts';
import { convertOnlyOfficeHtmlToPdf } from './onlyofficeConversion.ts';

function documentVariables(overrides: Partial<DocumentVariables> = {}): DocumentVariables {
  return {
    nome_cliente: '',
    email_cliente: '',
    telefone_cliente: '',
    cpf_cliente: '',
    tipo_evento: '',
    data_evento: '',
    valor_total: '',
    escopo_servico: '',
    condicoes_pagamento: '',
    condicoes_cancelamento: '',
    foro: '',
    notas: '',
    nome_assessoria: '',
    logo_url: '',
    ...overrides,
  };
}

Deno.test('isValidCpf rejects invalid CPFs and accepts a valid value', () => {
  if (isValidCpf('111.111.111-11')) throw new Error('repeated CPF accepted');
  if (isValidCpf('123')) throw new Error('short CPF accepted');
  if (!isValidCpf('529.982.247-25')) throw new Error('valid CPF rejected');
});

Deno.test('interpolateDocumentHtml escapes variable values', () => {
  const html = interpolateDocumentHtml('<p>{{nome_cliente}}</p>', documentVariables({
    nome_cliente: '<script>alert(1)</script>',
  }));
  if (html !== '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>') {
    throw new Error(`unexpected interpolation: ${html}`);
  }
});

Deno.test('interpolateDocumentHtml accepts accented legacy placeholders', () => {
  const html = interpolateDocumentHtml(
    '<p>{{escopo_serviço}}</p><p>{{condições_pagamento}}</p><p>{{ condições-cancelamento }}</p>',
    documentVariables({
      escopo_servico: 'Escopo ok',
      condicoes_pagamento: 'Pagamento ok',
      condicoes_cancelamento: 'Cancelamento ok',
    })
  );

  if (
    !html.includes('Escopo ok') ||
    !html.includes('Pagamento ok') ||
    !html.includes('Cancelamento ok')
  ) {
    throw new Error(`accented placeholders were not normalized: ${html}`);
  }
});

Deno.test('interpolateDocumentHtml supports trusted rendered content slots', () => {
  const html = interpolateDocumentHtml(
    '<section>{{conteudo_documento}}</section><p>{{nome_cliente}}</p>',
    documentVariables({
      conteudo_documento: '<p>Escopo<br />Pagamento</p>',
      nome_cliente: '<b>Cliente</b>',
    }),
    { rawKeys: ['conteudo_documento'] }
  );
  if (!html.includes('<section><p>Escopo<br />Pagamento</p></section>')) {
    throw new Error(`trusted content was not preserved: ${html}`);
  }
  if (!html.includes('&lt;b&gt;Cliente&lt;/b&gt;')) {
    throw new Error(`regular variables were not escaped: ${html}`);
  }
});

Deno.test('inlineRemoteDocumentImages embeds allowed R2 images only', async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = '';
  globalThis.fetch = ((input: string | URL | Request) => {
    fetchedUrl = String(input);
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          'content-type': 'image/png',
          'content-length': '3',
        },
      })
    );
  }) as typeof fetch;

  try {
    const html =
      '<img src="https://abc.r2.cloudflarestorage.com/header.png?x=1&amp;y=2" /><img src="https://example.com/logo.png" />';
    const result = await inlineRemoteDocumentImages(html);

    if (fetchedUrl !== 'https://abc.r2.cloudflarestorage.com/header.png?x=1&y=2') {
      throw new Error(`unexpected fetch url: ${fetchedUrl}`);
    }
    if (!result.includes('src="data:image/png;base64,AQID"')) {
      throw new Error(`R2 image was not embedded: ${result}`);
    }
    if (!result.includes('https://example.com/logo.png')) {
      throw new Error('non-R2 image should remain unchanged');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('signature canonical payload and sha256 are deterministic', async () => {
  const payload = buildSignatureCanonicalPayload({
    contractDocumentId: 'contract-1',
    pdfFileId: 'pdf-1',
    cpf: '52998224725',
    email: 'cliente@example.com',
    ip: '203.0.113.10',
    userAgent: 'UA',
    signedAtIso: '2026-06-02T12:00:00.000Z',
  });
  const first = await sha256Hex(payload);
  const second = await sha256Hex(payload);
  if (first !== second || first.length !== 64) {
    throw new Error('sha256 hash is not deterministic');
  }
});

Deno.test('convertOnlyOfficeHtmlToPdf converts html to pdf and asserts %PDF- format', async () => {
  const requests: Request[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    if (request.url.includes('/converter')) {
      return Promise.resolve(Response.json({
        endConvert: true,
        fileType: 'pdf',
        fileUrl: 'https://office.painelprime.com.br/cache/documento.pdf',
        percent: 100,
      }));
    }
    return Promise.resolve(new Response('%PDF-1.7\nconteúdo html renderizado em pdf\n%%EOF', {
      headers: { 'Content-Type': 'application/pdf' },
    }));
  };

  const result = await convertOnlyOfficeHtmlToPdf({
    baseUrl: 'https://office.painelprime.com.br',
    documentUrl: 'https://r2.example.test/temp/html-render/123.html?sign=abc',
    documentKey: 'doc-key-12345',
    title: 'orcamento.html',
    jwtSecret: 'segredo-onlyoffice-com-mais-de-trinta-e-dois-bytes',
    fetcher,
  });

  if (!new TextDecoder().decode(result.bytes).startsWith('%PDF-')) {
    throw new Error('PDF output does not start with %PDF-');
  }
  if (result.sha256.length !== 64) {
    throw new Error('sha256 invalid length');
  }
  const body = await requests[0].clone().json();
  if (body.filetype !== 'html' || body.outputtype !== 'pdf') {
    throw new Error(`expected filetype html and outputtype pdf, got ${JSON.stringify(body)}`);
  }
});

Deno.test('callDocumentWorker converts HTML via OnlyOffice when env is present', async () => {
  const previousBaseUrl = Deno.env.get('ONLYOFFICE_BASE_URL');
  const previousSecret = Deno.env.get('ONLYOFFICE_JWT_SECRET');
  try {
    Deno.env.set('ONLYOFFICE_BASE_URL', 'https://office.painelprime.com.br');
    Deno.env.set('ONLYOFFICE_JWT_SECRET', 'segredo-onlyoffice-com-mais-de-trinta-e-dois-bytes');

    const uploadedObjects = new Map<string, { contentType: string; bodyLength: number }>();
    const deletedObjects: string[] = [];

    const mockClient = new S3Client({
      region: 'auto',
      endpoint: 'https://dummy.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: 'dummy-access',
        secretAccessKey: 'dummy-secret',
      },
    });

    mockClient.send = ((command: any) => {
      const name = command.constructor?.name ?? '';
      if (name === 'DeleteObjectCommand') {
        deletedObjects.push(command.input.Key);
        return Promise.resolve({});
      }
      if (name === 'PutObjectCommand' || command.input?.Body) {
        uploadedObjects.set(command.input.Key, {
          contentType: command.input.ContentType,
          bodyLength: command.input.Body?.length ?? 0,
        });
        return Promise.resolve({});
      }
      return Promise.resolve({});
    }) as any;

    const mockR2Config = {
      client: mockClient,
      privateBucket: 'painelprime-private',
      publicBucket: 'painelprime-public',
      publicBaseUrl: 'https://cdn.example.com',
      uploadTtlSeconds: 300,
      downloadTtlSeconds: 300,
    };

    const fetcher: typeof fetch = (input, init) => {
      const request = new Request(input, init);
      if (request.url.includes('/converter')) {
        return Promise.resolve(Response.json({
          endConvert: true,
          fileType: 'pdf',
          fileUrl: 'https://office.painelprime.com.br/cache/rendered.pdf',
          percent: 100,
        }));
      }
      return Promise.resolve(new Response('%PDF-1.7\nconteudo-pdf\n%%EOF', {
        headers: { 'Content-Type': 'application/pdf' },
      }));
    };

    const result = await callDocumentWorker({
      endpoint: '/documents/render-pdf',
      html: '<html><body><h1>Orçamento</h1></body></html>',
      objectKey: 'clients/user-1/documents/doc-1.pdf',
      title: 'Orçamento - João',
      metadata: { clientId: 'client-123' },
    }, {
      fetcher,
      r2Config: mockR2Config,
    });

    if (result.bucket !== 'painelprime-private') {
      throw new Error(`unexpected bucket: ${result.bucket}`);
    }
    if (result.objectKey !== 'clients/user-1/documents/doc-1.pdf') {
      throw new Error(`unexpected objectKey: ${result.objectKey}`);
    }
    if (result.byteSize <= 0) {
      throw new Error(`unexpected byteSize: ${result.byteSize}`);
    }
    if (!uploadedObjects.has('clients/user-1/documents/doc-1.pdf')) {
      throw new Error('final PDF was not written to objectKey in R2');
    }
    if (deletedObjects.length !== 1 || !deletedObjects[0].startsWith('temp/html-render/')) {
      throw new Error(`temporary HTML was not cleaned up: ${JSON.stringify(deletedObjects)}`);
    }
  } finally {
    if (previousBaseUrl) Deno.env.set('ONLYOFFICE_BASE_URL', previousBaseUrl);
    else Deno.env.delete('ONLYOFFICE_BASE_URL');
    if (previousSecret) Deno.env.set('ONLYOFFICE_JWT_SECRET', previousSecret);
    else Deno.env.delete('ONLYOFFICE_JWT_SECRET');
  }
});

Deno.test('callDocumentWorker falls back to legacy contract worker when ONLYOFFICE_BASE_URL is missing', async () => {
  const previousBaseUrl = Deno.env.get('ONLYOFFICE_BASE_URL');
  const previousWorkerUrl = Deno.env.get('PLAN_IA_CONTRACT_WORKER_URL');
  const previousWorkerToken = Deno.env.get('PLAN_IA_CONTRACT_WORKER_TOKEN');
  try {
    Deno.env.delete('ONLYOFFICE_BASE_URL');
    Deno.env.set('PLAN_IA_CONTRACT_WORKER_URL', 'https://legacy-worker.example.test');
    Deno.env.set('PLAN_IA_CONTRACT_WORKER_TOKEN', 'token-legado-123');

    let calledUrl = '';
    const fetcher: typeof fetch = (input) => {
      calledUrl = String(input);
      return Promise.resolve(Response.json({
        byte_size: 1024,
        bucket: 'legacy-bucket',
        object_key: 'clients/doc.pdf',
      }));
    };

    const result = await callDocumentWorker({
      endpoint: '/documents/render-pdf',
      html: '<html>corpo</html>',
      objectKey: 'clients/doc.pdf',
      title: 'Doc',
    }, { fetcher });

    if (!calledUrl.startsWith('https://legacy-worker.example.test/documents/render-pdf')) {
      throw new Error(`expected call to legacy worker URL, got ${calledUrl}`);
    }
    if (result.bucket !== 'legacy-bucket' || result.byteSize !== 1024) {
      throw new Error(`unexpected result from legacy worker: ${JSON.stringify(result)}`);
    }
  } finally {
    if (previousBaseUrl) Deno.env.set('ONLYOFFICE_BASE_URL', previousBaseUrl);
    else Deno.env.delete('ONLYOFFICE_BASE_URL');
    if (previousWorkerUrl) Deno.env.set('PLAN_IA_CONTRACT_WORKER_URL', previousWorkerUrl);
    else Deno.env.delete('PLAN_IA_CONTRACT_WORKER_URL');
    if (previousWorkerToken) Deno.env.set('PLAN_IA_CONTRACT_WORKER_TOKEN', previousWorkerToken);
    else Deno.env.delete('PLAN_IA_CONTRACT_WORKER_TOKEN');
  }
});
