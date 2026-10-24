import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type PlanMarkdownMessageProps = {
  content: string;
  isUser?: boolean;
};

const STATUS_TRANSLATIONS: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  draft: 'Rascunho',
  active: 'Ativo',
  completed: 'Realizado',
  overdue: 'Atrasado',
};

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

export function sanitizeLeakedToolNames(text: string): string {
  if (!text) return '';
  return text
    // Strip pointer to tool names, e.g.: "→ get_client_contracts" or "-> `get_event_meetings`"
    .replace(/\s*(?:→|->|:)\s*`?(?:get|create|update|delete|check|search|notify|export|checkin|calculate|register)_[a-z0-9_]+`?/gi, '')
    // Strip parenthetical tool mentions, e.g.: "( get_client_contracts )"
    .replace(/\(\s*`?(?:get|create|update|delete|check|search|notify|export|checkin|calculate|register)_[a-z0-9_]+`?\s*\)/gi, '')
    // Strip standalone tool identifiers
    .replace(/`?(?:get|create|update|delete|check|search|notify|export|checkin|calculate|register)_[a-z0-9_]{3,35}`?/gi, (match) => {
      return match.includes('_') ? '' : match;
    });
}

function renderInline(text: string, isUser: boolean): React.ReactNode[] {
  // Matches **bold**, `code`, *italic*, _italic_
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <Text
          key={index}
          style={[styles.inlineBold, isUser && styles.userBold]}
        >
          {inner}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <Text
          key={index}
          style={[styles.inlineCode, isUser ? styles.userCode : styles.botCode]}
        >
          {inner}
        </Text>
      );
    }
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      const inner = part.slice(1, -1);
      return (
        <Text key={index} style={[styles.inlineItalic, isUser && styles.userItalic]}>
          {inner}
        </Text>
      );
    }
    return (
      <Text key={index} style={[styles.inlineNormal, isUser && styles.userNormal]}>
        {part}
      </Text>
    );
  });
}

function isTableBlock(lines: string[]): boolean {
  const tableLines = lines.filter((l) => l.trim().length > 0);
  return tableLines.length >= 2 && tableLines.every((l) => l.trim().startsWith('|'));
}

function parseTable(lines: string[]) {
  const tableLines = lines.filter((l) => l.trim().length > 0);
  const rows = tableLines.map((l) => {
    let clean = l.trim();
    if (clean.startsWith('|')) clean = clean.slice(1);
    if (clean.endsWith('|')) clean = clean.slice(0, -1);
    return clean.split('|').map((c) => c.trim());
  });

  const rawHeaders = rows[0] || [];
  const isSeparator = rows[1]?.every((c) => /^[-:\s]+$/.test(c));
  const rawDataRows = isSeparator ? rows.slice(2) : rows.slice(1);

  // Filter out any ID / UUID column
  const keepIndices = rawHeaders
    .map((h, i) => {
      const isIdCol =
        /^id$/i.test(h) ||
        /^uuid$/i.test(h) ||
        rawDataRows.some((row) => isUuid(row[i] || ''));
      return isIdCol ? -1 : i;
    })
    .filter((i) => i !== -1);

  const headers = keepIndices.map((i) => rawHeaders[i] || '');
  const dataRows = rawDataRows.map((row) =>
    keepIndices.map((i) => {
      const val = row[i] || '';
      return STATUS_TRANSLATIONS[val.toLowerCase()] || val;
    })
  );

  return { headers, dataRows };
}

