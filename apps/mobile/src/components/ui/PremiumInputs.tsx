import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

export function formatBrlInput(value: string | number) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const amount = Number(digits || '0') / 100;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseBrlInput(value: string) {
  return Number(value.replace(/[^\d]/g, '') || '0') / 100;
}

export type MoneyFieldProps = {
  value: string;
  onChangeValue: (formatted: string) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
  accessibilityLabel?: string;
  editable?: boolean;
};

export function MoneyField({
  value,
  onChangeValue,
  placeholder = 'R$ 0,00',
  style,
  placeholderTextColor = colors.mutedText,
  accessibilityLabel = 'Valor em reais',
  editable = true,
}: MoneyFieldProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      value={value}
      onChangeText={(text) => onChangeValue(formatBrlInput(text))}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      keyboardType="numeric"
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      editable={editable}
    />
  );
}

export function SensitiveMoney({ value, hidden }: { value: number; hidden: boolean }) {
  return <Text style={styles.money}>{hidden ? 'R$ ••••••' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>;
}

export function PrivacyToggle({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={styles.eye}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Exibir valores financeiros' : 'Ocultar valores financeiros'}
    >
      <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.text} />
    </Pressable>
  );
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatPtBrDate(value?: string | null) {
  if (!value) return 'Escolher data';
  return parseIsoDate(value.slice(0, 10)).toLocaleDateString('pt-BR');
}

export type PtBrDateFieldProps = {
  value: string;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
  placeholder?: string;
  label?: string;
  buttonStyle?: StyleProp<ViewStyle>;
};

export function PtBrDateField({
  value,
  onChange,
  minimumDate,
  placeholder = 'Escolher data',
  label = 'Prazo',
  buttonStyle,
}: PtBrDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(toIsoDate(date));
  }

  return (
    <View>
      <Pressable
        style={[styles.dateButton, buttonStyle]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatPtBrDate(value) : placeholder}`}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.primaryStrong} />
        <Text style={[styles.dateText, !value && styles.placeholder]}>
          {value ? formatPtBrDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={colors.mutedText} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={selected}
          mode="date"
          locale="pt-BR"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, fontSize: 16, fontWeight: '700' },
  money: { color: colors.text, fontSize: 22, fontWeight: '800' },
  eye: { width: 44, height: 44, flexShrink: 0, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: colors.border },
  dateButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14 },
  dateText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  placeholder: { color: colors.mutedText, fontWeight: '500' },
});
