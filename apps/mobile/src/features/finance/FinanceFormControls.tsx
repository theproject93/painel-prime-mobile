import { Ionicons } from '@expo/vector-icons';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '../../theme/colors';
import { financeStyles as styles } from './financeScreenStyles';

export function FinanceField({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor={colors.mutedText} style={[styles.input, multiline && styles.textarea]} /></View>;
}
export function StatusChoice(props: { first: string; second: string; selected: 'first' | 'second'; onSelect: (value: 'first' | 'second') => void }) {
  return <View style={styles.fieldGroup}><Text style={styles.fieldLabel}>Situação</Text><View style={styles.segmented}>{(['first', 'second'] as const).map((value) => <Pressable key={value} style={[styles.segment, props.selected === value && styles.segmentActive]} onPress={() => props.onSelect(value)}><Text style={[styles.segmentText, props.selected === value && styles.segmentTextActive]}>{value === 'first' ? props.first : props.second}</Text></Pressable>)}</View></View>;
}
export function AttachmentButton({ asset, onPress }: { asset: DocumentPickerAsset | null; onPress: () => void }) {
  return <Pressable style={styles.attachmentButton} onPress={onPress}><Ionicons name="attach" size={20} color={colors.gold700} /><Text style={styles.attachmentText} numberOfLines={1}>{asset ? asset.name : 'Adicionar comprovante (opcional)'}</Text></Pressable>;
}