export const PlanMarkdownMessage = memo(function PlanMarkdownMessage({
  content,
  isUser = false,
}: PlanMarkdownMessageProps) {
  if (!content) return null;

  const displayContent = isUser ? content : sanitizeLeakedToolNames(content);
  const blocks = displayContent.split(/\n{2,}/g);

  return (
    <View style={styles.container}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/);

        // 1. Table Block
        if (isTableBlock(lines)) {
          const { headers, dataRows } = parseTable(lines);
          if (headers.length > 0) {
            return (
              <ScrollView
                key={blockIndex}
                horizontal
                showsHorizontalScrollIndicator
                style={styles.tableScroll}
                contentContainerStyle={styles.tableContainer}
              >
                <View style={[styles.tableFrame, isUser && styles.tableFrameUser]}>
                  {/* Header Row */}
                  <View style={[styles.tableRow, styles.tableHeaderRow]}>
                    {headers.map((header, hIdx) => (
                      <View key={hIdx} style={styles.tableCell}>
                        <Text style={[styles.tableHeaderText, isUser && styles.userBold]}>
                          {header}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {/* Data Rows */}
                  {dataRows.map((row, rIdx) => (
                    <View
                      key={rIdx}
                      style={[
                        styles.tableRow,
                        rIdx % 2 === 1 && styles.tableRowEven,
                        rIdx === dataRows.length - 1 && styles.tableRowLast,
                      ]}
                    >
                      {row.map((cell, cIdx) => (
                        <View key={cIdx} style={styles.tableCell}>
                          <Text style={[styles.tableCellText, isUser && styles.userNormal]}>
                            {cell}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          }
        }

        // 2. List Block
        const isListBlock =
          lines.length > 0 &&
          lines.every((l) => {
            const trimmed = l.trim();
            return !trimmed || /^(✓|✔|\d+\.|[-•*])\s+/.test(trimmed);
          });

        if (isListBlock) {
          return (
            <View key={blockIndex} style={styles.listContainer}>
              {lines.map((line, lineIndex) => {
                const trimmed = line.trim();
                if (!trimmed) return null;

                // Numbered: "1. text"
                const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
                if (numberMatch) {
                  return (
                    <View key={lineIndex} style={styles.listItemRow}>
                      <View style={[styles.numberBadge, isUser ? styles.numberBadgeUser : styles.numberBadgeBot]}>
                        <Text style={[styles.numberBadgeText, isUser ? styles.numberBadgeTextUser : styles.numberBadgeTextBot]}>
                          {numberMatch[1]}
                        </Text>
                      </View>
                      <Text style={[styles.listItemContent, isUser && styles.userNormal]}>
                        {renderInline(numberMatch[2] || '', isUser)}
                      </Text>
                    </View>
                  );
                }

                // Checkmark: "✓ text" or "✔ text"
                const checkMatch = trimmed.match(/^(✓|✔)\s+(.*)$/);
                if (checkMatch) {
                  return (
                    <View key={lineIndex} style={styles.listItemRow}>
                      <Text style={[styles.checkIcon, isUser ? styles.checkIconUser : styles.checkIconBot]}>
                        ✓
                      </Text>
                      <Text style={[styles.listItemContent, isUser && styles.userNormal]}>
                        {renderInline(checkMatch[2] || '', isUser)}
                      </Text>
                    </View>
                  );
                }

                // Bullet: "- text", "• text", "* text"
                const bulletMatch = trimmed.match(/^([-•*])\s+(.*)$/);
                if (bulletMatch) {
                  return (
                    <View key={lineIndex} style={styles.listItemRow}>
                      <Text style={[styles.bulletIcon, isUser ? styles.bulletIconUser : styles.bulletIconBot]}>
                        •
                      </Text>
                      <Text style={[styles.listItemContent, isUser && styles.userNormal]}>
                        {renderInline(bulletMatch[2] || '', isUser)}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View key={lineIndex} style={styles.listItemRow}>
                    <Text style={[styles.listItemContent, isUser && styles.userNormal]}>
                      {renderInline(line, isUser)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // 3. Regular Paragraph
        return (
          <Text key={blockIndex} style={[styles.paragraph, isUser && styles.userParagraph]}>
            {lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && '\n'}
                {renderInline(line, isUser)}
              </React.Fragment>
            ))}
          </Text>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  userParagraph: {
    color: '#FFFFFF',
  },
  inlineNormal: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  userNormal: {
    color: '#FFFFFF',
  },
  inlineBold: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: colors.text,
  },
  userBold: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inlineItalic: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    color: colors.text,
  },
  userItalic: {
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  inlineCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  botCode: {
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    color: colors.primaryStrong,
  },
  userCode: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#FFFFFF',
  },
  listContainer: {
    gap: 4,
    marginVertical: 2,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  listItemContent: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  numberBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numberBadgeBot: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  numberBadgeUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  numberBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  numberBadgeTextBot: {
    color: colors.primaryStrong,
  },
  numberBadgeTextUser: {
    color: '#FFFFFF',
  },
  checkIcon: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  checkIconBot: {
    color: '#16A34A',
  },
  checkIconUser: {
    color: '#FFFFFF',
  },
  bulletIcon: {
    fontSize: 15,
    lineHeight: 19,
    marginTop: -1,
  },
  bulletIconBot: {
    color: colors.primary,
  },
  bulletIconUser: {
    color: '#FFFFFF',
  },
  tableScroll: {
    marginVertical: 4,
  },
  tableContainer: {
    paddingVertical: 2,
  },
  tableFrame: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  tableFrameUser: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  tableRowEven: {
    backgroundColor: 'rgba(0, 0, 0, 0.015)',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedText,
    textTransform: 'uppercase',
  },
  tableCellText: {
    fontSize: 12,
    color: colors.text,
  },
});
