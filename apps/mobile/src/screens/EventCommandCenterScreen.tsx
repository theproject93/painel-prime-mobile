import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WalkthroughAnchorTarget } from '../components/WalkthroughAnchors';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredFile,
  getPrivateFileDownloadUrl,
  uploadPrivateAsset,
} from '../lib/r2FileStorage';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  couple: string | null;
  couple_portal_token: string | null;
};

type VendorRow = {
  id: string;
  name: string;
  category: string;
  control_token: string | null;
  expected_arrival_time: string | null;
  expected_done_time: string | null;
};

type CommandVendorStatus = 'pending' | 'en_route' | 'arrived' | 'done';

type StatusRow = {
  vendor_id: string;
  status: CommandVendorStatus;
  created_at: string;
  updated_by: 'assessoria' | 'fornecedor';
  note: string | null;
};

type AlertRow = {
  id: string;
  vendor_id: string;
  alert_type: 'arrival_pre_alert' | 'arrival_late' | 'done_late';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  dedupe_key: string;
  created_at: string;
};

type IncidentRow = {
  id: string;
  event_id: string;
  vendor_id: string | null;
  severity: 'warning' | 'critical';
  status: 'open' | 'resolved';
  title: string;
  note: string | null;
  action_plan: string | null;
  created_at: string;
  resolved_at: string | null;
  vendor?:
    | {
        name: string;
        category: string;
      }
    | {
        name: string;
        category: string;
      }[]
    | null;
};

type CoupleUpdateRow = {
  id: string;
  event_id: string;
  kind: 'info' | 'milestone' | 'celebration';
  title: string;
  message: string;
  photo_file_id?: string | null;
  photo_url: string | null;
  author_role: 'assessoria' | 'noivos';
  author_name: string | null;
  created_at: string;
};

type CommandConfig = {
  lead_minutes: number[];
  late_grace_minutes: number;
};

type ComputedAlert = {
  vendor_id: string;
  alert_type: 'arrival_pre_alert' | 'arrival_late' | 'done_late';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  dedupe_key: string;
  triggered_for: string | null;
};

const STATUS_LABEL: Record<CommandVendorStatus, string> = {
  pending: 'Aguardando',
  en_route: 'A caminho',
  arrived: 'Chegou',
  done: 'Finalizado',
};

function combineDateTime(dateStr: string, timeStr: string | null) {
  if (!timeStr) return null;
  const [hour, minute] = timeStr.split(':').map((row) => Number(row));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const base = new Date(dateStr);
  base.setHours(hour, minute, 0, 0);
  return base;
}

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

function dedupeAlerts(rows: ComputedAlert[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.dedupe_key)) return false;
    seen.add(row.dedupe_key);
    return true;
  });
}

async function hydrateCoupleUpdatePhotoUrls(rows: CoupleUpdateRow[]) {
  return Promise.all(
    rows.map(async (row) => {
      if (!row.photo_file_id) return row;

      try {
        const signedUrl = await getPrivateFileDownloadUrl(row.photo_file_id);
        return {
          ...row,
          photo_url: signedUrl,
        };
      } catch {
        return row;
      }
    }),
  );
}

