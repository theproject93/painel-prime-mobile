import { Pressable, Text, TextInput, View } from 'react-native';

import { FIXTURE_LIBRARY } from './constants';
import { tableMapStyles as styles } from './styles';
import type { FixtureItem } from './types';

export function FixtureLabelEditor(props: {
  fixture: FixtureItem;
  draft: string;
  saving: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (props.compact) {
    return (
      <View style={styles.fullscreenEditRow}>
        <TextInput
          style={[styles.input, styles.fullscreenEditInput]}
          value={props.draft}
          onChangeText={props.onChange}
          placeholder="Nome do item selecionado"
        />
        <Pressable style={styles.primaryBtn} onPress={props.onSave}>
          <Text style={styles.primaryBtnText}>{props.saving ? 'Salvando…' : 'Salvar nome'}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.editRow}>
      <Text style={styles.caption}>Renomear item do mapa: {FIXTURE_LIBRARY[props.fixture.type].label}</Text>
      <TextInput style={styles.input} value={props.draft} onChangeText={props.onChange} placeholder="Nome personalizado" />
      <View style={styles.actionsRow}>
        <Pressable style={styles.ghostBtn} onPress={props.onCancel}>
          <Text style={styles.ghostBtnText}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={props.onSave}>
          <Text style={styles.primaryBtnText}>{props.saving ? 'Salvando...' : 'Salvar nome'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
