import { useId } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii, shadows } from '../../theme/colors';
import {
  attireStatusLabel,
  roleLabel,
  sideLabel,
  specialRoleLabel,
  type EventPadrinhoItem,
  type PadrinhoPairGroup,
} from './padrinhosModel';

type Props = {
  pair: PadrinhoPairGroup;
  isDebutante?: boolean;
  onEdit: (item: EventPadrinhoItem) => void;
  onDelete: (id: string, name: string) => void;
  onPairCompanion: (primaryItem: EventPadrinhoItem) => void;
  onOpenPlanIa: (item: EventPadrinhoItem) => void;
};

export function PadrinhoPairCard({
  pair,
  isDebutante = false,
  onEdit,
  onDelete,
  onPairCompanion,
  onOpenPlanIa,
}: Props) {
  const id = useId();
  const gradId = `pair-grad-${id}`;

  const openWhatsApp = (phone?: string | null, name?: string) => {
    if (!phone) {
      Alert.alert('Sem telefone', 'Este integrante não possui telefone cadastrado.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        return Linking.openURL(`https://wa.me/${cleanPhone}`);
      })
      .catch(() => {
        Alert.alert('Aviso', `Não foi possível abrir o WhatsApp para ${name || 'o contato'}.`);
      });
  };

  const renderAttireBadge = (status: string) => {
    const isConfirmed = status === 'confirmed';
    const isInProgress = status === 'in_progress';
    const bg = isConfirmed ? colors.success100 : isInProgress ? colors.warning100 : '#F1F5F9';
    const textCol = isConfirmed ? colors.success600 : isInProgress ? colors.gold700 : '#64748B';

    return (
      <View style={[styles.attireBadge, { backgroundColor: bg }]}>
        <Ionicons
          name={isConfirmed ? 'checkmark-circle' : isInProgress ? 'time' : 'ellipse-outline'}
          size={12}
          color={textCol}
        />
        <Text style={[styles.attireBadgeText, { color: textCol }]}>
          {attireStatusLabel(status as any)}
        </Text>
      </View>
    );
  };

  const renderPersonDetails = (item: EventPadrinhoItem, isPrimary: boolean) => {
    const guestName = item.guest?.name || 'Convidado não vinculado';
    const phone = item.guest?.phone;
    const special = specialRoleLabel(item.special_role);

    return (
      <View style={[styles.personBox, isPrimary && styles.personBoxPrimary]}>
        <View style={styles.personTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName} numberOfLines={1}>
              {guestName}
            </Text>
            <View style={styles.chipsRow}>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>{roleLabel(item.role, isDebutante)}</Text>
              </View>
              <View style={styles.sideChip}>
                <Text style={styles.sideChipText}>{sideLabel(item.side, isDebutante)}</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionIcons}>
            {phone ? (
              <Pressable
                onPress={() => openWhatsApp(phone, guestName)}
                style={styles.iconCircleBtn}
                accessibilityLabel="Enviar mensagem no WhatsApp"
              >
                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onOpenPlanIa(item)}
              style={styles.iconCircleBtn}
              accessibilityLabel="Automação Plan IA"
            >
              <Ionicons name="sparkles" size={15} color={colors.gold700} />
            </Pressable>
            <Pressable
              onPress={() => onEdit(item)}
              style={styles.iconCircleBtn}
              accessibilityLabel="Editar integrante"
            >
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => onDelete(item.id, guestName)}
              style={styles.iconCircleBtn}
              accessibilityLabel="Excluir integrante"
            >
              <Ionicons name="trash-outline" size={14} color={colors.dangerText} />
            </Pressable>
          </View>
        </View>

        {special ? (
          <View style={styles.specialRoleRow}>
            <Text style={styles.specialRoleText}>{special}</Text>
          </View>
        ) : null}

        {/* Attire Information */}
        <View style={styles.attireRow}>
          {renderAttireBadge(item.attire_status)}
          {item.attire_color ? (
            <View style={styles.attireColorWrap}>
              <Ionicons name="color-palette-outline" size={12} color={colors.mutedText} />
              <Text style={styles.attireColorText}>{item.attire_color}</Text>
            </View>
          ) : null}
          {item.manual_sent_at ? (
            <View style={styles.manualSentWrap}>
              <Ionicons name="document-text-outline" size={12} color={colors.gold700} />
              <Text style={styles.manualSentText}>Guia enviado</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.pairContainer, shadows.card]}>
      {/* Header with Entry Order Badge */}
      <View style={styles.pairHeader}>
        <View style={styles.orderBadgeWrap}>
          <Svg width={36} height={24} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.gold600} />
                <Stop offset="1" stopColor={colors.gold700} />
              </LinearGradient>
            </Defs>
            <Rect width={36} height={24} rx={6} ry={6} fill={`url(#${gradId})`} />
          </Svg>
          <Text style={styles.orderBadgeText}>
            #{String(pair.entryOrder).padStart(2, '0')}
          </Text>
        </View>
        <Text style={styles.pairHeaderText}>
          {pair.companion
            ? isDebutante
              ? 'Dupla de Honra'
              : 'Par de Padrinhos'
            : isDebutante
            ? 'Entrada Solo / Corte'
            : 'Entrada Individual'}
        </Text>
      </View>

      {/* Primary Person */}
      {renderPersonDetails(pair.primary, true)}

      {/* Divider or Companion */}
      {pair.companion ? (
        <>
          <View style={styles.pairConnector}>
            <View style={styles.connectorLine} />
            <Ionicons name="link" size={14} color={colors.gold700} />
            <View style={styles.connectorLine} />
          </View>
          {renderPersonDetails(pair.companion, false)}
        </>
      ) : (
        <Pressable
          onPress={() => onPairCompanion(pair.primary)}
          style={styles.addCompanionBox}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.gold700} />
          <Text style={styles.addCompanionText}>
            Vincular par ou acompanhante de cortejo
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pairContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  pairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  orderBadgeWrap: {
    width: 36,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pairHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personBox: {
    backgroundColor: '#FAF7F1',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  personBoxPrimary: {
    backgroundColor: '#FFFFFF',
  },
  personTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  personName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  roleChip: {
    backgroundColor: colors.gold50,
    borderWidth: 1,
    borderColor: colors.gold200,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold700,
  },
  sideChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sideChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F4F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialRoleRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EEE9DF',
  },
  specialRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  attireRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  attireBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  attireBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  attireColorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attireColorText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  manualSentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.gold50,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  manualSentText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gold700,
  },
  pairConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    gap: 8,
  },
  connectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  addCompanionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    marginTop: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.gold200,
    borderStyle: 'dashed',
    backgroundColor: colors.gold50,
  },
  addCompanionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold700,
  },
});
