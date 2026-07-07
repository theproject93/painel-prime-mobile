import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, subtitle, icon, action }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {icon && <Ionicons name={icon} size={18} color={colors.primaryStrong} style={styles.icon} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {action ? (
        <Pressable onPress={action.onPress} style={styles.actionBtn}>
          <Text style={styles.actionText}>{action.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primaryStrong} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 10 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  icon: { marginRight: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.mutedText, marginTop: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.primaryStrong },
});
