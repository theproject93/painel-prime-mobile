import React from 'react';
import { Pressable, SectionList, StyleSheet, Text } from 'react-native';
import { Modal } from './Modal';
import { colors } from '../../theme/colors';

export type PickerOption = {
  value: string;
  label: string;
  group?: string;
};

export type OptionPickerModalProps = {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
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
        style={[styles.optionRow, isSelected && styles.optionRowActive]}
        onPress={() => {
          onSelect(opt.value);
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={opt.label}
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
          {opt.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => renderOption(item)}
        renderSectionHeader={({ section }) => section.key ? (
          <Text style={styles.groupHeader}>{getGroupLabel(section.key)}</Text>
        ) : null}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  optionRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowActive: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
    paddingLeft: 8,
    marginTop: 12,
    backgroundColor: colors.surface,
  },
});
