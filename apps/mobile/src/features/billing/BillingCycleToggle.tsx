import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../../theme/colors';
import type { BillingCycle } from './types';

type Props = {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
};

export function BillingCycleToggle({ cycle, onChange }: Props) {
  const gradientId = `cycle-badge-grad-${useId().replace(/:/g, '')}`;

  return (
    <View style={styles.container}>
      <View style={styles.segmentedWrap}>
        <Pressable
          style={[styles.segmentBtn, cycle === 'monthly' ? styles.segmentBtnActive : null]}
          onPress={() => onChange('monthly')}
          accessibilityRole="button"
          accessibilityLabel="Ciclo mensal"
        >
          <Text
            style={[styles.segmentText, cycle === 'monthly' ? styles.segmentTextActive : null]}
          >
            Faturamento Mensal
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentBtn, cycle === 'annual' ? styles.segmentBtnActive : null]}
          onPress={() => onChange('annual')}
          accessibilityRole="button"
          accessibilityLabel="Ciclo anual com desconto"
        >
          <Text
            style={[styles.segmentText, cycle === 'annual' ? styles.segmentTextActive : null]}
          >
            Faturamento Anual
          </Text>
        </Pressable>
      </View>

      {/* Badge Verde de Desconto de 20% com SVG Gradient & useId */}
      <View style={styles.discountBadgeWrap}>
        <View style={styles.svgBackground}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#059669" stopOpacity="1" />
                <Stop offset="1" stopColor="#10B981" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx={12} fill={`url(#${gradientId})`} />
          </Svg>
        </View>
        <View style={styles.badgeContent}>
          <MaterialCommunityIcons name="tag-outline" size={14} color="#FFFFFF" />
          <Text style={styles.discountBadgeText}>
            Economize 20% no plano anual (equivale a 2 meses grátis)
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'stretch',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '800',
  },
  discountBadgeWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  svgBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
