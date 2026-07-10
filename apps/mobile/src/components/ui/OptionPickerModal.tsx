import React from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
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
  // Agrupa as opções mantendo a ordem em que foram declaradas.
  const grouped = React.useMemo(() => {
    const groups: { name: string; items: PickerOption[] }[] = [];
    const noGroup: PickerOption[] = [];

    options.forEach((opt) => {
      if (opt.group) {
        let g = groups.find((x) => x.name === opt.group);
        if (!g) {
          g = { name: opt.group, items: [] };
          groups.push(g);
        }
        g.items.push(opt);
      } else {
        noGroup.push(opt);
      }
    });

    return { groups, noGroup };
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {grouped.groups.map((g) => (
          <View key={g.name} style={styles.groupContainer}>
            <Text style={styles.groupHeader}>{getGroupLabel(g.name)}</Text>
            <View style={styles.groupItems}>
              {g.items.map(renderOption)}
            </View>
          </View>
        ))}
        {grouped.noGroup.length > 0 ? (
          <View style={styles.noGroupItems}>
            {grouped.noGroup.map(renderOption)}
          </View>
        ) : null}
      </ScrollView>
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
  groupContainer: {
    marginTop: 16,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
    paddingLeft: 8,
  },
  groupItems: {
    gap: 4,
  },
  noGroupItems: {
    gap: 2,
    marginTop: 12,
  },
});
