import { useId, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { getPrivateFileDownloadUrl } from '../../lib/r2FileStorage';
import { colors, radii, shadows } from '../../theme/colors';
import { parseAtaMarkdown } from './ataMarkdownParser';
import type { Meeting } from './meetingModel';

type Props = {
  visible: boolean;
  onClose: () => void;
  meeting: Meeting;
  rawMarkdown?: string | null;
  pdfUrl?: string | null;
};

export function AtaDocumentModal({
  visible,
  onClose,
  meeting,
  rawMarkdown,
  pdfUrl,
}: Props) {
  const id = useId();
  const gradId = `ata-grad-${id}`;

  const markdownContent =
    rawMarkdown ??
    meeting.meeting_minutes?.[0]?.summary_markdown ??
    '# Ata de Reunião\n\nNenhuma ata disponível para esta reunião.';

  const resolvedPdfUrl =
    pdfUrl ?? meeting.meeting_minutes?.[0]?.pdf_url ?? null;

  const parsed = useMemo(() => parseAtaMarkdown(markdownContent), [markdownContent]);

  const displayActionItems = useMemo(() => {
    if (parsed.structuredActionItems && parsed.structuredActionItems.length > 0) {
      return parsed.structuredActionItems;
    }
    return parsed.actionItems.map((item) => ({
      action: item,
      responsible: 'Equipe',
      deadline: 'A definir',
    }));
  }, [parsed.structuredActionItems, parsed.actionItems]);

  const formattedDate = useMemo(() => {
    const base = meeting.scheduled_at || meeting.created_at;
    if (!base) return 'Data não especificada';
    return new Date(base).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [meeting.scheduled_at, meeting.created_at]);

  const handleShareWhatsApp = () => {
    const text = `📌 *Ata da Reunião: ${meeting.title}*\n\n📝 *Resumo Executivo:*\n${
      parsed.summary || 'Ata disponível no Painel Prime.'
    }\n\n✅ *Decisões Registradas:*\n${
      parsed.decisions.length > 0
        ? parsed.decisions.map((d) => `• ${d}`).join('\n')
        : 'Nenhuma decisão formal.'
    }\n\n👉 *Próximos Passos:*\n${
      displayActionItems.length > 0
        ? displayActionItems.map((a) => `• ${a.action} (${a.responsible} — ${a.deadline})`).join('\n')
        : 'Nenhum próximo passo.'
    }\n\n_Painel Prime — Gestão Executiva de Eventos_`;

    const encoded = encodeURIComponent(text);
    const url = `whatsapp://send?text=${encoded}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        return Linking.openURL(`https://api.whatsapp.com/send?text=${encoded}`);
      })
      .catch(() => {
        Alert.alert('Aviso', 'Não foi possível abrir o WhatsApp para compartilhar.');
      });
  };

  const handleShareNative = async () => {
    try {
      await Share.share({
        title: `Ata: ${meeting.title}`,
        message: `📌 *Ata Executiva: ${meeting.title}*\n\n${markdownContent}\n\nPainel Prime`,
      });
    } catch {
      // Ignored
    }
  };

  const handleOpenPdf = async () => {
    if (!resolvedPdfUrl) {
      Alert.alert('PDF Indisponível', 'O documento PDF desta ata ainda está sendo processado.');
      return;
    }

    try {
      let targetUrl = resolvedPdfUrl;
      if (!targetUrl.startsWith('http')) {
        targetUrl = await getPrivateFileDownloadUrl(resolvedPdfUrl);
      }
      await WebBrowser.openBrowserAsync(targetUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível abrir o arquivo PDF.';
      Alert.alert('Erro', msg);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, shadows.elevated]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={styles.badgeWrap}>
                  <Svg width={74} height={20} style={StyleSheet.absoluteFill}>
                    <Defs>
                      <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={colors.gold600} />
                        <Stop offset="1" stopColor={colors.gold700} />
                      </LinearGradient>
                    </Defs>
                    <Rect width={74} height={20} rx={4} ry={4} fill={`url(#${gradId})`} />
                  </Svg>
                  <Text style={styles.badgeText}>Ata Plan IA</Text>
                </View>
                <Text style={styles.dateText}>{formattedDate}</Text>
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {meeting.title}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          {/* Scrollable Document Content */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Section 1: Resumo Executivo */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text" size={16} color={colors.gold700} />
                <Text style={styles.sectionTitle}>1. Resumo Executivo</Text>
              </View>
              {parsed.summaryParagraphs.length > 0 ? (
                parsed.summaryParagraphs.map((para, idx) => (
                  <Text key={idx} style={styles.paragraphText}>
                    {para}
                  </Text>
                ))
              ) : (
                <Text style={styles.paragraphText}>
                  {parsed.summary || 'Resumo da reunião em processamento pela inteligência artificial.'}
                </Text>
              )}
            </View>

            {/* Section 2: Pautas Discutidas */}
            {parsed.topics.length > 0 ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="list" size={16} color={colors.gold700} />
                  <Text style={styles.sectionTitle}>2. Pautas & Alinhamentos</Text>
                </View>
                {parsed.topics.map((topic, topicIdx) => (
                  <View key={topicIdx} style={styles.topicBox}>
                    <Text style={styles.topicTitle}>{topic.title}</Text>
                    {topic.items.map((item, itemIdx) => {
                      if (item.type === 'bullet') {
                        return (
                          <View key={itemIdx} style={styles.bulletRow}>
                            <Text style={styles.bulletDot}>•</Text>
                            <Text style={styles.bulletText}>
                              {item.prefix ? (
                                <Text style={styles.bulletPrefix}>{item.prefix}: </Text>
                              ) : null}
                              {item.text}
                            </Text>
                          </View>
                        );
                      }
                      if (item.type === 'table') {
                        return (
                          <View key={itemIdx} style={styles.tableBox}>
                            <View style={styles.tableHeaderRow}>
                              {item.table.headers.map((h, hIdx) => (
                                <Text key={hIdx} style={styles.tableHeaderCell}>
                                  {h}
                                </Text>
                              ))}
                            </View>
                            {item.table.rows.map((r, rIdx) => (
                              <View key={rIdx} style={styles.tableRow}>
                                {r.map((c, cIdx) => (
                                  <Text key={cIdx} style={styles.tableCell}>
                                    {c}
                                  </Text>
                                ))}
                              </View>
                            ))}
                          </View>
                        );
                      }
                      return (
                        <Text key={itemIdx} style={styles.paragraphText}>
                          {item.text}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Section 3: Decisões Tomadas */}
            {parsed.decisions.length > 0 ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success600} />
                  <Text style={styles.sectionTitle}>3. Decisões Tomadas</Text>
                </View>
                {parsed.decisions.map((dec, idx) => (
                  <View key={idx} style={styles.decisionRow}>
                    <Ionicons name="checkmark" size={16} color={colors.success600} />
                    <Text style={styles.decisionText}>{dec}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Section 4: Próximos Passos & Responsáveis */}
            {displayActionItems.length > 0 ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="arrow-forward-circle" size={16} color={colors.royal600} />
                  <Text style={styles.sectionTitle}>4. Próximos Passos & Responsáveis</Text>
                </View>
                {displayActionItems.map((item, idx) => (
                  <View key={idx} style={styles.actionCard}>
                    <Text style={styles.actionItemTitle}>{item.action}</Text>
                    <View style={styles.actionItemMeta}>
                      <View style={styles.responsibleChip}>
                        <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.responsibleText}>{item.responsible}</Text>
                      </View>
                      <View style={styles.deadlineChip}>
                        <Ionicons name="calendar-outline" size={12} color={colors.gold700} />
                        <Text style={styles.deadlineText}>{item.deadline}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Closing Notes */}
            {parsed.closingNotes.length > 0 ? (
              <View style={styles.closingBox}>
                <Text style={styles.closingTitle}>Observações Finais:</Text>
                {parsed.closingNotes.map((note, idx) => (
                  <Text key={idx} style={styles.closingText}>
                    {note}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {/* Actions Footer */}
          <View style={styles.footer}>
            <Pressable onPress={handleShareWhatsApp} style={styles.actionBtnWhatsApp}>
              <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnTextWhatsApp}>WhatsApp</Text>
            </Pressable>

            {resolvedPdfUrl ? (
              <Pressable onPress={handleOpenPdf} style={styles.actionBtnPdf}>
                <Ionicons name="document-text-outline" size={16} color={colors.text} />
                <Text style={styles.actionBtnTextPdf}>PDF</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={handleShareNative} style={styles.actionBtnShare}>
              <Ionicons name="share-social-outline" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 17, 21, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badgeWrap: {
    width: 74,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 11,
    color: colors.mutedText,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radii.full,
    backgroundColor: '#F1F5F9',
  },
  body: {
    padding: 16,
    backgroundColor: colors.background,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paragraphText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 8,
  },
  topicBox: {
    marginBottom: 10,
  },
  topicTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gold700,
    marginRight: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  bulletPrefix: {
    fontWeight: '700',
    color: colors.text,
  },
  tableBox: {
    marginVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 6,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tableCell: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
  },
  decisionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: radii.md,
  },
  decisionText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
    fontWeight: '500',
  },
  actionCard: {
    backgroundColor: '#FAF7F1',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  actionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  actionItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  responsibleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  responsibleText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deadlineText: {
    fontSize: 11,
    color: colors.gold700,
    fontWeight: '600',
  },
  closingBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 16,
  },
  closingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  closingText: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtnWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
  },
  actionBtnTextWhatsApp: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF7F1',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
  },
  actionBtnTextPdf: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  actionBtnShare: {
    backgroundColor: '#FAF7F1',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
