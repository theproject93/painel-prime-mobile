import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type TableRow = {
  id: string;
  name: string | null;
  seats: number | null;
  note?: string | null;
  posx?: number | null;
  posy?: number | null;
};

type GuestRow = {
  id: string;
  table_id: string | null;
};

type FixtureType =
  | 'altar'
  | 'pista'
  | 'bar'
  | 'entrada'
  | 'saida'
  | 'banheiro'
  | 'totem';

type FixtureConfig = {
  label: string;
  color: string;
  borderColor: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  w: number;
  h: number;
};

type FixtureItem = {
  id: string;
  type: FixtureType;
  x: number;
  y: number;
  w: number;
  h: number;
  custom_label?: string | null;
};

type Props = {
  eventId: string;
  tables: TableRow[];
  guests: GuestRow[];
  onError: (message: string) => void;
  onReload: () => Promise<void>;
  onTablePositionLocalUpdate?: (tableId: string, x: number, y: number) => void;
};

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 780;
const GRID = 20;

const FIXTURE_LIBRARY: Record<FixtureType, FixtureConfig> = {
  altar: {
    label: 'Altar',
    color: '#F8FAFC',
    borderColor: '#94A3B8',
    iconName: 'church',
    iconColor: '#334155',
    w: 220,
    h: 90,
  },
  pista: {
    label: 'Pista de dança',
    color: '#E0E7FF',
    borderColor: '#818CF8',
    iconName: 'music',
    iconColor: '#4338CA',
    w: 200,
    h: 96,
  },
  bar: {
    label: 'Bar',
    color: '#ECFDF5',
    borderColor: '#6EE7B7',
    iconName: 'glass-wine',
    iconColor: '#047857',
    w: 165,
    h: 88,
  },
  entrada: {
    label: 'Porta de entrada',
    color: '#ECFEFF',
    borderColor: '#67E8F9',
    iconName: 'login',
    iconColor: '#0E7490',
    w: 170,
    h: 78,
  },
  saida: {
    label: 'Porta de saída',
    color: '#F0F9FF',
    borderColor: '#7DD3FC',
    iconName: 'logout',
    iconColor: '#0369A1',
    w: 160,
    h: 78,
  },
  banheiro: {
    label: 'Banheiro',
    color: '#F0FDFA',
    borderColor: '#5EEAD4',
    iconName: 'toilet',
    iconColor: '#0F766E',
    w: 155,
    h: 78,
  },
  totem: {
    label: 'Totem de fotos',
    color: '#FFFBEB',
    borderColor: '#FCD34D',
    iconName: 'camera',
    iconColor: '#B45309',
    w: 160,
    h: 82,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFixtureType(value: string): value is FixtureType {
  return Object.prototype.hasOwnProperty.call(FIXTURE_LIBRARY, value);
}

function fixtureLabel(item: FixtureItem) {
  const fallback = FIXTURE_LIBRARY[item.type]?.label ?? 'Item';
  const custom = String(item.custom_label ?? '').trim();
  return custom || fallback;
}

export function EventTablesVisualMap({
  eventId,
  tables,
  guests,
  onError,
  onReload,
  onTablePositionLocalUpdate,
}: Props) {
  const [tablePositions, setTablePositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const tablePositionsRef = useRef(tablePositions);

  const [fixtures, setFixtures] = useState<FixtureItem[]>([]);
  const fixturesRef = useRef(fixtures);

  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [savingFixtureLabel, setSavingFixtureLabel] = useState(false);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [fixtureLabelDraft, setFixtureLabelDraft] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCustomLabelColumn, setHasCustomLabelColumn] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const mapCaptureRef = useRef<View>(null);
  const exportingPdfRef = useRef(false);
  const lastPdfExportAtRef = useRef(0);

  const dragStartRef = useRef<Record<string, { x: number; y: number }>>({});
  const tablePanRespondersRef = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});
  const fixturePanRespondersRef = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});

  useEffect(() => {
    tablePositionsRef.current = tablePositions;
  }, [tablePositions]);

  useEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    tables.forEach((table, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      next[table.id] = {
        x: toNumber(table.posx, 40 + col * 250),
        y: toNumber(table.posy, 140 + row * 180),
      };
    });
    setTablePositions(next);
  }, [tables]);

  useEffect(() => {
    let alive = true;
    async function loadFixtures() {
      setLoadingFixtures(true);
      const fullRes = await supabase
        .from('event_map_fixtures')
        .select('id,type,x,y,w,h,custom_label')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (!fullRes.error) {
        if (!alive) return;
        setHasCustomLabelColumn(true);
        const rows = (fullRes.data ?? [])
          .map((row) => {
            const type = String(row.type ?? '');
            if (!isFixtureType(type)) return null;
            return {
              id: String(row.id),
              type,
              x: toNumber(row.x, 40),
              y: toNumber(row.y, 40),
              w: toNumber(row.w, FIXTURE_LIBRARY[type].w),
              h: toNumber(row.h, FIXTURE_LIBRARY[type].h),
              custom_label:
                typeof row.custom_label === 'string' ? row.custom_label : null,
            } as FixtureItem;
          })
          .filter((row): row is FixtureItem => row !== null);
        setFixtures(rows);
        setLoadingFixtures(false);
        return;
      }

      const fallbackRes = await supabase
        .from('event_map_fixtures')
        .select('id,type,x,y,w,h')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (!alive) return;
      if (fallbackRes.error) {
        onError(fallbackRes.error.message);
        setLoadingFixtures(false);
        return;
      }

      setHasCustomLabelColumn(false);
      const rows = (fallbackRes.data ?? [])
        .map((row) => {
          const type = String(row.type ?? '');
          if (!isFixtureType(type)) return null;
          return {
            id: String(row.id),
            type,
            x: toNumber(row.x, 40),
            y: toNumber(row.y, 40),
            w: toNumber(row.w, FIXTURE_LIBRARY[type].w),
            h: toNumber(row.h, FIXTURE_LIBRARY[type].h),
            custom_label: null,
          } as FixtureItem;
        })
        .filter((row): row is FixtureItem => row !== null);
      setFixtures(rows);
      setLoadingFixtures(false);
    }
    void loadFixtures();
    return () => {
      alive = false;
    };
  }, [eventId, onError]);

  const occupancyByTable = useMemo(() => {
    const map = new Map<string, number>();
    guests.forEach((guest) => {
      if (!guest.table_id) return;
      map.set(guest.table_id, (map.get(guest.table_id) ?? 0) + 1);
    });
    return map;
  }, [guests]);

  const selectedFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  );

  useEffect(() => {
    if (!selectedFixture) {
      setFixtureLabelDraft('');
      return;
    }
    setFixtureLabelDraft(fixtureLabel(selectedFixture));
  }, [selectedFixture]);

  function getTablePanResponder(tableId: string) {
    const key = `table:${tableId}`;
    if (tablePanRespondersRef.current[key]) {
      return tablePanRespondersRef.current[key];
    }

    tablePanRespondersRef.current[key] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current[key] = tablePositionsRef.current[tableId] ?? { x: 40, y: 140 };
      },
      onPanResponderMove: (_, gesture) => {
        const start = dragStartRef.current[key] ?? { x: 40, y: 140 };
        const nextX = clamp(start.x + gesture.dx, 0, MAP_WIDTH - 190);
        const nextY = clamp(start.y + gesture.dy, 0, MAP_HEIGHT - 130);
        setTablePositions((prev) => ({
          ...prev,
          [tableId]: { x: nextX, y: nextY },
        }));
      },
      onPanResponderRelease: () => {
        void persistTablePosition(tableId);
      },
      onPanResponderTerminate: () => {
        void persistTablePosition(tableId);
      },
    });
    return tablePanRespondersRef.current[key];
  }

  function getFixturePanResponder(fixtureId: string) {
    const key = `fixture:${fixtureId}`;
    if (fixturePanRespondersRef.current[key]) {
      return fixturePanRespondersRef.current[key];
    }

    fixturePanRespondersRef.current[key] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const current = fixturesRef.current.find((fixture) => fixture.id === fixtureId);
        dragStartRef.current[key] = {
          x: current?.x ?? 60,
          y: current?.y ?? 60,
        };
      },
      onPanResponderMove: (_, gesture) => {
        const start = dragStartRef.current[key] ?? { x: 60, y: 60 };
        const target = fixturesRef.current.find((fixture) => fixture.id === fixtureId);
        if (!target) return;
        const nextX = clamp(start.x + gesture.dx, 0, MAP_WIDTH - target.w);
        const nextY = clamp(start.y + gesture.dy, 0, MAP_HEIGHT - target.h);
        setFixtures((prev) =>
          prev.map((fixture) =>
            fixture.id === fixtureId
              ? {
                  ...fixture,
                  x: nextX,
                  y: nextY,
                }
              : fixture,
          ),
        );
      },
      onPanResponderRelease: () => {
        void persistFixturePosition(fixtureId);
      },
      onPanResponderTerminate: () => {
        void persistFixturePosition(fixtureId);
      },
    });
    return fixturePanRespondersRef.current[key];
  }

  async function persistTablePosition(tableId: string) {
    const current = tablePositionsRef.current[tableId];
    if (!current) return;
    const snapped = {
      x: snap(current.x),
      y: snap(current.y),
    };
    setTablePositions((prev) => ({
      ...prev,
      [tableId]: snapped,
    }));
    onTablePositionLocalUpdate?.(tableId, snapped.x, snapped.y);
    const { error } = await supabase
      .from('event_tables')
      .update({ posx: snapped.x, posy: snapped.y })
      .eq('id', tableId);
    if (error) onError(error.message);
  }

  async function persistFixturePosition(fixtureId: string) {
    const current = fixturesRef.current.find((fixture) => fixture.id === fixtureId);
    if (!current) return;
    const snapped = {
      x: snap(current.x),
      y: snap(current.y),
    };
    setFixtures((prev) =>
      prev.map((fixture) =>
        fixture.id === fixtureId
          ? {
              ...fixture,
              x: snapped.x,
              y: snapped.y,
            }
          : fixture,
      ),
    );
    const { error } = await supabase
      .from('event_map_fixtures')
      .update({ x: snapped.x, y: snapped.y })
      .eq('id', fixtureId);
    if (error) onError(error.message);
  }

  async function addFixture(type: FixtureType) {
    const cfg = FIXTURE_LIBRARY[type];
    const baseX = 60 + (fixtures.length % 5) * 180;
    const baseY = 50 + Math.floor(fixtures.length / 5) * 120;
    const payload: Record<string, unknown> = {
      event_id: eventId,
      type,
      x: clamp(baseX, 0, MAP_WIDTH - cfg.w),
      y: clamp(baseY, 0, MAP_HEIGHT - cfg.h),
      w: cfg.w,
      h: cfg.h,
    };
    if (hasCustomLabelColumn) {
      payload.custom_label = null;
    }

    const selectFields = hasCustomLabelColumn
      ? 'id,type,x,y,w,h,custom_label'
      : 'id,type,x,y,w,h';

    let res = await supabase
      .from('event_map_fixtures')
      .insert(payload)
      .select(selectFields)
      .single();

    if (res.error && hasCustomLabelColumn) {
      setHasCustomLabelColumn(false);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.custom_label;
      res = await supabase
        .from('event_map_fixtures')
        .insert(fallbackPayload)
        .select('id,type,x,y,w,h')
        .single();
    }

    if (res.error) {
      onError(res.error.message);
      return;
    }

    const fixtureData = res.data as unknown as {
      id: string | number;
      type: string;
      x?: number | string | null;
      y?: number | string | null;
      w?: number | string | null;
      h?: number | string | null;
      custom_label?: string | null;
    };

    const rawType = String(fixtureData.type ?? '');
    if (!isFixtureType(rawType)) return;
    setFixtures((prev) => [
      ...prev,
      {
        id: String(fixtureData.id),
        type: rawType,
        x: toNumber(fixtureData.x, 40),
        y: toNumber(fixtureData.y, 40),
        w: toNumber(fixtureData.w, cfg.w),
        h: toNumber(fixtureData.h, cfg.h),
        custom_label: typeof fixtureData.custom_label === 'string' ? fixtureData.custom_label : null,
      },
    ]);
  }

  async function deleteFixture(fixtureId: string) {
    const { error } = await supabase
      .from('event_map_fixtures')
      .delete()
      .eq('id', fixtureId);
    if (error) {
      onError(error.message);
      return;
    }
    setFixtures((prev) => prev.filter((fixture) => fixture.id !== fixtureId));
    if (selectedFixtureId === fixtureId) {
      setSelectedFixtureId(null);
    }
  }

  async function saveFixtureLabel() {
    if (!selectedFixture) return;
    if (!hasCustomLabelColumn) {
      setSelectedFixtureId(null);
      return;
    }
    const nextLabel = fixtureLabelDraft.trim();
    const fallback = FIXTURE_LIBRARY[selectedFixture.type].label;
    const customLabel = nextLabel && nextLabel !== fallback ? nextLabel : null;
    setSavingFixtureLabel(true);
    const { error } = await supabase
      .from('event_map_fixtures')
      .update({ custom_label: customLabel })
      .eq('id', selectedFixture.id);
    setSavingFixtureLabel(false);
    if (error) {
      onError(error.message);
      return;
    }
    setFixtures((prev) =>
      prev.map((fixture) =>
        fixture.id === selectedFixture.id
          ? {
              ...fixture,
              custom_label: customLabel,
            }
          : fixture,
      ),
    );
    setSelectedFixtureId(null);
  }

  async function resetMap() {
    const { error } = await supabase
      .from('event_map_fixtures')
      .delete()
      .eq('event_id', eventId);
    if (error) {
      onError(error.message);
      return;
    }
    setFixtures([]);
    setSelectedFixtureId(null);
  }

  function buildMapLines() {
    const lines: string[] = [];
    lines.push('Mapa de mesas - Painel Prime');
    lines.push('');
    lines.push('Mesas:');
    tables.forEach((table) => {
      const pos = tablePositionsRef.current[table.id] ?? { x: 0, y: 0 };
      const seats = toNumber(table.seats, 0);
      const occupied = occupancyByTable.get(table.id) ?? 0;
      lines.push(
        `- ${table.name || 'Mesa'} | ${occupied}/${seats} | x:${Math.round(pos.x)} y:${Math.round(
          pos.y,
        )}`,
      );
    });
    lines.push('');
    lines.push('Elementos do mapa:');
    fixtures.forEach((fixture) => {
      lines.push(
        `- ${fixtureLabel(fixture)} | ${fixture.type} | x:${Math.round(fixture.x)} y:${Math.round(
          fixture.y,
        )}`,
      );
    });
    return lines;
  }

  function showRecentExportAlert() {
    Alert.alert(
      'Exportação recente',
      'O mapa já foi exportado recentemente. Aguarde cerca de 10 segundos antes de tentar novamente.',
      [{ text: 'OK' }],
    );
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  async function exportMapPdf() {
    const now = Date.now();
    if (exportingPdfRef.current) {
      showRecentExportAlert();
      return;
    }

    if (now - lastPdfExportAtRef.current < 1000 * 10) {
      showRecentExportAlert();
      return;
    }

    if (!mapCaptureRef.current) {
      onError('O mapa ainda não está pronto para exportação.');
      return;
    }

    exportingPdfRef.current = true;
    setExportingPdf(true);

    try {
      const imageBase64 = await captureRef(mapCaptureRef, {
        format: 'png',
        quality: 1,
        result: 'base64',
      });
      const lines = buildMapLines();
      const summaryHtml = lines
        .map((line) => `<div>${escapeHtml(line)}</div>`)
        .join('');
      const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            .meta { font-size: 12px; color: #4B5563; margin-bottom: 16px; }
            .image-wrap { border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; margin-bottom: 16px; }
            img { width: 100%; max-width: 100%; height: auto; }
            .summary { font-size: 11px; line-height: 1.45; }
          </style>
        </head>
        <body>
          <h1>Mapa visual das mesas</h1>
          <div class="meta">Evento: ${eventId}</div>
          <div class="image-wrap">
            <img src="data:image/png;base64,${imageBase64}" />
          </div>
          <div class="summary">${summaryHtml}</div>
        </body>
      </html>`;
      const pdf = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdf.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exportar mapa em PDF',
        });
      } else {
        onError('Compartilhamento não disponível neste dispositivo.');
        return;
      }
      lastPdfExportAtRef.current = Date.now();
    } catch (exportError: any) {
      const message = String(exportError?.message ?? '');
      if (message.toLowerCase().includes('another share request is being processed')) {
        lastPdfExportAtRef.current = Date.now();
        showRecentExportAlert();
        return;
      }
      onError(exportError?.message ?? 'Falha ao exportar PDF do mapa.');
    } finally {
      exportingPdfRef.current = false;
      setExportingPdf(false);
    }
  }

  const mapSurface = (
    <View style={styles.mapFrame} ref={mapCaptureRef} collapsable={false}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.gridWrap}>
            <View style={styles.gridUnderlay}>
              {Array.from({ length: Math.floor(MAP_WIDTH / GRID) }).map((_, idx) => (
                <View key={`v-${idx}`} style={[styles.gridLineV, { left: idx * GRID }]} />
              ))}
              {Array.from({ length: Math.floor(MAP_HEIGHT / GRID) }).map((_, idx) => (
                <View key={`h-${idx}`} style={[styles.gridLineH, { top: idx * GRID }]} />
              ))}
            </View>

            {fixtures.map((fixture) => {
              const cfg = FIXTURE_LIBRARY[fixture.type];
              return (
                <View
                  key={fixture.id}
                  style={[
                    styles.fixtureCard,
                    {
                      left: fixture.x,
                      top: fixture.y,
                      width: fixture.w,
                      height: fixture.h,
                      backgroundColor: cfg.color,
                      borderColor: cfg.borderColor,
                    },
                  ]}
                  {...getFixturePanResponder(fixture.id).panHandlers}
                >
                  <Pressable
                    style={styles.fixtureBody}
                    onPress={() => setSelectedFixtureId(fixture.id)}
                  >
                    <View style={styles.fixtureIconBadge}>
                      <MaterialCommunityIcons
                        name={cfg.iconName}
                        size={15}
                        color={cfg.iconColor}
                      />
                    </View>
                    <Text style={styles.fixtureText} numberOfLines={2}>
                      {fixtureLabel(fixture)}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void deleteFixture(fixture.id)}
                    style={styles.fixtureDelete}
                  >
                    <Text style={styles.fixtureDeleteText}>x</Text>
                  </Pressable>
                </View>
              );
            })}

            {tables.map((table) => {
              const position = tablePositions[table.id] ?? { x: 40, y: 140 };
              const occupied = occupancyByTable.get(table.id) ?? 0;
              const seats = toNumber(table.seats, 0);
              const ratio = seats > 0 ? occupied / seats : 0;
              return (
                <View
                  key={table.id}
                  style={[
                    styles.tableCard,
                    {
                      left: position.x,
                      top: position.y,
                      borderColor: ratio >= 1 ? '#FCA5A5' : '#D1D5DB',
                    },
                  ]}
                  {...getTablePanResponder(table.id).panHandlers}
                >
                  <Text style={styles.tableTitle} numberOfLines={2}>
                    {table.name || 'Mesa'}
                  </Text>
                  {!!table.note && (
                    <Text style={styles.tableNote} numberOfLines={2}>
                      {table.note}
                    </Text>
                  )}
                  <Text style={styles.tableSeats}>
                    {occupied}/{seats} lugares
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mapa visual das mesas</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.ghostBtn} onPress={() => setIsFullscreen(true)}>
            <Text style={styles.ghostBtnText}>Tela cheia</Text>
          </Pressable>
          <Pressable
            style={[styles.ghostBtn, exportingPdf ? styles.ghostBtnDisabled : null]}
            disabled={exportingPdf}
            onPress={() => void exportMapPdf()}
          >
            {exportingPdf ? (
              <View style={styles.inlineLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primaryStrong} />
                <Text style={styles.ghostBtnText}>Exportando PDF...</Text>
              </View>
            ) : (
              <Text style={styles.ghostBtnText}>Exportar PDF (A4)</Text>
            )}
          </Pressable>
          <Pressable style={styles.warnBtn} onPress={() => void resetMap()}>
            <Text style={styles.warnBtnText}>Redefinir</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.fixtureLibrary}>
        {(Object.keys(FIXTURE_LIBRARY) as FixtureType[]).map((type) => {
          const cfg = FIXTURE_LIBRARY[type];
          return (
            <Pressable key={type} style={styles.fixtureChip} onPress={() => void addFixture(type)}>
              <MaterialCommunityIcons
                name={cfg.iconName}
                size={15}
                color={cfg.iconColor}
              />
              <Text style={styles.fixtureChipText}>{cfg.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {selectedFixture ? (
        <View style={styles.editRow}>
          <Text style={styles.caption}>
            Renomear item do mapa: {FIXTURE_LIBRARY[selectedFixture.type].label}
          </Text>
          <TextInput
            style={styles.input}
            value={fixtureLabelDraft}
            onChangeText={setFixtureLabelDraft}
            placeholder="Nome personalizado"
          />
          <View style={styles.actionsRow}>
            <Pressable style={styles.ghostBtn} onPress={() => setSelectedFixtureId(null)}>
              <Text style={styles.ghostBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => void saveFixtureLabel()}>
              <Text style={styles.primaryBtnText}>
                {savingFixtureLabel ? 'Salvando...' : 'Salvar nome'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {loadingFixtures ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primaryStrong} />
          <Text style={styles.caption}>Carregando mapa...</Text>
        </View>
      ) : (
        mapSurface
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.ghostBtn} onPress={() => void onReload()}>
          <Text style={styles.ghostBtnText}>Atualizar dados do servidor</Text>
        </Pressable>
      </View>

      <Modal visible={isFullscreen} animationType="slide">
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Mapa visual - tela cheia</Text>
            <Pressable style={styles.ghostBtn} onPress={() => setIsFullscreen(false)}>
              <Text style={styles.ghostBtnText}>Fechar</Text>
            </Pressable>
          </View>
          {mapSurface}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    padding: 10,
    gap: 8,
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 14 },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryBtn: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 12 },
  ghostBtn: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  ghostBtnDisabled: { opacity: 0.72 },
  ghostBtnText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  inlineLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warnBtn: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  warnBtnText: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  fixtureLibrary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fixtureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  fixtureChipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  caption: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  editRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    backgroundColor: colors.card,
  },
  loadingWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minHeight: 420,
  },
  gridWrap: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    backgroundColor: '#FFFFFF',
  },
  gridUnderlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#F3F4F6',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  tableCard: {
    position: 'absolute',
    width: 180,
    minHeight: 112,
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 4,
  },
  tableTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tableNote: { color: colors.mutedText, fontSize: 11 },
  tableSeats: { color: colors.primaryStrong, fontSize: 11, fontWeight: '700' },
  fixtureCard: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fixtureBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  fixtureIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureText: { color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  fixtureDelete: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixtureDeleteText: { color: '#6B7280', fontSize: 10, fontWeight: '700' },
  modalPage: { flex: 1, backgroundColor: colors.background, padding: 12, gap: 10 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
});

