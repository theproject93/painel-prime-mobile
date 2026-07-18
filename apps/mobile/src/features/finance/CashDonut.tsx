import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { toBRL } from './financeScreenHelpers';
import { financeStyles as styles } from './financeScreenStyles';

export function CashDonut({ entries, expenses }: { entries: number; expenses: number }) {
  const size = 116;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = entries + expenses > 0 ? entries / (entries + expenses) : 0;
  return (
    <View accessible accessibilityLabel={`Entradas ${toBRL(entries)}. Despesas ${toBRL(expenses)}.`}>
      <Svg width={size} height={size} accessibilityElementsHidden>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceSubtle} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.gold600} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference * ratio} ${circumference}`} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutCaption}>Saldo</Text>
        <Ionicons name="wallet-outline" size={24} color={colors.gold700} />
      </View>
    </View>
  );
}
