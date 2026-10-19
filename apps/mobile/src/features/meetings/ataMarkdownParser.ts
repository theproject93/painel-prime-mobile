export type AtaInfoItem = {
  label: string;
  value: string;
};

export type AtaTable = {
  headers: string[];
  rows: string[][];
};

export type AtaTopicItem =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; prefix?: string; text: string }
  | { type: 'table'; table: AtaTable };

export type AtaTopic = {
  title: string;
  items: AtaTopicItem[];
};

export type AtaActionItem = {
  action: string;
  responsible: string;
  deadline: string;
};

export type ParsedAta = {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: string[];
  structuredActionItems: AtaActionItem[];
  generalInfo: AtaInfoItem[];
  summaryParagraphs: string[];
  topics: AtaTopic[];
  closingNotes: string[];
};

function normalizeText(value: string): string {
  return value
    .replace(new RegExp('\\u00C3\\u00A3', 'g'), 'ã')
    .replace(new RegExp('\\u00C3\\u00B5', 'g'), 'õ')
    .replace(new RegExp('\\u00C3\\u00B3', 'g'), 'ó')
    .replace(new RegExp('\\u00C3\\u00A1', 'g'), 'á')
    .replace(new RegExp('\\u00C3\\u00A9', 'g'), 'é')
    .replace(new RegExp('\\u00C3\\u00AD', 'g'), 'í')
    .replace(new RegExp('\\u00C3\\u00AA', 'g'), 'ê')
    .replace(new RegExp('\\u00C3\\u00A7', 'g'), 'ç')
    .replace(new RegExp('\\u00C3\\u0082', 'g'), 'Â')
    .replace(/\[speaker_\d+\]/gi, '')
    .replace(/speaker_\d+/gi, 'Participante')
    .trim();
}

