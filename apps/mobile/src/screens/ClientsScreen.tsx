import { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { ClientEditorModal, ClientsHero, ClientsList, ClientsToolbar } from '../features/clients/ClientsPresentation';
import { createClient, functionErrorMessage, markClientLost, sendClientBudget, sendClientContract, updateClient } from '../features/clients/clientsCrmService';
import { filterClients, indexClientJourneys, journeyCounts } from '../features/clients/clientsScreenSelectors';
import { clientsStyles as styles } from '../features/clients/clientsScreenStyles';
import { EMPTY_CLIENT_FORM, type ClientForm, type ClientRow, type ListFilter } from '../features/clients/clientsScreenTypes';
import { useClientsData } from '../features/clients/useClientsData';
import { colors } from '../theme/colors';

export function ClientsScreen() {
  const router = useRouter(), insets = useSafeAreaInsets(), { user } = useAuth();
  const data = useClientsData(user?.id);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState<ListFilter>('active'), [workingId, setWorkingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false), [selectedId, setSelectedId] = useState<string | null>(null), [form, setForm] = useState<ClientForm>(EMPTY_CLIENT_FORM), [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => { void data.loadData(); }, [data.loadData]));
  const journeys = useMemo(() => indexClientJourneys(data.clients, data.documents, data.signatures), [data.clients, data.documents, data.signatures]);
  const counts = useMemo(() => journeyCounts(journeys), [journeys]);
  const visible = useMemo(() => filterClients(data.clients, journeys, search, filter), [data.clients, journeys, search, filter]);
  const selected = data.clients.find(({ id }) => id === selectedId) ?? null;
  const closeEditor = () => { setSelectedId(null); setCreateOpen(false); setForm(EMPTY_CLIENT_FORM); };
  const openDetails = (client: ClientRow) => router.push(`/(app)/(tabs)/clientes/${client.id}` as never);
  const saveClient = async () => { if (!user || !form.name.trim() || saving) return; setSaving(true); data.setError(''); const result = selected ? await updateClient(selected.id, form) : await createClient(user.id, form); setSaving(false); if (result.error || !result.data) { data.setError(selected ? 'Não foi possível salvar os dados do cliente.' : 'Não foi possível cadastrar o cliente. Confira os dados e tente novamente.'); return; } data.patchClient(result.data as ClientRow); closeEditor(); };
  const loseClient = (client: ClientRow) => Alert.alert('Encerrar esta oportunidade?', 'O cliente ficará em Perdidos e poderá ser consultado depois.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Marcar como perdido', style: 'destructive', onPress: () => void (async () => { const result = await markClientLost(client.id); if (result.error || !result.data) { data.setError('Não foi possível marcar o cliente como perdido.'); return; } data.patchClient(result.data as ClientRow); closeEditor(); })() }]);
  const withWorking = async (client: ClientRow, action: () => Promise<void>) => { setWorkingId(client.id); data.setError(''); try { await action(); await data.refreshArtifacts(client.id); } catch (error) { data.setError(await functionErrorMessage(error)); } finally { setWorkingId(null); } };
  const confirmBudget = (client: ClientRow) => { if (!client.email) { openDetails(client); data.setError('Adicione o e-mail do cliente antes de enviar o orçamento.'); return; } Alert.alert('Enviar orçamento?', `A proposta será gerada e enviada para ${client.email}.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Enviar', onPress: () => void withWorking(client, async () => { const result = await sendClientBudget(client.id); if (result.error) throw result.error; }) }]); };
  const confirmContract = (client: ClientRow) => { if (!client.email) { openDetails(client); data.setError('Adicione o e-mail do cliente antes de enviar o contrato.'); return; } Alert.alert('Enviar contrato para assinatura?', 'Ao continuar, você confirma o contrato pela assessoria e o envia ao cliente pelo Documenso.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar e enviar', onPress: () => void withWorking(client, () => sendClientContract(client)) }]); };
  const runPrimaryAction = async (client: ClientRow) => { const journey = journeys.get(client.id); if (!journey) return; if (journey.action === 'send_budget') confirmBudget(client); else if (journey.action === 'send_contract') confirmContract(client); else if ((journey.action === 'view_budget' || journey.action === 'view_signature') && journey.url && await Linking.canOpenURL(journey.url)) await Linking.openURL(journey.url); };
  if (data.loading) return <PrimeLogoLoader label="Organizando seus clientes" />;
  return <><Screen title="Clientes" subtitle="Do primeiro contato à assinatura"><ClientsHero counts={counts} /><View style={styles.primaryActionsRow}><View style={styles.primaryActionGrow}><Button title="Novo cliente" onPress={() => { setForm(EMPTY_CLIENT_FORM); setCreateOpen(true); }} /></View><Pressable style={styles.templatesButton} onPress={() => router.push('/(app)/(tabs)/clientes/modelos' as never)}><Ionicons name="color-wand-outline" size={19} color={colors.primaryStrong} /><Text style={styles.templatesButtonText}>Modelos</Text></Pressable></View>{data.error ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={colors.dangerText} /><Text style={styles.errorText}>{data.error}</Text></View> : null}<ClientsToolbar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} refreshing={data.refreshing} refresh={() => void data.loadData(true)} /><ClientsList clients={visible} journeys={journeys} search={search} workingId={workingId} openDetails={openDetails} primaryAction={(client) => void runPrimaryAction(client)} create={() => setCreateOpen(true)} /></Screen><ClientEditorModal visible={createOpen || Boolean(selected)} title={selected ? 'Detalhes do cliente' : 'Novo cliente'} form={form} setForm={setForm} close={closeEditor} save={() => void saveClient()} saving={saving} markLost={selected && journeys.get(selected.id)?.state !== 'lost' && journeys.get(selected.id)?.state !== 'closed' ? () => loseClient(selected) : undefined} bottomInset={insets.bottom} /></>;
}
