import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getEventPersonaCopy } from '@painel-prime/app/eventPersona';
import { AutosaveIndicator } from '../../../../src/features/table-map/AutosaveIndicator';
import { buildMapLines } from '../../../../src/features/table-map/core';
import { FixtureLabelEditor } from '../../../../src/features/table-map/FixtureLabelEditor';
import { FixtureToolbar } from '../../../../src/features/table-map/FixtureToolbar';
import { TableGuestDrawer } from '../../../../src/features/table-map/TableGuestDrawer';
import { TableMapSurface } from '../../../../src/features/table-map/TableMapSurface';
import type {
  FixtureType,
  GuestRow,
  MapSpace,
  TableRow,
} from '../../../../src/features/table-map/types';
import { useMapDrag } from '../../../../src/features/table-map/useMapDrag';
import { useMapPdfExport } from '../../../../src/features/table-map/useMapPdfExport';
import { useTableMapModel } from '../../../../src/features/table-map/useTableMapModel';
import { supabase } from '../../../../src/lib/supabase';
import { colors } from '../../../../src/theme/colors';

export default function EventMesasTouchRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';

  const [eventName, setEventName] = useState<string>('Evento');
  const [eventType, setEventType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tables, setTables] = useState<TableRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const activeDragKeys = useRef(new Set<string>());
  const captureTarget = useRef<View>(null);

  // Carrega evento, mesas e convidados
  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [eventRes, tablesRes, guestsRes] = await Promise.all([
        supabase.from('events').select('id, name, event_type').eq('id', eventId).maybeSingle(),
        supabase.from('event_tables').select('id, name, seats, note, posx, posy').eq('event_id', eventId).order('created_at', { ascending: true }),
        supabase.from('event_guests').select('id, name, phone, table_id, confirmed, rsvp_status, family_group_id').eq('event_id', eventId),
      ]);

      if (eventRes.data) {
        setEventName(eventRes.data.name || 'Evento');
        setEventType(eventRes.data.event_type || null);
      }
      if (tablesRes.data) {
        setTables(tablesRes.data as TableRow[]);
      }
      if (guestsRes.data) {
        setGuests(guestsRes.data as GuestRow[]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar dados do evento.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const persona = getEventPersonaCopy(eventType);

  const model = useTableMapModel({
    eventId,
    tables,
    guests,
    activeDragKeys,
    onError: (msg) => setErrorMsg(msg),
    onTablePositionLocalUpdate: (tableId, x, y) => {
      setTables((curr) => curr.map((t) => (t.id === tableId ? { ...t, posx: x, posy: y } : t)));
    },
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

  const getLines = useCallback(() => {
    return buildMapLines(
      model.currentTables,
      model.tablePositionsRef.current,
      model.occupancy,
      model.currentFixtures,
    );
  }, [model.currentFixtures, model.currentTables, model.occupancy, model.tablePositionsRef]);

  const pdf = useMapPdfExport(eventId, captureTarget, getLines, (err) => setErrorMsg(err));

  const getTableHandlers = useCallback(
    (id: string) => {
      const pan = drag.getTablePanResponder(id).panHandlers;
      return {
        ...pan,
        onResponderGrant: (e: any) => {
          setSelectedTableId(id);
          pan.onResponderGrant?.(e);
        },
      };
    },
    [drag.getTablePanResponder],
  );

  const getFixtureHandlers = useCallback(
    (id: string) => drag.getFixturePanResponder(id).panHandlers,
    [drag.getFixturePanResponder],
  );

  const addFixture = useCallback(
    (type: FixtureType) => {
      void model.addFixture(type, model.activeSpace);
    },
    [model.activeSpace, model.addFixture],
  );

  // Alocação de convidado
  const handleAllocateGuest = useCallback(
    async (guestId: string, tableId: string) => {
      const { error } = await supabase.from('event_guests').update({ table_id: tableId }).eq('id', guestId);
      if (error) {
        setErrorMsg('Não foi possível alocar o convidado. Tente novamente.');
        return;
      }
      setGuests((curr) => curr.map((g) => (g.id === guestId ? { ...g, table_id: tableId } : g)));
    },
    [],
  );

  // Desalocação de convidado
  const handleUnallocateGuest = useCallback(
    async (guestId: string) => {
      const { error } = await supabase.from('event_guests').update({ table_id: null }).eq('id', guestId);
      if (error) {
        setErrorMsg('Não foi possível remover o convidado. Tente novamente.');
        return;
      }
      setGuests((curr) => curr.map((g) => (g.id === guestId ? { ...g, table_id: null } : g)));
    },
    [],
  );

  // Alocação em lote da família
  const handleAllocateFamilyGroup = useCallback(
    async (familyGroupId: string, tableId: string) => {
      const { error } = await supabase
        .from('event_guests')
        .update({ table_id: tableId })
        .eq('event_id', eventId)
        .eq('family_group_id', familyGroupId);
      if (error) {
        setErrorMsg('Não foi possível alocar a família. Tente novamente.');
        return;
      }
      setGuests((curr) =>
        curr.map((g) => (g.family_group_id === familyGroupId ? { ...g, table_id: tableId } : g)),
      );
    },
    [eventId],
  );

  // Salvar nota da mesa
  const handleSaveNote = useCallback(
    async (tableId: string, note: string | null) => {
      const { error } = await supabase.from('event_tables').update({ note }).eq('id', tableId);
      if (error) {
        setErrorMsg('Não foi possível salvar a observação da mesa.');
        return;
      }
      setTables((curr) => curr.map((t) => (t.id === tableId ? { ...t, note } : t)));
    },
    [],
  );

  const selectedTable = useMemo(() => {
    return tables.find((t) => t.id === selectedTableId) ?? (tables[0] || null);
  }, [selectedTableId, tables]);

  const unallocatedConfirmedCount = useMemo(() => {
    return guests.filter((g) => {
      const isConfirmed = g.confirmed === true || g.rsvp_status === 'confirmed';
      return isConfirmed && (!g.table_id || g.table_id === '');
    }).length;
  }, [guests]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primaryStrong} />
          <Text style={styles.loadingText}>Carregando mapa de mesas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Barra de Topo */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.titleText} numberOfLines={1}>
            Mapa de Mesas Touch
          </Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {eventName} • {persona.kind === 'debutante' ? 'Corte & Convidados' : 'Salão & Cerimônia'}
          </Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            style={[styles.pdfBtn, pdf.exporting ? styles.btnDisabled : null]}
            disabled={pdf.exporting}
            onPress={() => void pdf.exportPdf()}
            accessibilityLabel="Exportar PDF"
          >
            <MaterialCommunityIcons name="file-pdf-box" size={20} color={colors.primaryStrong} />
          </Pressable>

          <Pressable
            style={styles.drawerTriggerBtn}
            onPress={() => setDrawerVisible(true)}
            accessibilityLabel="Gaveta de alocação de convidados"
          >
            <MaterialCommunityIcons name="account-multiple-plus" size={18} color="#FFFFFF" />
            <Text style={styles.drawerTriggerText}>Alocar</Text>
            {unallocatedConfirmedCount > 0 ? (
              <View style={styles.badgePill}>
                <Text style={styles.badgePillText}>{unallocatedConfirmedCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Indicador de Autosave e Erros */}
      <View style={styles.statusRow}>
        <AutosaveIndicator state={model.autosaveState} />
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText} numberOfLines={1}>
              {errorMsg}
            </Text>
            <Pressable onPress={() => setErrorMsg('')}>
              <MaterialCommunityIcons name="close" size={14} color="#B91C1C" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Barra de Ambientes: Festa vs Cerimônia/Igreja */}
      <View style={styles.spacesRow}>
        <View style={styles.spacePillsGroup}>
          <Pressable
            style={[
              styles.spacePill,
              model.activeSpace === 'party' ? styles.spacePillActive : null,
            ]}
            onPress={() => model.setActiveSpace('party')}
          >
            <MaterialCommunityIcons
              name="glass-cocktail"
              size={15}
              color={model.activeSpace === 'party' ? colors.primaryStrong : colors.mutedText}
            />
            <Text
              style={[
                styles.spacePillText,
                model.activeSpace === 'party' ? styles.spacePillTextActive : null,
              ]}
            >
              Espaço Festa ({model.partyFixturesCount})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.spacePill,
              model.activeSpace === 'church' ? styles.spacePillActive : null,
            ]}
            onPress={() => model.setActiveSpace('church')}
          >
            <MaterialCommunityIcons
              name="church"
              size={15}
              color={model.activeSpace === 'church' ? colors.primaryStrong : colors.mutedText}
            />
            <Text
              style={[
                styles.spacePillText,
                model.activeSpace === 'church' ? styles.spacePillTextActive : null,
              ]}
            >
              Cerimônia / Igreja ({model.churchFixturesCount})
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.tableSelectorChip}
          onPress={() => setDrawerVisible(true)}
        >
          <MaterialCommunityIcons name="table-furniture" size={15} color={colors.primaryStrong} />
          <Text style={styles.tableSelectorText} numberOfLines={1}>
            {selectedTable ? selectedTable.name || 'Mesa' : 'Selecione'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={colors.mutedText} />
        </Pressable>
      </View>

      {/* Toolbar para adicionar itens cênicos ao espaço atual */}
      <View style={styles.toolsWrap}>
        <FixtureToolbar compact onAdd={addFixture} />
      </View>

      {/* Editor de rótulo para item selecionado */}
      {model.selectedFixture ? (
        <View style={styles.editorWrap}>
          <FixtureLabelEditor
            compact
            fixture={model.selectedFixture}
            draft={model.fixtureLabelDraft}
            saving={model.savingFixtureLabel}
            onChange={model.setFixtureLabelDraft}
            onCancel={() => model.setSelectedFixtureId(null)}
            onSave={() => void model.saveFixtureLabel()}
          />
        </View>
      ) : null}

      {/* Superfície do Mapa Touch com bloqueio de rolagem durante arraste */}
      <View style={styles.surfaceContainer}>
        <TableMapSurface
          ref={captureTarget}
          fullscreen
          isDragging={drag.isDragging}
          tables={model.currentTables}
          positions={model.tablePositions}
          fixtures={model.currentFixtures}
          occupancy={model.occupancy}
          getTableHandlers={getTableHandlers}
          getFixtureHandlers={getFixtureHandlers}
          onSelectFixture={model.setSelectedFixtureId}
          onDeleteFixture={(id) => void model.deleteFixture(id)}
        />
      </View>

      {/* Gaveta de Convidados e Alocação de 1 Toque */}
      <TableGuestDrawer
        visible={drawerVisible}
        table={selectedTable}
        guests={guests}
        onClose={() => setDrawerVisible(false)}
        onAllocateGuest={handleAllocateGuest}
        onUnallocateGuest={handleUnallocateGuest}
        onAllocateFamilyGroup={handleAllocateFamilyGroup}
        onSaveNote={handleSaveNote}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    gap: 1,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  subtitleText: {
    fontSize: 11,
    color: colors.mutedText,
    fontWeight: '500',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pdfBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  drawerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  drawerTriggerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  badgePill: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
  },
  errorBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  errorBannerText: {
    fontSize: 11,
    color: '#B91C1C',
    flex: 1,
    fontWeight: '600',
  },
  spacesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  spacePillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  spacePillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryStrong,
  },
  spacePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedText,
  },
  spacePillTextActive: {
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  tableSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 120,
  },
  tableSelectorText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  toolsWrap: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editorWrap: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  surfaceContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