function plainLine(value: string): string {
  return value
    .replace(/^[-*]\s+/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

function cleanMarkdownFormatting(text: string): string {
  return text
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

function isTableDivider(line: string): boolean {
  return /^\|?(\s*:?-+:?\s*\|?)+$/.test(line.trim());
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') && !trimmed.endsWith('|')) return null;
  const parts = trimmed.split('|').slice(1, -1).map((c) => c.trim());
  return parts.length > 0 ? parts : null;
}

function sectionName(heading: string): string {
  return heading
    .replace(/^\d+\.\s*/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseAtaMarkdown(rawMarkdown: string): ParsedAta {
  if (!rawMarkdown) {
    return {
      title: 'Ata de Reunião',
      summary: '',
      decisions: [],
      actionItems: [],
      structuredActionItems: [],
      generalInfo: [],
      summaryParagraphs: [],
      topics: [],
      closingNotes: [],
    };
  }

  const clean = normalizeText(rawMarkdown);
  let title = 'Ata de Reunião';
  const summaryParts: string[] = [];
  const summaryParagraphs: string[] = [];
  const generalInfo: AtaInfoItem[] = [];
  const topics: AtaTopic[] = [];
  const decisions: string[] = [];
  const actionItems: string[] = [];
  const structuredActionItems: AtaActionItem[] = [];
  const closingNotes: string[] = [];

  let currentSection:
    | 'info'
    | 'summary'
    | 'topics'
    | 'decisions'
    | 'actionItems'
    | 'closing' = 'summary';
  let currentTopic: AtaTopic | null = null;
  let activeTable: AtaTable | null = null;

  const lines = clean.split('\n');

  function flushTableToCurrentContext() {
    if (!activeTable) return;
    if (activeTable.rows.length > 0) {
      if (currentSection === 'actionItems') {
        for (const row of activeTable.rows) {
          const action = cleanMarkdownFormatting(row[0] || '');
          const responsible = cleanMarkdownFormatting(row[1] || 'Equipe');
          const deadline = cleanMarkdownFormatting(row[2] || 'A definir');
          if (action && !/^a[çc][ãa]o/i.test(action)) {
            structuredActionItems.push({ action, responsible, deadline });
            actionItems.push(`${action} — Responsável: ${responsible} (${deadline})`);
          }
        }
      } else if (currentTopic) {
        currentTopic.items.push({ type: 'table', table: activeTable });
      }
    }
    activeTable = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushTableToCurrentContext();
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      title = plainLine(trimmed.replace(/^#\s+/, ''));
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushTableToCurrentContext();
      continue;
    }

    if (/^(\*{0,2})observa[çc][õo]es finais:?/i.test(trimmed)) {
      flushTableToCurrentContext();
      currentSection = 'closing';
      continue;
    }

    const heading = trimmed.match(/^##\s+(.+)$/)?.[1];
    if (heading) {
      flushTableToCurrentContext();
      const name = sectionName(heading);
      if (name.startsWith('informacoes gerais') || name.startsWith('informac')) {
        currentSection = 'info';
      } else if (name.startsWith('resumo')) {
        currentSection = 'summary';
      } else if (name.startsWith('pautas') || name.startsWith('alinhamento')) {
        currentSection = 'topics';
      } else if (name.startsWith('decisoes') || name.startsWith('decis')) {
        currentSection = 'decisions';
      } else if (
        name.startsWith('proximos passos') ||
        name.startsWith('proximo') ||
        name.startsWith('plano')
      ) {
        currentSection = 'actionItems';
      } else if (name.startsWith('observac')) {
        currentSection = 'closing';
      } else {
        currentSection = 'summary';
      }
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushTableToCurrentContext();
      currentSection = 'topics';
      currentTopic = {
        title: cleanMarkdownFormatting(h3Match[1].trim()),
        items: [],
      };
      topics.push(currentTopic);
      continue;
    }

    const tableCells = parseTableRow(trimmed);
    if (tableCells) {
      if (isTableDivider(trimmed)) {
        continue;
      }
      if (!activeTable) {
        activeTable = {
          headers: tableCells.map((c) => cleanMarkdownFormatting(c)),
          rows: [],
        };
      } else {
        activeTable.rows.push(tableCells.map((c) => cleanMarkdownFormatting(c)));
      }
      continue;
    } else {
      flushTableToCurrentContext();
    }

    const content = plainLine(trimmed);
    if (!content) continue;

    if (currentSection === 'info') {
      const match = trimmed.match(/^[-*]?\s*\*\*([^:]+):\*\*\s*(.+)$/);
      if (match) {
        generalInfo.push({ label: match[1].trim(), value: match[2].trim() });
      } else {
        generalInfo.push({ label: 'Nota', value: content });
      }
    } else if (currentSection === 'summary') {
      summaryParts.push(content);
      summaryParagraphs.push(content);
    } else if (currentSection === 'topics') {
      summaryParts.push(content);

      if (!currentTopic) {
        currentTopic = { title: 'Alinhamentos Gerais', items: [] };
        topics.push(currentTopic);
      }
      const kvMatch = trimmed.match(/^[-*]?\s*(?:\*\*)?([^:]+?)(?:\*\*)?:\s*(.+)$/);
      if (kvMatch && kvMatch[1].length < 50 && !kvMatch[1].includes('.')) {
        currentTopic.items.push({
          type: 'bullet',
          prefix: cleanMarkdownFormatting(kvMatch[1]),
          text: cleanMarkdownFormatting(kvMatch[2]),
        });
      } else {
        currentTopic.items.push({
          type: 'paragraph',
          text: content,
        });
      }
    } else if (currentSection === 'decisions') {
      if (!/^nenhuma decis/i.test(content) && !/^---+$/.test(content)) {
        decisions.push(content);
      }
    } else if (currentSection === 'actionItems') {
      if (!/^nenhum pr[oó]ximo/i.test(content) && !/^---+$/.test(content)) {
        actionItems.push(content);
        const matchResp = content.match(
          /(.+?)\s*[-—]\s*(?:Respons[aá]vel:\s*)?([^(—]+?)(?:\s*\((?:Prazo:\s*)?([^)]+)\)|\s*[-—]\s*Prazo:\s*(.+))?$/i
        );
        if (matchResp && matchResp[2]) {
          structuredActionItems.push({
            action: matchResp[1].trim(),
            responsible: matchResp[2].trim(),
            deadline: (matchResp[3] || matchResp[4] || 'A definir').trim(),
          });
        } else {
          structuredActionItems.push({
            action: content,
            responsible: 'Equipe',
            deadline: 'A definir',
          });
        }
      }
    } else if (currentSection === 'closing') {
      if (!/^---+$/.test(content)) closingNotes.push(content);
    }
  }

  flushTableToCurrentContext();

  return {
    title,
    summary: summaryParts.join(' '),
    decisions,
    actionItems,
    structuredActionItems,
    generalInfo,
    summaryParagraphs,
    topics,
    closingNotes,
  };
}
