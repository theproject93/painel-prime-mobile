import React from 'react';
import {
  Modal as RNModal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

export type PickerOption = {
  value: string;
  label: string;
  group?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

export type OptionPickerModalProps = {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue: string;
  variant?: 'list' | 'grid';
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  variant = 'list',
  onSelect,
  onClose,
}: OptionPickerModalProps) {
  const sections = React.useMemo(() => {
    const groups: { key: string; data: PickerOption[] }[] = [];

    options.forEach((opt) => {
      const groupKey = opt.group ?? '';
      let group = groups.find((item) => item.key === groupKey);
      if (!group) {
        group = { key: groupKey, data: [] };
        groups.push(group);
      }
      group.data.push(opt);
    });

    return groups;
  }, [options]);

  const getGroupLabel = (groupKey: string) => {
    const labels: Record<string, string> = {
      summary: 'Resumo',
      planning: 'Planejamento',
      people: 'Pessoas',
      finance: 'Financeiro',
      operation: 'Operação',
      files: 'Arquivos',
      closure: 'Encerramento',
    };
    return labels[groupKey] || groupKey;
  };

  const renderOption = (opt: PickerOption) => {
    const isSelected = opt.value === selectedValue;
    return (
      <Pressable
        key={opt.value}
        style={[
          variant === 'grid' ? styles.optionCard : styles.optionRow,
          isSelected ? styles.optionRowActive : null,
        ]}
        onPress={() => {
          onSelect(opt.value);
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={opt.label}
        accessibilityState={{ selected: isSelected }}
      >
        {opt.icon ? (
          <View style={[styles.optionIcon, isSelected ? styles.optionIconActive : null]}>
            <Ionicons
              name={opt.icon}
              size={20}
              color={isSelected ? colors.primaryStrong : colors.mutedText}
            />
          </View>
        ) : null}
        <Text
          style={[styles.optionText, isSelected ? styles.optionTextActive : null]}
          numberOfLines={variant === 'grid' ? 2 : 1}
        >
          {opt.label}
        </Text>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.primaryStrong} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Fechar seletor"
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section) => (
              <View key={section.key || 'options'} style={styles.section}>
                {section.key ? (
                  <Text style={styles.groupHeader}>{getGroupLabel(section.key)}</Text>
                ) : null}
                <View style={variant === 'grid' ? styles.optionGrid : styles.optionList}>
                  {section.data.map(renderOption)}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  container: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  closeButtonText: {
    color: colors.primaryStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 14,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionList: {
    gap: 2,
  },
  optionRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionCard: {
    width: '48%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  optionRowActive: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    borderBottomWidth: 0,
    borderColor: colors.primaryStrong,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  optionIconActive: {
    backgroundColor: colors.primarySoft,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
    paddingLeft: 8,
    backgroundColor: colors.surface,
  },
});
