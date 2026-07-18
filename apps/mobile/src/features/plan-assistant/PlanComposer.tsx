import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../../theme/colors';

export function PlanComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChange}
        placeholder="Pergunte sobre a plataforma..."
        placeholderTextColor={colors.mutedText}
        editable={!props.disabled}
        onSubmitEditing={props.onSend}
        returnKeyType="send"
      />
      <Pressable style={styles.sendButton} disabled={props.disabled} onPress={props.onSend}>
        <Ionicons name="send" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card },
  input: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, color: colors.text, backgroundColor: '#FFFFFF' },
  sendButton: { height: 40, width: 40, borderRadius: 10, backgroundColor: colors.primaryStrong, alignItems: 'center', justifyContent: 'center' },
});
