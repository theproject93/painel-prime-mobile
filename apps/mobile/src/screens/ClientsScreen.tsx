import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import {
  friendlyCrmError,
  presentClientJourney,
  type ClientJourneyPresentation,
} from '../features/clients/clientJourney';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { fontSize, fontWeight, radii, shadows, spacing } from '../theme/tokens';

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  event_type: string | null;
  event_date_expected: string | null;
  budget_expected: number | null;
  notes: string | null;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  client_id: string;
  doc_type: 'budget' | 'contract' | string;
  status: string;
  approval_status: string | null;
  external_url: string | null;
  external_status: string | null;
  signed_at: string | null;
  advisor_signed_at: string | null;
  updated_at: string;
};

type SignatureRow = {
  id: string;
  client_id: string;
  document_id: string;
  status: string;
  external_status: string | null;
  external_url: string | null;
  signed_at: string | null;
  created_at: string;
};

type ClientForm = {
  name: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  budget: string;
  notes: string;
};

type ListFilter = 'active' | 'closed' | 'lost';

const EMPTY_FORM: ClientForm = {
  name: '',
  email: '',
  phone: '',
  eventType: '',
  eventDate: '',
  budget: '',
  notes: '',
};

const CRM_WEB_BASE = process.env.EXPO_PUBLIC_APP_URL || 'https://app.painelprime.com.br';

function currency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Data a definir';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function badgeVariant(state: ClientJourneyPresentation['state']) {
  if (state === 'closed') return 'success' as const;
  if (state === 'lost') return 'danger' as const;
  if (state === 'signature_pending' || state === 'budget_pending') return 'warning' as const;
  if (state === 'contract_ready') return 'royal' as const;
  return 'gold' as const;
}

async function functionErrorMessage(error: unknown) {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const body = await context.clone().json();
      return friendlyCrmError(body);
    } catch {
      // A resposta pode não ser JSON; a tradução genérica abaixo não vaza detalhes.
    }
  }
  return friendlyCrmError(error);
}

