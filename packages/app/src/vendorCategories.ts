export const VENDOR_CATEGORY_OPTIONS = [
  'Assessoria/Cerimonial',
  'Espaço/Local',
  'Buffet/Gastronomia',
  'Bar/Bebidas',
  'Bolo/Doces',
  'Decoração/Floral',
  'Foto',
  'Vídeo',
  'Música/DJ/Banda',
  'Som/Iluminação/Estrutura',
  'Locação/Mobiliário',
  'Beleza/Dia da noiva',
  'Trajes/Acessórios',
  'Convites/Papelaria',
  'Celebrante',
  'Transporte/Logística',
  'Lembranças/Personalizados',
  'Entretenimento/Experiências',
  'Conteúdo/Redes sociais',
  'Outros',
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORY_OPTIONS)[number];

export const DEFAULT_VENDOR_CATEGORY: VendorCategory = 'Outros';
export const SELF_VENDOR_CATEGORY: VendorCategory = 'Assessoria/Cerimonial';

function normalizeEvidence(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const DIRECT_ALIASES: Record<string, VendorCategory> = {
  assessoria: 'Assessoria/Cerimonial',
  'assessoria/cerimonial': 'Assessoria/Cerimonial',
  'assessoria/cerimonialista': 'Assessoria/Cerimonial',
  cerimonial: 'Assessoria/Cerimonial',
  cerimonialista: 'Assessoria/Cerimonial',
  banda: 'Música/DJ/Banda',
  dj: 'Música/DJ/Banda',
  musica: 'Música/DJ/Banda',
  musical: 'Música/DJ/Banda',
  buffet: 'Buffet/Gastronomia',
  gastronomia: 'Buffet/Gastronomia',
  bar: 'Bar/Bebidas',
  bebidas: 'Bar/Bebidas',
  doces: 'Bolo/Doces',
  bolo: 'Bolo/Doces',
  decoracao: 'Decoração/Floral',
  floral: 'Decoração/Floral',
  fotografia: 'Foto',
  fotografo: 'Foto',
  foto: 'Foto',
  filmagem: 'Vídeo',
  video: 'Vídeo',
  espaco: 'Espaço/Local',
  local: 'Espaço/Local',
  som: 'Som/Iluminação/Estrutura',
  iluminacao: 'Som/Iluminação/Estrutura',
  estrutura: 'Som/Iluminação/Estrutura',
  locacao: 'Locação/Mobiliário',
  mobiliario: 'Locação/Mobiliário',
  beleza: 'Beleza/Dia da noiva',
  traje: 'Trajes/Acessórios',
  acessorios: 'Trajes/Acessórios',
  convites: 'Convites/Papelaria',
  papelaria: 'Convites/Papelaria',
  celebrante: 'Celebrante',
  transporte: 'Transporte/Logística',
  logistica: 'Transporte/Logística',
  lembrancas: 'Lembranças/Personalizados',
  personalizados: 'Lembranças/Personalizados',
  entretenimento: 'Entretenimento/Experiências',
  experiencias: 'Entretenimento/Experiências',
  conteudo: 'Conteúdo/Redes sociais',
  redes: 'Conteúdo/Redes sociais',
  outros: 'Outros',
};

const CATEGORY_RULES: Array<{ label: VendorCategory; pattern: RegExp }> = [
  {
    label: 'Assessoria/Cerimonial',
    pattern: /(assessoria|cerimonial|cerimonialista|coordena(c|ç)ao|mestres de cerim(ô|o)nia)/,
  },
  {
    label: 'Espaço/Local',
    pattern: /(espaco|espaço|local|sitio|sítio|fazenda|chacara|chá cara|sal[aã]o|venue)/,
  },
  {
    label: 'Buffet/Gastronomia',
    pattern: /(buffet|gastronomia|jantar|coquetel|catering|finger food|menu|ilha gastr)/,
  },
  {
    label: 'Bar/Bebidas',
    pattern: /(bar|bebidas|drink|coquetelaria|bartender|open bar)/,
  },
  {
    label: 'Bolo/Doces',
    pattern: /(bolo|doces|bem-casado|brownie|brigadeiro|confeitaria|sobremesa)/,
  },
  {
    label: 'Decoração/Floral',
    pattern: /(decorac|decoraç|flor|floral|cenografia|ambienta(c|ç)ao|arranjo)/,
  },
  {
    label: 'Foto',
    pattern: /(fotografia|fotografo|fotógrafo|ensaio|album|álbum|making of foto)/,
  },
  {
    label: 'Vídeo',
    pattern: /(video|vídeo|filmagem|teaser|after movie|capta(c|ç)ao audiovisual)/,
  },
  {
    label: 'Música/DJ/Banda',
    pattern: /(banda|dj|m[uú]sica|show|apresenta(c|ç)[aã]o musical|voz e viol[aã]o|cantor)/,
  },
  {
    label: 'Som/Iluminação/Estrutura',
    pattern: /(som|ilumina(c|ç)[aã]o|painel de led|gerador|estrutura|palco|grid|projecao|projeção)/,
  },
  {
    label: 'Locação/Mobiliário',
    pattern: /(loca(c|ç)[aã]o|mobili[aá]rio|cadeira|mesa|lounges|toalha|acervo)/,
  },
  {
    label: 'Beleza/Dia da noiva',
    pattern: /(beleza|maquiagem|make|penteado|cabelo|dia da noiva|barbeiro)/,
  },
  {
    label: 'Trajes/Acessórios',
    pattern: /(traje|vestido|terno|acess[oó]rio|sapato|grinalda|joia|joia)/,
  },
  {
    label: 'Convites/Papelaria',
    pattern: /(convite|papelaria|menu impresso|identidade visual|caligrafia|papel)/,
  },
  {
    label: 'Celebrante',
    pattern: /(celebrante|celebra(c|ç)[aã]o|mestre de cerim[oô]nia religioso|oficiante)/,
  },
  {
    label: 'Transporte/Logística',
    pattern: /(transporte|transfer|motorista|van|onibus|ônibus|logistica|logística)/,
  },
  {
    label: 'Lembranças/Personalizados',
    pattern: /(lembran(c|ç)a|personalizado|brinde|caixa convite|kit|mimo)/,
  },
  {
    label: 'Entretenimento/Experiências',
    pattern: /(cabine|totem|experi[eê]ncia|atra(c|ç)[aã]o|personagem|animacao|animação|show extra)/,
  },
  {
    label: 'Conteúdo/Redes sociais',
    pattern: /(conte[uú]do|social media|redes sociais|cobertura ao vivo|criador de conte[uú]do)/,
  },
];

export function normalizeVendorCategory(
  rawCategory: string | null | undefined,
  context: Array<string | null | undefined> = []
): VendorCategory {
  const normalizedCategory = normalizeEvidence(rawCategory ?? '');
  if (normalizedCategory && DIRECT_ALIASES[normalizedCategory]) {
    return DIRECT_ALIASES[normalizedCategory];
  }

  const evidence = normalizeEvidence(
    [rawCategory ?? '', ...context.map((value) => value ?? '')].join(' ')
  );

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(evidence)) {
      return rule.label;
    }
  }

  return DEFAULT_VENDOR_CATEGORY;
}

export function isVendorCategoryOther(value: string | null | undefined) {
  return normalizeVendorCategory(value) === DEFAULT_VENDOR_CATEGORY;
}

export function isSelfVendorCategory(value: string | null | undefined) {
  return normalizeVendorCategory(value) === SELF_VENDOR_CATEGORY;
}
