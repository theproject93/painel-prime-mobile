import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { buildMapLines } from '../features/table-map/core';
import { FixtureLabelEditor } from '../features/table-map/FixtureLabelEditor';
import { FixtureToolbar } from '../features/table-map/FixtureToolbar';
import { MapFullscreenModal } from '../features/table-map/MapFullscreenModal';
import { tableMapStyles as styles } from '../features/table-map/styles';
import type { FixtureType, GuestRow, TableRow } from '../features/table-map/types';
import { useMapDrag } from '../features/table-map/useMapDrag';
import { useMapPdfExport } from '../features/table-map/useMapPdfExport';
import { useTableMapModel } from '../features/table-map/useTableMapModel';
import { PrimeLogoLoader } from './PrimeLogoLoader';

type Props = {
  eventId: string;
  tables: TableRow[];
  guests: GuestRow[];
  onError: (message: string) => void;
  onReload: () => Promise<void>;
  onTablePositionLocalUpdate?: (tableId: string, x: number, y: number) => void;
};

export function EventTablesVisualMap(props: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeDragKeys = useRef(new Set<string>());
  const captureTarget = useRef<View>(null);
  const model = useTableMapModel({
    eventId: props.eventId,
    tables: props.tables,
    guests: props.guests,
    activeDragKeys,
    onError: props.onError,
    onTablePositionLocalUpdate: props.onTablePositionLocalUpdate,
  });
  const drag = useMapDrag({
    activeDragKeys,
    tablePositionsRef: model.tablePositionsRef,
    fixturesRef: model.fixturesRef,
    setTablePositions: model.setTablePositions,
    setFixtures: model.setFixtures,
    persistTablePosition: model.persistTablePosition,
    persistFixturePosition: model.persistFixturePosition,
  });
  const getLines = useCallback(() => buildMapLines(
    props.tables,
    model.tablePositionsRef.current,
    model.occupancy,
    model.fixturesRef.current,
  ), [model.fixturesRef, model.occupancy, model.tablePositionsRef, props.tables]);
  const pdf = useMapPdfExport(props.eventId, captureTarget, getLines, props.onError);
  const getTableHandlers = useCallback(
    (id: string) => drag.getTablePanResponder(id).panHandlers,
    [drag.getTablePanResponder],
  );
  const getFixtureHandlers = useCallback(
    (id: string) => drag.getFixturePanResponder(id).panHandlers,
    [drag.getFixturePanResponder],
  );
  const addFixture = useCallback(
    (type: FixtureType) => { void model.addFixture(type); },
    [model.addFixture],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mapa visual das mesas</Text>
        <Pressable style={styles.warnBtn} onPress={() => void model.resetMap()}>
          <Text style={styles.warnBtnText}>Redefinir</Text>
        </Pressable>
      </View>
      <FixtureToolbar onAdd={addFixture} />
      {model.selectedFixture ? (
        <FixtureLabelEditor
          fixture={model.selectedFixture}
          draft={model.fixtureLabelDraft}
          saving={model.savingFixtureLabel}
          onChange={model.setFixtureLabelDraft}
          onCancel={() => model.setSelectedFixtureId(null)}
          onSave={() => void model.saveFixtureLabel()}
        />
      ) : null}

      {model.loadingFixtures ? (
        <PrimeLogoLoader variant="inline" label="Preparando o mapa" />
      ) : model.fixtureError ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.caption}>{model.fixtureError}</Text>
          <Pressable style={styles.primaryBtn} onPress={model.retryLoad}>
            <Text style={styles.primaryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.mapLaunchCard} onPress={() => setIsFullscreen(true)}>
          <View style={styles.mapLaunchIcon}>
            <MaterialCommunityIcons name="floor-plan" size={28} color={colors.primaryStrong} />
          </View>
          <View style={styles.mapLaunchCopy}>
            <Text style={styles.mapLaunchTitle}>Abrir editor visual</Text>
            <Text style={styles.caption}>Organize mesas e itens do salão em uma área ampla, sem alongar esta tela.</Text>
          </View>
          <MaterialCommunityIcons name="arrow-expand" size={20} color={colors.mutedText} />
        </Pressable>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.ghostBtn} onPress={() => void props.onReload()}>
          <Text style={styles.ghostBtnText}>Atualizar dados do servidor</Text>
        </Pressable>
      </View>

      <MapFullscreenModal
        visible={isFullscreen}
        captureRef={captureTarget}
        tables={props.tables}
        positions={model.tablePositions}
        fixtures={model.fixtures}
        occupancy={model.occupancy}
        autosaveState={model.autosaveState}
        selectedFixture={model.selectedFixture}
        labelDraft={model.fixtureLabelDraft}
        savingLabel={model.savingFixtureLabel}
        exporting={pdf.exporting}
        getTableHandlers={getTableHandlers}
        getFixtureHandlers={getFixtureHandlers}
        onClose={() => setIsFullscreen(false)}
        onAddFixture={addFixture}
        onSelectFixture={model.setSelectedFixtureId}
        onDeleteFixture={(id) => void model.deleteFixture(id)}
        onChangeLabel={model.setFixtureLabelDraft}
        onSaveLabel={() => void model.saveFixtureLabel()}
        onExport={() => void pdf.exportPdf()}
      />
    </View>
  );
}