export function ClientsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ListFilter>('active');
  const [workingClientId, setWorkingClientId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!user) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    const { data: clientData, error: clientError } = await supabase
      .from('crm_clients')
      .select('id,name,email,phone,stage,event_type,event_date_expected,budget_expected,notes,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (clientError) {
      setError('Não foi possível carregar seus clientes. Tente novamente.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const nextClients = (clientData ?? []) as ClientRow[];
    const clientIds = nextClients.map((client) => client.id);
    let nextDocuments: DocumentRow[] = [];
    let nextSignatures: SignatureRow[] = [];

    if (clientIds.length > 0) {
      const [documentsResult, signaturesResult] = await Promise.all([
        supabase
          .from('crm_client_documents')
          .select('id,client_id,doc_type,status,approval_status,external_url,external_status,signed_at,advisor_signed_at,updated_at')
          .in('client_id', clientIds)
          .in('doc_type', ['budget', 'contract'])
          .order('updated_at', { ascending: false }),
        (supabase.from('crm_signature_requests') as any)
          .select('id,client_id,document_id,status,external_status,external_url,signed_at,created_at')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false }),
      ]);

      if (documentsResult.error || signaturesResult.error) {
        setError('Alguns documentos não puderam ser atualizados. Puxe a tela para tentar novamente.');
      }
      nextDocuments = (documentsResult.data ?? []) as DocumentRow[];
      nextSignatures = (signaturesResult.data ?? []) as SignatureRow[];
    }

    setClients(nextClients);
    setDocuments(nextDocuments);
    setSignatures(nextSignatures);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const latestDocuments = useMemo(() => {
    const map = new Map<string, DocumentRow>();
    for (const document of documents) {
      const key = `${document.client_id}:${document.doc_type}`;
      if (!map.has(key)) map.set(key, document);
    }
    return map;
  }, [documents]);

  const latestSignatures = useMemo(() => {
    const map = new Map<string, SignatureRow>();
    for (const signature of signatures) {
      if (!map.has(signature.client_id)) map.set(signature.client_id, signature);
    }
    return map;
  }, [signatures]);

  const journeyByClient = useMemo(() => {
    const map = new Map<string, ClientJourneyPresentation>();
    for (const client of clients) {
      const budget = latestDocuments.get(`${client.id}:budget`);
      const contract = latestDocuments.get(`${client.id}:contract`);
      const signature = latestSignatures.get(client.id);
      map.set(client.id, presentClientJourney({
        stage: client.stage,
        budgetApprovalStatus: budget?.approval_status,
        budgetExternalUrl: budget?.external_url,
        contractSignedAt: contract?.signed_at,
        signatureStatus: signature?.status || signature?.external_status,
        signatureExternalUrl: signature?.external_url,
      }));
    }
    return map;
  }, [clients, latestDocuments, latestSignatures]);

  const counts = useMemo(() => {
    let active = 0;
    let waiting = 0;
    let closed = 0;
    for (const journey of journeyByClient.values()) {
      if (journey.state === 'closed') closed += 1;
      else if (journey.state !== 'lost') {
        active += 1;
        if (journey.state === 'budget_pending' || journey.state === 'signature_pending') waiting += 1;
      }
    }
    return { active, waiting, closed };
  }, [journeyByClient]);

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((client) => {
      const journey = journeyByClient.get(client.id);
      const matchesSearch = !term || `${client.name} ${client.email ?? ''} ${client.phone ?? ''}`.toLowerCase().includes(term);
      const matchesFilter =
        filter === 'closed'
          ? journey?.state === 'closed'
          : filter === 'lost'
            ? journey?.state === 'lost'
            : journey?.state !== 'closed' && journey?.state !== 'lost';
      return matchesSearch && matchesFilter;
    });
  }, [clients, filter, journeyByClient, search]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  function openDetails(client: ClientRow) {
    setSelectedClientId(client.id);
    setForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      eventType: client.event_type ?? '',
      eventDate: client.event_date_expected ?? '',
      budget: client.budget_expected ? String(client.budget_expected) : '',
      notes: client.notes ?? '',
    });
  }

  function closeEditor() {
    setSelectedClientId(null);
    setCreateOpen(false);
    setForm(EMPTY_FORM);
  }

  async function createClient() {
    if (!user || !form.name.trim() || saving) return;
    setSaving(true);
    setError('');
    const amount = Number(form.budget.replace(/\./g, '').replace(',', '.'));
    const { error: insertError } = await supabase.from('crm_clients').insert({
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      event_type: form.eventType.trim() || null,
      event_date_expected: form.eventDate.trim() || null,
      budget_expected: Number.isFinite(amount) ? amount : null,
      notes: form.notes.trim() || null,
      stage: 'conhecendo_cliente',
    } as any);
    setSaving(false);
    if (insertError) {
      setError('Não foi possível cadastrar o cliente. Confira os dados e tente novamente.');
      return;
    }
    closeEditor();
    await loadData(true);
  }

  async function updateClient() {
    if (!selectedClient || !form.name.trim() || saving) return;
    setSaving(true);
    setError('');
    const amount = Number(form.budget.replace(/\./g, '').replace(',', '.'));
    const { error: updateError } = await supabase
      .from('crm_clients')
      .update({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        event_type: form.eventType.trim() || null,
        event_date_expected: form.eventDate.trim() || null,
        budget_expected: Number.isFinite(amount) ? amount : null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedClient.id);
    setSaving(false);
    if (updateError) {
      setError('Não foi possível salvar os dados do cliente.');
      return;
    }
    closeEditor();
    await loadData(true);
  }

  async function sendBudget(client: ClientRow) {
    setWorkingClientId(client.id);
    setError('');
    const { error: sendError } = await supabase.functions.invoke('crm-send-budget', {
      body: { clientId: client.id },
    });
    if (sendError) setError(await functionErrorMessage(sendError));
    await loadData(true);
    setWorkingClientId(null);
  }

  async function sendContract(client: ClientRow) {
    setWorkingClientId(client.id);
    setError('');
    try {
      const generated = await supabase.functions.invoke('crm-generate-document', {
        body: { clientId: client.id, documentType: 'contract' },
      });
      if (generated.error) throw generated.error;
      const documentId = (generated.data as any)?.document?.id as string | undefined;
      if (!documentId) throw new Error('document_not_found');

      const signed = await supabase.functions.invoke('crm-sign-advisor-contract', {
        body: { clientId: client.id, documentId, accepted: true },
      });
      if (signed.error) throw signed.error;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('unauthorized');

      const response = await fetch(`${CRM_WEB_BASE}/api/crm/integrations/documenso/create-envelope`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          documentId,
          sendEmail: true,
          traceContext: {
            actionLabel: 'Enviar para assinatura',
            actionMessage: 'Envio iniciado pelo aplicativo Android',
          },
        }),
      });
      const responseBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) throw responseBody;
      const url = typeof responseBody.url === 'string' ? responseBody.url : null;
      if (url && (await Linking.canOpenURL(url))) await Linking.openURL(url);
    } catch (contractError) {
      setError(await functionErrorMessage(contractError));
    } finally {
      await loadData(true);
      setWorkingClientId(null);
    }
  }

  function confirmBudget(client: ClientRow) {
    if (!client.email) {
      openDetails(client);
      setError('Adicione o e-mail do cliente antes de enviar o orçamento.');
      return;
    }
    Alert.alert(
      'Enviar orçamento?',
      `A proposta será gerada e enviada para ${client.email}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: () => void sendBudget(client) },
      ],
    );
  }

  function confirmContract(client: ClientRow) {
    if (!client.email) {
      openDetails(client);
      setError('Adicione o e-mail do cliente antes de enviar o contrato.');
      return;
    }
    Alert.alert(
      'Enviar contrato para assinatura?',
      'Ao continuar, você confirma o contrato pela assessoria e o envia ao cliente pelo Documenso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar e enviar', onPress: () => void sendContract(client) },
      ],
    );
  }

  async function runPrimaryAction(client: ClientRow, journey: ClientJourneyPresentation) {
    if (journey.action === 'send_budget') confirmBudget(client);
    if (journey.action === 'send_contract') confirmContract(client);
    if ((journey.action === 'view_budget' || journey.action === 'view_signature') && journey.url) {
      if (await Linking.canOpenURL(journey.url)) await Linking.openURL(journey.url);
    }
  }

  function confirmLost(client: ClientRow) {
    Alert.alert('Encerrar esta oportunidade?', 'O cliente ficará em Perdidos e poderá ser consultado depois.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Marcar como perdido',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await supabase
              .from('crm_clients')
              .update({ stage: 'cliente_perdido', lost_at: new Date().toISOString() })
              .eq('id', client.id);
            closeEditor();
            await loadData(true);
          })();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color={colors.primaryStrong} size="large" />
      </View>
    );
  }

  return (
    <>
      <Screen title="Clientes" subtitle="Do primeiro contato à assinatura">
        <View style={styles.heroCard}>
          <View style={styles.heroHeading}>
            <View style={styles.heroIcon}>
              <Ionicons name="people" size={23} color={colors.text} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Jornada comercial</Text>
              <Text style={styles.heroSubtitle}>Veja quem precisa da sua atenção agora.</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <SummaryMetric value={counts.active} label="Em andamento" />
            <SummaryMetric value={counts.waiting} label="Com o cliente" />
            <SummaryMetric value={counts.closed} label="Fechados" />
          </View>
        </View>

        <Button
          title="Novo cliente"
          onPress={() => {
            setForm(EMPTY_FORM);
            setCreateOpen(true);
          }}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.dangerText} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={19} color={colors.mutedText} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar cliente"
            placeholderTextColor={colors.mutedText}
          />
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primaryStrong} />
          ) : (
            <Pressable onPress={() => void loadData(true)} hitSlop={10} accessibilityLabel="Atualizar clientes">
              <Ionicons name="refresh" size={20} color={colors.primaryStrong} />
            </Pressable>
          )}
        </View>

        <View style={styles.filters}>
          <FilterPill label="Em andamento" selected={filter === 'active'} onPress={() => setFilter('active')} />
          <FilterPill label="Fechados" selected={filter === 'closed'} onPress={() => setFilter('closed')} />
          <FilterPill label="Perdidos" selected={filter === 'lost'} onPress={() => setFilter('lost')} />
        </View>

        {visibleClients.length === 0 ? (
          <EmptyState
            title={search ? 'Nenhum cliente encontrado' : 'Sua jornada começa aqui'}
            message={search ? 'Tente outro nome, e-mail ou telefone.' : 'Cadastre um contato para preparar o primeiro orçamento.'}
            actionLabel={search ? undefined : 'Cadastrar cliente'}
            onAction={search ? undefined : () => setCreateOpen(true)}
          />
        ) : (
          <View style={styles.clientList}>
            {visibleClients.map((client) => {
              const journey = journeyByClient.get(client.id)!;
              const working = workingClientId === client.id;
              return (
                <View key={client.id} style={styles.clientCard}>
                  <View style={styles.clientTopRow}>
                    <View style={styles.clientIdentity}>
                      <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
                      <Text style={styles.clientContext} numberOfLines={1}>
                        {client.event_type || 'Evento a definir'} · {dateLabel(client.event_date_expected)}
                      </Text>
                    </View>
                    <Badge label={journey.label} variant={badgeVariant(journey.state)} />
                  </View>

                  <View style={styles.clientBody}>
                    <Text style={styles.clientHelper}>{journey.helper}</Text>
                    {client.budget_expected ? (
                      <Text style={styles.clientBudget}>{currency(client.budget_expected)}</Text>
                    ) : null}
                  </View>

                  <View style={styles.clientActions}>
                    <Pressable style={styles.detailButton} onPress={() => openDetails(client)}>
                      <Text style={styles.detailButtonText}>Ver detalhes</Text>
                    </Pressable>
                    {journey.actionLabel ? (
                      <Pressable
                        style={[styles.primaryAction, working && styles.disabled]}
                        disabled={working}
                        onPress={() => void runPrimaryAction(client, journey)}
                      >
                        {working ? (
                          <ActivityIndicator size="small" color={colors.primaryTextOn} />
                        ) : (
                          <>
                            <Text style={styles.primaryActionText}>{journey.actionLabel}</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.primaryTextOn} />
                          </>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Screen>

      <ClientEditorModal
        visible={createOpen || Boolean(selectedClient)}
        title={selectedClient ? 'Detalhes do cliente' : 'Novo cliente'}
        form={form}
        setForm={setForm}
        onClose={closeEditor}
        onSave={() => void (selectedClient ? updateClient() : createClient())}
        saving={saving}
        footer={selectedClient && journeyByClient.get(selectedClient.id)?.state !== 'lost' && journeyByClient.get(selectedClient.id)?.state !== 'closed' ? (
          <Pressable style={styles.lostButton} onPress={() => confirmLost(selectedClient)}>
            <Text style={styles.lostButtonText}>Marcar como perdido</Text>
          </Pressable>
        ) : null}
        bottomInset={insets.bottom}
      />
    </>
  );
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function FilterPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterPill, selected && styles.filterPillOn]} onPress={onPress}>
      <Text style={[styles.filterText, selected && styles.filterTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ClientEditorModal({
  visible,
  title,
  form,
  setForm,
  onClose,
  onSave,
  saving,
  footer,
  bottomInset,
}: {
  visible: boolean;
  title: string;
  form: ClientForm;
  setForm: React.Dispatch<React.SetStateAction<ClientForm>>;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  footer: React.ReactNode;
  bottomInset: number;
}) {
  const field = (key: keyof ClientForm) => (value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalSheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Field label="Nome *" value={form.name} onChangeText={field('name')} placeholder="Nome do cliente" />
            <Field label="E-mail" value={form.email} onChangeText={field('email')} placeholder="cliente@email.com" keyboardType="email-address" />
            <Field label="Telefone" value={form.phone} onChangeText={field('phone')} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
            <Field label="Tipo de evento" value={form.eventType} onChangeText={field('eventType')} placeholder="Casamento, aniversário..." />
            <Field label="Data prevista" value={form.eventDate} onChangeText={field('eventDate')} placeholder="AAAA-MM-DD" />
            <Field label="Valor estimado" value={form.budget} onChangeText={field('budget')} placeholder="0,00" keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Observações</Text>
            <TextInput
              style={[styles.fieldInput, styles.notesInput]}
              value={form.notes}
              onChangeText={field('notes')}
              placeholder="O que é importante lembrar?"
              placeholderTextColor={colors.mutedText}
              multiline
            />
            <Button title="Salvar cliente" onPress={onSave} loading={saving} disabled={!form.name.trim()} />
            {footer}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={styles.fieldInput}
        placeholderTextColor={colors.mutedText}
        autoCapitalize={props.keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  heroCard: { backgroundColor: colors.text, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.lg, ...shadows.elevated },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  heroCopy: { flex: 1, gap: 3 },
  heroTitle: { color: colors.card, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  heroSubtitle: { color: '#C9CED8', fontSize: fontSize.xs, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryMetric: { flex: 1, minWidth: 0, gap: 3 },
  summaryValue: { color: colors.primary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  summaryLabel: { color: '#C9CED8', fontSize: 10, lineHeight: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.md },
  errorText: { flex: 1, color: colors.dangerText, fontSize: fontSize.sm, lineHeight: 20 },
  searchWrap: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSize.md, paddingVertical: 0 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterPill: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  filterPillOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  filterText: { color: colors.mutedText, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  filterTextOn: { color: colors.primaryStrong, fontWeight: fontWeight.bold },
  clientList: { gap: spacing.md },
  clientCard: { backgroundColor: colors.card, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md, ...shadows.sm },
  clientTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  clientIdentity: { flex: 1, minWidth: 0, gap: 4 },
  clientName: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  clientContext: { color: colors.mutedText, fontSize: fontSize.xs },
  clientBody: { gap: 6 },
  clientHelper: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  clientBudget: { color: colors.primaryStrong, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  clientActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm },
  detailButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  detailButtonText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  primaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary },
  primaryActionText: { color: colors.primaryTextOn, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.55 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,17,21,0.58)' },
  modalSheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  modalHandle: { width: 44, height: 5, borderRadius: 99, alignSelf: 'center', marginTop: 10, backgroundColor: colors.borderStrong },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  modalContent: { padding: spacing.lg, gap: spacing.md },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  fieldInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.card, fontSize: fontSize.md },
  notesInput: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  lostButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lostButtonText: { color: colors.dangerText, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
