import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View, type GestureResponderHandlers } from 'react-native';

import { colors } from '../../theme/colors';
import { AutosaveIndicator } from './AutosaveIndicator';
import { FixtureLabelEditor } from './FixtureLabelEditor';
import { FixtureToolbar } from './FixtureToolbar';
import { tableMapStyles as styles } from './styles';
import { TableMapSurface } from './TableMapSurface';
import type { AutosaveState, FixtureItem, FixtureType, TablePositions, TableRow } from './types';

type Props = {
  visible: boolean;
  captureRef: React.RefObject<View | null>;
  tables: TableRow[];
  positions: TablePositions;
  fixtures: FixtureItem[];
  occupancy: Map<string, number>;
  autosaveState: AutosaveState;
  selectedFixture: FixtureItem | null;
  labelDraft: string;
  savingLabel: boolean;
  exporting: boolean;
  getTableHandlers: (id: string) => GestureResponderHandlers;
  getFixtureHandlers: (id: string) => GestureResponderHandlers;
  onClose: () => void;
  onAddFixture: (type: FixtureType) => void;
  onSelectFixture: (id: string) => void;
  onDeleteFixture: (id: string) => void;
  onChangeLabel: (value: string) => void;
  onSaveLabel: () => void;
  onExport: () => void;
};

export function MapFullscreenModal(props: Props) {
  return (
    <Modal visible={props.visible} animationType="slide">
      <View style={styles.modalPage}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeadingCopy}>
            <Text style={styles.modalTitle}>Editor do salão</Text>
            <Text style={styles.modalSubtitle}>Toque para adicionar. Depois, arraste cada item para o lugar certo.</Text>
          </View>
          <Pressable style={styles.ghostBtn} onPress={props.onClose}>
            <Text style={styles.ghostBtnText}>Fechar</Text>
          </Pressable>
        </View>
        <AutosaveIndicator state={props.autosaveState} />
        <View style={styles.fullscreenToolsWrap}>
          <Text style={styles.fullscreenToolsTitle}>Adicionar ao mapa</Text>
          <FixtureToolbar compact onAdd={props.onAddFixture} />
        </View>
        {props.selectedFixture ? (
          <FixtureLabelEditor
            compact
            fixture={props.selectedFixture}
            draft={props.labelDraft}
            saving={props.savingLabel}
            onChange={props.onChangeLabel}
            onCancel={() => undefined}
            onSave={props.onSaveLabel}
          />
        ) : null}
        <TableMapSurface
          ref={props.captureRef}
          fullscreen
          tables={props.tables}
          positions={props.positions}
          fixtures={props.fixtures}
          occupancy={props.occupancy}
          getTableHandlers={props.getTableHandlers}
          getFixtureHandlers={props.getFixtureHandlers}
          onSelectFixture={props.onSelectFixture}
          onDeleteFixture={props.onDeleteFixture}
        />
        <Pressable
          style={[styles.exportBtn, props.exporting ? styles.ghostBtnDisabled : null]}
          disabled={props.exporting}
          onPress={props.onExport}
        >
          <MaterialCommunityIcons name="file-pdf-box" size={18} color={colors.text} />
          <Text style={styles.exportBtnText}>{props.exporting ? 'Gerando cópia…' : 'Exportar uma cópia em PDF'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
