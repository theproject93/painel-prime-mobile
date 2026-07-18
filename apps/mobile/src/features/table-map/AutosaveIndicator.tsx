import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { tableMapStyles as styles } from './styles';
import type { AutosaveState } from './types';

export function AutosaveIndicator({ state }: { state: AutosaveState }) {
  const error = state === 'error';
  const saving = state === 'saving';
  return (
    <View style={[styles.autosavePill, error ? styles.autosavePillError : null]}>
      <MaterialCommunityIcons
        name={error ? 'cloud-alert' : saving ? 'cloud-sync-outline' : 'cloud-check-outline'}
        size={17}
        color={error ? '#B91C1C' : saving ? colors.primaryStrong : '#047857'}
      />
      <View style={styles.autosaveCopy}>
        <Text style={[styles.autosaveTitle, error ? styles.autosaveTextError : null]}>
          {error ? 'Não foi possível salvar' : saving ? 'Salvando alterações…' : 'Tudo salvo automaticamente'}
        </Text>
        <Text style={styles.autosaveCaption}>
          {error ? 'Tente mover ou adicionar o item novamente.' : 'Você não precisa exportar para salvar.'}
        </Text>
      </View>
    </View>
  );
}
