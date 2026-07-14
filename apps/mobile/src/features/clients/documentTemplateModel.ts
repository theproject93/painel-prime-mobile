export type MobileTemplateKind = 'quote' | 'contract';
export type MobileTemplateBlockType = 'intro' | 'summary' | 'scope' | 'services' | 'investment' | 'terms' | 'clause' | 'notes' | 'signatures';

export type MobileTemplateBlock = {
  id: string;
  type: MobileTemplateBlockType;
  title: string;
  content: string;
  enabled: boolean;
};

export type MobileDocumentTemplate = {
  format: 'visual_blocks';
  version: 1;
  kind: MobileTemplateKind;
  style: {
    accentColor: string;
    headerAlign: 'left' | 'center';
    fontFamily: string;
    pageMargin: 'compact' | 'standard' | 'wide';
    footerText: string;
  };
  blocks: MobileTemplateBlock[];
};

const BLOCK_TYPES = new Set<MobileTemplateBlockType>(['intro', 'summary', 'scope', 'services', 'investment', 'terms', 'clause', 'notes', 'signatures']);

export function createDefaultMobileDocumentTemplate(kind: MobileTemplateKind): MobileDocumentTemplate {
  const common: MobileTemplateBlock[] = [
    { id: 'intro', type: 'intro', title: 'Boas-vindas', content: 'Olá {{nome_cliente}}, preparamos este documento para o seu evento.', enabled: true },
    { id: 'scope', type: 'scope', title: 'O que está incluído', content: 'Descreva aqui os serviços e diferenciais da sua assessoria.', enabled: true },
  ];
  return {
    format: 'visual_blocks',
    version: 1,
    kind,
    style: { accentColor: '#B58A2A', headerAlign: 'left', fontFamily: 'Inter, Arial, sans-serif', pageMargin: 'standard', footerText: 'Documento emitido pelo Painel Prime.' },
    blocks: kind === 'quote'
      ? [...common, { id: 'investment', type: 'investment', title: 'Investimento', content: 'Valor proposto: {{valor_total}}', enabled: true }]
      : [...common, { id: 'terms', type: 'terms', title: 'Condições', content: 'Descreva prazos, condições e responsabilidades.', enabled: true }, { id: 'signatures', type: 'signatures', title: 'Assinaturas', content: '{{nome_cliente}} e {{nome_assessoria}}', enabled: true }],
  };
}

export function normalizeMobileDocumentTemplate(raw: unknown, kind: MobileTemplateKind): MobileDocumentTemplate {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch {
      const fallback = createDefaultMobileDocumentTemplate(kind);
      if (raw.trim()) fallback.blocks[0] = { ...fallback.blocks[0], content: raw.trim() };
      return fallback;
    }
  }
  if (!value || typeof value !== 'object') return createDefaultMobileDocumentTemplate(kind);
  const row = value as Record<string, unknown>;
  const styleRow = row.style && typeof row.style === 'object' ? row.style as Record<string, unknown> : {};
  const blocks = Array.isArray(row.blocks) ? row.blocks.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const block = item as Record<string, unknown>;
    const type = BLOCK_TYPES.has(block.type as MobileTemplateBlockType) ? block.type as MobileTemplateBlockType : null;
    if (!type) return [];
    return [{
      id: typeof block.id === 'string' && block.id.trim() ? block.id.trim() : `${type}-${index}`,
      type,
      title: typeof block.title === 'string' ? block.title.trim() : '',
      content: typeof block.content === 'string' ? block.content : '',
      enabled: block.enabled !== false,
    }];
  }) : [];
  return {
    format: 'visual_blocks',
    version: 1,
    kind,
    style: {
      accentColor: typeof styleRow.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(styleRow.accentColor) ? styleRow.accentColor : '#B58A2A',
      headerAlign: styleRow.headerAlign === 'center' ? 'center' : 'left',
      fontFamily: typeof styleRow.fontFamily === 'string' && styleRow.fontFamily.trim() ? styleRow.fontFamily : 'Inter, Arial, sans-serif',
      pageMargin: styleRow.pageMargin === 'compact' || styleRow.pageMargin === 'wide' ? styleRow.pageMargin : 'standard',
      footerText: typeof styleRow.footerText === 'string' ? styleRow.footerText : 'Documento emitido pelo Painel Prime.',
    },
    blocks: blocks.length > 0 ? blocks : createDefaultMobileDocumentTemplate(kind).blocks,
  };
}

export function serializeMobileDocumentTemplate(template: MobileDocumentTemplate) {
  return JSON.stringify(normalizeMobileDocumentTemplate(template, template.kind));
}
