import { useId } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii, shadows } from '../../theme/colors';
import type { EventPadrinhoItem } from './padrinhosModel';

export type PadrinhosFilterType = 'all' | 'unpaired' | 'confirmed_attire' | 'pending_attire';

type Props = {
  activeFilter: PadrinhosFilterType;
  isDebutante?: boolean;
  onFilterChange: (filter: PadrinhosFilterType) => void;
  padrinhos: EventPadrinhoItem[];
};

export function PadrinhosStatsCards({
  activeFilter,
  isDebutante = false,
  onFilterChange,
  padrinhos,
}: Props) {
  const id = useId();
  const total = padrinhos.length;
  const pairedCount = padrinhos.filter((p) => Boolean(p.pair_padrinho_id)).length;
  const pairsFormed = Math.floor(pairedCount / 2);
  const attireConfirmed = padrinhos.filter((p) => p.attire_status === 'confirmed').length;
  const attirePending = total - attireConfirmed;

  return (
    <View style={styles.container}>
      {/* 1. Total */}
      <Pressable
        onPress={() => onFilterChange('all')}
        style={[
          styles.card,
          shadows.sm,
          activeFilter === 'all' && styles.cardActiveGold,
        ]}
      >
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`stat-all-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={activeFilter === 'all' ? '#FDF8ED' : '#FFFFFF'} />
              <Stop offset="1" stopColor={activeFilter === 'all' ? '#F6ECD2' : '#FAF7F1'} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={radii.md} ry={radii.md} fill={`url(#stat-all-${id})`} />
        </Svg>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel} numberOfLines={1}>
            {isDebutante ? 'Corte de Honra' : 'Padrinhos'}
          </Text>
          <View style={[styles.iconWrap, { backgroundColor: colors.gold100 }]}>
            <Ionicons name="people" size={16} color={colors.gold700} />
          </View>
        </View>
        <Text style={styles.cardValue}>{total}</Text>
        <Text style={styles.cardSub}>cadastrados</Text>
      </Pressable>

      {/* 2. Pares Formados */}
      <Pressable
        onPress={() => onFilterChange(activeFilter === 'unpaired' ? 'all' : 'unpaired')}
        style={[
          styles.card,
          shadows.sm,
          activeFilter === 'unpaired' && styles.cardActiveRoyal,
        ]}
      >
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`stat-pair-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={activeFilter === 'unpaired' ? '#F4F2FF' : '#FFFFFF'} />
              <Stop offset="1" stopColor={activeFilter === 'unpaired' ? '#E8E4FF' : '#FAF7F1'} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={radii.md} ry={radii.md} fill={`url(#stat-pair-${id})`} />
        </Svg>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel} numberOfLines={1}>
            Pares
          </Text>
          <View style={[styles.iconWrap, { backgroundColor: colors.royal100 }]}>
            <Ionicons name="git-merge" size={16} color={colors.royal600} />
          </View>
        </View>
        <Text style={styles.cardValue}>{pairsFormed}</Text>
        <Text style={styles.cardSub}>
          {total - pairedCount > 0 ? `${total - pairedCount} sem par` : '100% em par'}
        </Text>
      </Pressable>

      {/* 3. Trajes Definidos */}
      <Pressable
        onPress={() =>
          onFilterChange(activeFilter === 'confirmed_attire' ? 'all' : 'confirmed_attire')
        }
        style={[
          styles.card,
          shadows.sm,
          activeFilter === 'confirmed_attire' && styles.cardActiveSuccess,
        ]}
      >
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`stat-att-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={activeFilter === 'confirmed_attire' ? '#EAF8F0' : '#FFFFFF'}
              />
              <Stop
                offset="1"
                stopColor={activeFilter === 'confirmed_attire' ? '#D1F5E0' : '#FAF7F1'}
              />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={radii.md} ry={radii.md} fill={`url(#stat-att-${id})`} />
        </Svg>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel} numberOfLines={1}>
            Trajes OK
          </Text>
          <View style={[styles.iconWrap, { backgroundColor: colors.success100 }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success600} />
          </View>
        </View>
        <Text style={[styles.cardValue, { color: colors.success600 }]}>{attireConfirmed}</Text>
        <Text style={styles.cardSub}>{attirePending} pendentes</Text>
      </Pressable>

      {/* 4. Trajes Pendentes */}
      <Pressable
        onPress={() =>
          onFilterChange(activeFilter === 'pending_attire' ? 'all' : 'pending_attire')
        }
        style={[
          styles.card,
          shadows.sm,
          activeFilter === 'pending_attire' && styles.cardActiveWarning,
        ]}
      >
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`stat-pend-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop
                offset="0"
                stopColor={activeFilter === 'pending_attire' ? '#FFFBEB' : '#FFFFFF'}
              />
              <Stop
                offset="1"
                stopColor={activeFilter === 'pending_attire' ? '#FEF3C7' : '#FAF7F1'}
              />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={radii.md} ry={radii.md} fill={`url(#stat-pend-${id})`} />
        </Svg>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel} numberOfLines={1}>
            Pendentes
          </Text>
          <View style={[styles.iconWrap, { backgroundColor: colors.warning100 }]}>
            <Ionicons name="time" size={16} color={colors.gold700} />
          </View>
        </View>
        <Text style={[styles.cardValue, { color: colors.warningText }]}>{attirePending}</Text>
        <Text style={styles.cardSub}>em busca</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  card: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    minHeight: 88,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardActiveGold: {
    borderColor: colors.gold600,
    borderWidth: 1.5,
  },
  cardActiveRoyal: {
    borderColor: colors.royal600,
    borderWidth: 1.5,
  },
  cardActiveSuccess: {
    borderColor: colors.success600,
    borderWidth: 1.5,
  },
  cardActiveWarning: {
    borderColor: colors.gold600,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  cardSub: {
    fontSize: 10,
    color: colors.mutedText,
    fontWeight: '500',
  },
});
