import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radii, fontSize, fontWeight } from '../../theme/tokens';

type Tab = { key: string; label: string; count?: number };

type TabsProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
};

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable key={tab.key} onPress={() => onTabChange(tab.key)} style={[styles.tab, active && styles.tabActive]}>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {tab.count !== undefined ? (
              <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                <Text style={[styles.countText, active && styles.countTextActive]}>{tab.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 6, paddingVertical: spacing.xs },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  label: { color: colors.mutedText, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  labelActive: { color: colors.primaryStrong },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeActive: { backgroundColor: colors.primary },
  countText: { color: colors.mutedText, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  countTextActive: { color: colors.primaryTextOn },
});