export function EventCommandCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const eventId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'assessoria' | 'noivos'>('assessoria');

  const [event, setEvent] = useState<EventRow | null>(null);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [storedAlerts, setStoredAlerts] = useState<AlertRow[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [coupleUpdates, setCoupleUpdates] = useState<CoupleUpdateRow[]>([]);
  const [config, setConfig] = useState<CommandConfig>({
    lead_minutes: [60, 30, 15],
    late_grace_minutes: 10,
  });
  const [leadMinutesInput, setLeadMinutesInput] = useState('60,30,15');
  const [lateGraceInput, setLateGraceInput] = useState('10');

  const [savingConfig, setSavingConfig] = useState(false);
  const [savingIncident, setSavingIncident] = useState(false);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [savingCoupleUpdate, setSavingCoupleUpdate] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
    vendor_id: '',
    severity: 'warning' as 'warning' | 'critical',
    title: '',
    action_plan: '',
    note: '',
  });

  const [coupleUpdateForm, setCoupleUpdateForm] = useState({
    kind: 'info' as 'info' | 'milestone' | 'celebration',
    title: '',
    message: '',
  });
  const [coupleUpdatePhoto, setCoupleUpdatePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');

      const [eventRes, vendorsRes, statusRes, alertsRes, incidentsRes, configRes, updatesRes] = await Promise.all([
        supabase
          .from('events')
          .select('id,name,event_date,location,couple,couple_portal_token')
          .eq('id', eventId)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('event_vendors')
          .select('id,name,category,control_token,expected_arrival_time,expected_done_time')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true }),
        supabase
          .from('event_vendor_status')
          .select('vendor_id,status,created_at,updated_by,note')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false }),
        supabase
          .from('event_command_alerts')
          .select('id,vendor_id,alert_type,severity,message,dedupe_key,created_at')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('event_command_incidents')
          .select(
            'id,event_id,vendor_id,severity,status,title,note,action_plan,created_at,resolved_at,vendor:event_vendors(name,category)',
          )
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('event_command_config')
          .select('lead_minutes,late_grace_minutes')
          .eq('event_id', eventId)
          .maybeSingle(),
        supabase
          .from('event_couple_updates')
          .select('id,event_id,kind,title,message,photo_url,photo_file_id,author_role,author_name,created_at')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (eventRes.error || !eventRes.data) {
        setError(eventRes.error?.message ?? 'Evento não encontrado.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setEvent(eventRes.data as EventRow);
      if (!vendorsRes.error) setVendors((vendorsRes.data as VendorRow[]) ?? []);
      if (!statusRes.error) setStatusRows((statusRes.data as StatusRow[]) ?? []);
      if (!alertsRes.error) setStoredAlerts((alertsRes.data as AlertRow[]) ?? []);
      if (!incidentsRes.error) setIncidents((incidentsRes.data as IncidentRow[]) ?? []);
      if (!updatesRes.error) {
        const nextUpdates = await hydrateCoupleUpdatePhotoUrls((updatesRes.data as CoupleUpdateRow[]) ?? []);
        setCoupleUpdates(nextUpdates);
      }

      if (!configRes.error && configRes.data) {
        const loaded = configRes.data as CommandConfig;
        const lead = Array.isArray(loaded.lead_minutes) ? loaded.lead_minutes : [60, 30, 15];
        const grace = Number(loaded.late_grace_minutes ?? 10);
        const safeGrace = Number.isFinite(grace) && grace >= 0 ? grace : 10;
        setConfig({ lead_minutes: lead, late_grace_minutes: safeGrace });
        setLeadMinutesInput(lead.join(','));
        setLateGraceInput(String(safeGrace));
      } else {
        setConfig({ lead_minutes: [60, 30, 15], late_grace_minutes: 10 });
        setLeadMinutesInput('60,30,15');
        setLateGraceInput('10');
      }

      setLoading(false);
      setRefreshing(false);
    },
    [eventId, user],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestStatus = useMemo(() => {
    const map = new Map<string, StatusRow>();
    statusRows.forEach((row) => {
      if (!map.has(row.vendor_id)) map.set(row.vendor_id, row);
    });
    return map;
  }, [statusRows]);

  const computedAlerts = useMemo(() => {
    if (!event?.event_date) return [] as ComputedAlert[];
    const now = new Date();
    const leadMinutes = (config.lead_minutes ?? [60, 30, 15])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => b - a);
    const lateGrace = Number(config.late_grace_minutes ?? 10);
    const alerts: ComputedAlert[] = [];

    vendors.forEach((vendor) => {
      const currentStatus = latestStatus.get(vendor.id)?.status ?? 'pending';
      const expectedArrival = combineDateTime(event.event_date, vendor.expected_arrival_time);
      const expectedDone = combineDateTime(event.event_date, vendor.expected_done_time);

      if (expectedArrival && currentStatus !== 'arrived' && currentStatus !== 'done') {
        leadMinutes.forEach((minutes) => {
          const triggerAt = new Date(expectedArrival.getTime() - minutes * 60 * 1000);
          if (now >= triggerAt && now < expectedArrival) {
            const severity: ComputedAlert['severity'] =
              minutes <= 15 ? 'critical' : minutes <= 30 ? 'warning' : 'info';
            alerts.push({
              vendor_id: vendor.id,
              alert_type: 'arrival_pre_alert',
              severity,
              message: `${vendor.name}: faltam ${minutes} min para chegada prevista.`,
              dedupe_key: `${event.id}:${vendor.id}:arrival_pre:${minutes}`,
              triggered_for: toIsoOrNull(triggerAt),
            });
          }
        });

        const lateAt = new Date(expectedArrival.getTime() + lateGrace * 60 * 1000);
        if (now >= lateAt) {
          alerts.push({
            vendor_id: vendor.id,
            alert_type: 'arrival_late',
            severity: 'critical',
            message: `${vendor.name}: chegada atrasada (previsto ${vendor.expected_arrival_time}).`,
            dedupe_key: `${event.id}:${vendor.id}:arrival_late`,
            triggered_for: toIsoOrNull(lateAt),
          });
        }
      }

      if (expectedDone && currentStatus !== 'done') {
        const lateDoneAt = new Date(expectedDone.getTime() + lateGrace * 60 * 1000);
        if (now >= lateDoneAt) {
          alerts.push({
            vendor_id: vendor.id,
            alert_type: 'done_late',
            severity: 'warning',
            message: `${vendor.name}: finalização atrasada (previsto ${vendor.expected_done_time}).`,
            dedupe_key: `${event.id}:${vendor.id}:done_late`,
            triggered_for: toIsoOrNull(lateDoneAt),
          });
        }
      }
    });

    return dedupeAlerts(alerts);
  }, [config, event, latestStatus, vendors]);

  const incidentStats = useMemo(() => {
    const open = incidents.filter((row) => row.status === 'open').length;
    const resolved = incidents.filter((row) => row.status === 'resolved').length;
    return { open, resolved };
  }, [incidents]);

  const couplePortalUrl = useMemo(() => {
    if (!event?.couple_portal_token) return '';
    const base = process.env.EXPO_PUBLIC_BASE_NOIVOS_URL || 'https://painelprime.com.br/noivos';
    return `${base}/${event.couple_portal_token}`;
  }, [event?.couple_portal_token]);

  useEffect(() => {
    async function persistAlerts() {
      if (!eventId || computedAlerts.length === 0) return;
      const existing = new Set(storedAlerts.map((row) => row.dedupe_key));
      const toInsert = computedAlerts.filter((row) => !existing.has(row.dedupe_key));
      if (toInsert.length === 0) return;

      await supabase.from('event_command_alerts').insert(
        toInsert.map((row) => ({
          event_id: eventId,
          vendor_id: row.vendor_id,
          alert_type: row.alert_type,
          severity: row.severity,
          message: row.message,
          dedupe_key: row.dedupe_key,
          triggered_for: row.triggered_for,
        })),
      );

      const { data } = await supabase
        .from('event_command_alerts')
        .select('id,vendor_id,alert_type,severity,message,dedupe_key,created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(20);
      setStoredAlerts((data as AlertRow[]) ?? []);
    }

    void persistAlerts();
  }, [computedAlerts, eventId, storedAlerts]);

  async function updateVendorStatus(vendorId: string, status: CommandVendorStatus) {
    const { error: insertError } = await supabase.from('event_vendor_status').insert({
      event_id: eventId,
      vendor_id: vendorId,
      status,
      updated_by: 'assessoria',
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await loadData(true);
  }

  async function saveConfig() {
    const parsedLead = leadMinutesInput
      .split(',')
      .map((row) => Number(row.trim()))
      .filter((row) => Number.isFinite(row) && row >= 0);
    const uniqueLead = Array.from(new Set(parsedLead)).sort((a, b) => b - a);
    const grace = Number(lateGraceInput);
    const safeGrace = Number.isFinite(grace) && grace >= 0 ? grace : 10;
    setSavingConfig(true);
    const { error: upsertError } = await supabase.from('event_command_config').upsert({
      event_id: eventId,
      lead_minutes: uniqueLead.length > 0 ? uniqueLead : [60, 30, 15],
      late_grace_minutes: safeGrace,
      updated_at: new Date().toISOString(),
    });
    setSavingConfig(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    await loadData(true);
  }

  async function createIncident() {
    if (!user || savingIncident || !incidentForm.title.trim()) return;
    setSavingIncident(true);
    const { error: insertError } = await supabase.from('event_command_incidents').insert({
      event_id: eventId,
      vendor_id: incidentForm.vendor_id || null,
      severity: incidentForm.severity,
      status: 'open',
      title: incidentForm.title.trim(),
      note: incidentForm.note.trim() || null,
      action_plan: incidentForm.action_plan.trim() || null,
      created_by: user.id,
    });
    setSavingIncident(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setIncidentForm({
      vendor_id: '',
      severity: 'warning',
      title: '',
      action_plan: '',
      note: '',
    });
    await loadData(true);
  }

  async function resolveIncident(incidentId: string) {
    if (!user || resolvingIncidentId) return;
    setResolvingIncidentId(incidentId);
    const { error: updateError } = await supabase
      .from('event_command_incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', incidentId);
    setResolvingIncidentId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadData(true);
  }

  async function pickCouplePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Permissão para galeria não concedida.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setCoupleUpdatePhoto(result.assets[0]);
  }

  async function uploadCouplePhoto() {
    if (!coupleUpdatePhoto) return null;
    setUploadingPhoto(true);
    try {
      const ext = (coupleUpdatePhoto.fileName?.split('.').pop() ?? 'jpg').toLowerCase();
      const upload = await uploadPrivateAsset({
        uri: coupleUpdatePhoto.uri,
        fileName: `mural-${Date.now()}.${ext}`,
        contentType: coupleUpdatePhoto.mimeType ?? 'image/jpeg',
        byteSize: coupleUpdatePhoto.fileSize ?? null,
        entityType: 'couple_update_photo',
        entityId: eventId,
      });
      const signedUrl = await getPrivateFileDownloadUrl(upload.fileId);
      return { fileId: upload.fileId, url: signedUrl };
    } catch (uploadError: any) {
      setError(uploadError?.message ?? 'Não foi possível fazer upload da foto.');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function createCoupleUpdate() {
    if (!user || savingCoupleUpdate) return;
    const title = coupleUpdateForm.title.trim();
    const message = coupleUpdateForm.message.trim();
    if (!title || !message) return;
    setSavingCoupleUpdate(true);
    let uploadedPhoto: { fileId: string; url: string } | null = null;
    if (coupleUpdatePhoto) {
      uploadedPhoto = await uploadCouplePhoto();
      if (!uploadedPhoto) {
        setSavingCoupleUpdate(false);
        return;
      }
    }
    const { error: insertError } = await supabase.from('event_couple_updates').insert({
      event_id: eventId,
      user_id: user.id,
      kind: coupleUpdateForm.kind,
      title,
      message,
      photo_url: null,
      photo_file_id: uploadedPhoto?.fileId ?? null,
      author_role: 'assessoria',
      author_name: (user.user_metadata?.name as string | undefined) || 'Assessoria',
    });
    setSavingCoupleUpdate(false);
    if (insertError) {
      if (uploadedPhoto?.fileId) {
        void deleteStoredFile(uploadedPhoto.fileId).catch(() => {
          // Best effort only.
        });
      }
      setError(insertError.message);
      return;
    }
    setCoupleUpdateForm({ kind: 'info', title: '', message: '' });
    setCoupleUpdatePhoto(null);
    await loadData(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}>
      <Pressable onPress={() => router.push(`/eventos/${eventId}`)}>
        <Text style={styles.back}>Voltar para o evento</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <Text style={styles.title}>Torre de Comando</Text>
        <Text style={styles.subtitle}>{event?.couple?.trim() || event?.name || 'Evento'}</Text>
        <Text style={styles.caption}>
          {event?.event_date ? new Date(event.event_date).toLocaleDateString('pt-BR') : '--'} |{' '}
          {event?.location || 'Sem local'}
        </Text>
        <View style={styles.rowBtns}>
          <Pressable style={[styles.btnGhost, mode === 'assessoria' && styles.btnModeOn]} onPress={() => setMode('assessoria')}>
            <Text style={styles.smallText}>Modo assessoria</Text>
          </Pressable>
          <Pressable style={[styles.btnGhost, mode === 'noivos' && styles.btnModeOn]} onPress={() => setMode('noivos')}>
            <Text style={styles.smallText}>Modo noivos</Text>
          </Pressable>
          <Pressable style={styles.btnGhost} onPress={() => void loadData(true)}>
            <Text style={styles.smallText}>{refreshing ? 'Atualizando...' : 'Atualizar'}</Text>
          </Pressable>
        </View>
      </View>

      {!!error && <Text style={styles.err}>{error}</Text>}

      {mode === 'assessoria' ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Regras de alerta (SLA)</Text>
            <TextInput style={styles.input} value={leadMinutesInput} onChangeText={setLeadMinutesInput} placeholder="Pre-alerta (60,30,15)" />
            <TextInput style={styles.input} value={lateGraceInput} onChangeText={setLateGraceInput} placeholder="Tolerancia (min)" keyboardType="numeric" />
            <Pressable style={styles.btn} onPress={() => void saveConfig()}>
              <Text style={styles.btnText}>{savingConfig ? 'Salvando...' : 'Salvar regras'}</Text>
            </Pressable>
          </View>

          <WalkthroughAnchorTarget id="event_command.alerts" borderRadius={14}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Alertas ativos</Text>
              {computedAlerts.length === 0 ? <Text style={styles.caption}>Sem alertas computados no momento.</Text> : null}
              {computedAlerts.map((alert) => (
                <View key={alert.dedupe_key} style={[styles.alertRow, alert.severity === 'critical' ? styles.alertCritical : alert.severity === 'warning' ? styles.alertWarning : styles.alertInfo]}>
                  <Text style={styles.alertText}>{alert.message}</Text>
                </View>
              ))}
              {storedAlerts.slice(0, 5).map((alert) => (
                <Text key={alert.id} style={styles.caption}>
                  Histórico: {alert.message}
                </Text>
              ))}
            </View>
          </WalkthroughAnchorTarget>

          <WalkthroughAnchorTarget id="event_command.workflow" borderRadius={14}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Operação de fornecedores</Text>
              {vendors.length === 0 ? <Text style={styles.caption}>Sem fornecedores cadastrados.</Text> : null}
              {vendors.map((vendor) => {
                const current = latestStatus.get(vendor.id)?.status ?? 'pending';
                return (
                  <View key={vendor.id} style={styles.vendorCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.vendorName}>{vendor.name || 'Fornecedor'}</Text>
                      <Text style={styles.vendorStatus}>{STATUS_LABEL[current]}</Text>
                    </View>
                    <Text style={styles.caption}>
                      Previsto: {vendor.expected_arrival_time || '--:--'} - {vendor.expected_done_time || '--:--'}
                    </Text>
                    <View style={styles.rowBtns}>
                      <Pressable style={styles.btnGhost} onPress={() => void updateVendorStatus(vendor.id, 'en_route')}>
                        <Text style={styles.smallText}>A caminho</Text>
                      </Pressable>
                      <Pressable style={styles.btnGhost} onPress={() => void updateVendorStatus(vendor.id, 'arrived')}>
                        <Text style={styles.smallText}>Chegou</Text>
                      </Pressable>
                      <Pressable style={styles.btnGhost} onPress={() => void updateVendorStatus(vendor.id, 'done')}>
                        <Text style={styles.smallText}>Finalizado</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </WalkthroughAnchorTarget>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>SOS da assessoria</Text>
            <Text style={styles.caption}>Incidentes: {incidentStats.open} abertos | {incidentStats.resolved} resolvidos</Text>
            <TextInput style={styles.input} value={incidentForm.vendor_id} onChangeText={(value) => setIncidentForm((prev) => ({ ...prev, vendor_id: value }))} placeholder="vendor_id (opcional)" />
            <TextInput style={styles.input} value={incidentForm.title} onChangeText={(value) => setIncidentForm((prev) => ({ ...prev, title: value }))} placeholder="Título do incidente" />
            <TextInput style={styles.input} value={incidentForm.action_plan} onChangeText={(value) => setIncidentForm((prev) => ({ ...prev, action_plan: value }))} placeholder="Plano B / ação imediata" />
            <TextInput style={[styles.input, styles.area]} value={incidentForm.note} onChangeText={(value) => setIncidentForm((prev) => ({ ...prev, note: value }))} placeholder="Detalhes do incidente" multiline />
            <View style={styles.rowBtns}>
              <Pressable style={styles.btnGhost} onPress={() => setIncidentForm((prev) => ({ ...prev, severity: 'warning' }))}>
                <Text style={styles.smallText}>Severidade warning</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => setIncidentForm((prev) => ({ ...prev, severity: 'critical' }))}>
                <Text style={styles.smallText}>Severidade critical</Text>
              </Pressable>
            </View>
            <Pressable style={styles.btnDanger} onPress={() => void createIncident()}>
              <Text style={styles.btnDangerText}>{savingIncident ? 'Registrando...' : 'Acionar SOS'}</Text>
            </Pressable>
            {incidents.map((incident) => {
              const vendorInfo = Array.isArray(incident.vendor) ? incident.vendor[0] : incident.vendor;
              return (
                <View key={incident.id} style={[styles.incidentCard, incident.status === 'open' ? styles.incidentOpen : styles.incidentResolved]}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.vendorName}>{incident.title}</Text>
                    <Text style={styles.caption}>{incident.severity.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.caption}>
                    {vendorInfo?.name ?? 'Sem fornecedor'} | {new Date(incident.created_at).toLocaleString('pt-BR')}
                  </Text>
                  {incident.action_plan ? <Text style={styles.caption}>Plano: {incident.action_plan}</Text> : null}
                  {incident.note ? <Text style={styles.caption}>Nota: {incident.note}</Text> : null}
                  {incident.status === 'open' ? (
                    <Pressable style={styles.btnGhost} onPress={() => void resolveIncident(incident.id)}>
                      <Text style={styles.smallText}>{resolvingIncidentId === incident.id ? 'Resolvendo...' : 'Marcar como resolvido'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Canal Assessoria x Noivos</Text>
            <Text style={styles.caption}>Mural compartilhado em tempo real.</Text>
            {couplePortalUrl ? (
              <Pressable style={styles.btnGhost} onPress={() => void Share.share({ message: couplePortalUrl })}>
                <Text style={styles.smallText}>Compartilhar link dos noivos</Text>
              </Pressable>
            ) : (
              <Text style={styles.caption}>Token do portal ainda indisponível.</Text>
            )}
            <View style={styles.rowBtns}>
              <Pressable style={[styles.btnGhost, coupleUpdateForm.kind === 'info' && styles.btnModeOn]} onPress={() => setCoupleUpdateForm((prev) => ({ ...prev, kind: 'info' }))}>
                <Text style={styles.smallText}>Info</Text>
              </Pressable>
              <Pressable style={[styles.btnGhost, coupleUpdateForm.kind === 'milestone' && styles.btnModeOn]} onPress={() => setCoupleUpdateForm((prev) => ({ ...prev, kind: 'milestone' }))}>
                <Text style={styles.smallText}>Marco</Text>
              </Pressable>
              <Pressable style={[styles.btnGhost, coupleUpdateForm.kind === 'celebration' && styles.btnModeOn]} onPress={() => setCoupleUpdateForm((prev) => ({ ...prev, kind: 'celebration' }))}>
                <Text style={styles.smallText}>Celebração</Text>
              </Pressable>
            </View>
            <TextInput style={styles.input} value={coupleUpdateForm.title} onChangeText={(value) => setCoupleUpdateForm((prev) => ({ ...prev, title: value }))} placeholder="Título da atualização" />
            <TextInput style={[styles.input, styles.area]} value={coupleUpdateForm.message} onChangeText={(value) => setCoupleUpdateForm((prev) => ({ ...prev, message: value }))} placeholder="Mensagem para os noivos" multiline />
            <Pressable style={styles.btnGhost} onPress={() => void pickCouplePhoto()}>
              <Text style={styles.smallText}>{coupleUpdatePhoto ? 'Trocar foto' : 'Anexar foto (opcional)'}</Text>
            </Pressable>
            {coupleUpdatePhoto ? <Text style={styles.caption}>{coupleUpdatePhoto.fileName || 'imagem selecionada'}</Text> : null}
            <Pressable style={styles.btn} onPress={() => void createCoupleUpdate()}>
              <Text style={styles.btnText}>{savingCoupleUpdate || uploadingPhoto ? 'Publicando...' : 'Publicar no mural'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preview noivos</Text>
          <Text style={styles.caption}>Tudo que o casal enxerga no mural do portal.</Text>
          {coupleUpdates.length === 0 ? <Text style={styles.caption}>Nenhuma publicação ainda.</Text> : null}
          {coupleUpdates.map((item) => (
            <View key={item.id} style={styles.updateCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.vendorName}>{item.title}</Text>
                <Text style={styles.caption}>{item.author_name || (item.author_role === 'noivos' ? 'Noivos' : 'Assessoria')}</Text>
              </View>
              <Text style={styles.caption}>{new Date(item.created_at).toLocaleString('pt-BR')}</Text>
              <Text style={styles.updateMessage}>{item.message}</Text>
              {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.updateImage} /> : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  back: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  headerCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  caption: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  err: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.card },
  area: { minHeight: 90, textAlignVertical: 'top' },
  btn: { minHeight: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { color: colors.primaryTextOn, fontWeight: '700', fontSize: 13 },
  btnGhost: { minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.card },
  btnModeOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  smallText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  alertRow: { borderWidth: 1, borderRadius: 10, padding: 10 },
  alertInfo: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  alertWarning: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  alertCritical: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  alertText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  vendorCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 6 },
  vendorName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  vendorStatus: { color: colors.primaryStrong, fontSize: 12, fontWeight: '700' },
  btnDanger: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  btnDangerText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
  incidentCard: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  incidentOpen: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  incidentResolved: { borderColor: '#BBF7D0', backgroundColor: '#ECFDF5' },
  updateCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 6, backgroundColor: '#F8FAFC' },
  updateMessage: { color: colors.text, fontSize: 13, lineHeight: 19 },
  updateImage: { width: '100%', height: 170, borderRadius: 10, backgroundColor: '#E5E7EB' },
});
