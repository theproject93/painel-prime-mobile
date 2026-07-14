import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Screen } from '../components/Screen';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { callCrmWebApi } from '../features/clients/crmWebApi';
import { normalizePapermarkInsights, papermarkEngagementScore, safeExternalHttpUrl, type PapermarkInsights } from '../features/clients/clientWorkspace';
import { presentClientJourney } from '../features/clients/clientJourney';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { radii, shadows, spacing } from '../theme/tokens';

type Client = { id: string; name: string; email: string | null; phone: string | null; stage: string; event_type: string | null; event_date_expected: string | null; budget_expected: number | null; notes: string | null };
type Document = { id: string; doc_type: string; status: string; approval_status: string | null; external_provider: string | null; external_url: string | null; external_status: string | null; signed_at: string | null; advisor_signed_at: string | null; updated_at: string };
type Signature = { status: string; external_status: string | null; external_url: string | null };

function money(value: number | null) { return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function date(value: string | null) { if (!value) return 'Data a definir'; const [y, m, d] = value.slice(0, 10).split('-'); return y && m && d ? `${d}/${m}/${y}` : value; }
function duration(seconds: number) { const minutes = Math.round(seconds / 60); return minutes < 1 ? `${Math.round(seconds)}s` : `${minutes} min`; }

export function ClientWorkspaceScreen({ clientId }: { clientId: string }) {
  const router = useRouter();
  const db = supabase as any;
  const [client, setClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [analytics, setAnalytics] = useState<PapermarkInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', eventType: '', eventDate: '', budget: '', notes: '' });

  const budget = documents.find((item) => item.doc_type === 'budget') ?? null;
  const contract = documents.find((item) => item.doc_type === 'contract') ?? null;
  const journey = useMemo(() => client ? presentClientJourney({
    stage: client.stage,
    budgetApprovalStatus: budget?.approval_status,
    budgetExternalUrl: budget?.external_url,
    contractSignedAt: contract?.signed_at,
    signatureStatus: signature?.status || signature?.external_status,
    signatureExternalUrl: signature?.external_url,
  }) : null, [budget, client, contract, signature]);

  const loadAnalytics = useCallback(async (nextBudget: Document | null) => {
    if (!nextBudget || nextBudget.external_provider !== 'papermark') { setAnalytics(null); return; }
    try {
      const result = await callCrmWebApi<{ analytics: unknown }>(`/api/crm/integrations/papermark/analytics?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(nextBudget.id)}`);
      const score = papermarkEngagementScore(result.analytics);
      setAnalytics(normalizePapermarkInsights(result.analytics, score));
    } catch (cause) {
      console.warn('Papermark analytics unavailable', cause);
      setAnalytics(null);
    }
  }, [clientId]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [clientResult, documentResult, signatureResult] = await Promise.all([
      db.from('crm_clients').select('id,name,email,phone,stage,event_type,event_date_expected,budget_expected,notes').eq('id', clientId).maybeSingle(),
      db.from('crm_client_documents').select('id,doc_type,status,approval_status,external_provider,external_url,external_status,signed_at,advisor_signed_at,updated_at').eq('client_id', clientId).in('doc_type', ['budget', 'contract']).order('updated_at', { ascending: false }),
      db.from('crm_signature_requests').select('status,external_status,external_url').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (clientResult.error || !clientResult.data) { setError('Cliente não encontrado ou sem acesso.'); setLoading(false); return; }
    const nextClient = clientResult.data as Client;
    const nextDocuments = (documentResult.data ?? []) as Document[];
    setClient(nextClient); setDocuments(nextDocuments); setSignature(signatureResult.data as Signature | null);
    setForm({ name: nextClient.name, email: nextClient.email ?? '', phone: nextClient.phone ?? '', eventType: nextClient.event_type ?? '', eventDate: nextClient.event_date_expected ?? '', budget: nextClient.budget_expected ? String(nextClient.budget_expected) : '', notes: nextClient.notes ?? '' });
    await loadAnalytics(nextDocuments.find((item) => item.doc_type === 'budget') ?? null);
    setLoading(false);
  }, [clientId, db, loadAnalytics]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function run(key: string, operation: () => Promise<void>) {
    if (busy) return; setBusy(key); setError('');
    try { await operation(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir esta ação.'); }
    finally { setBusy(''); }
  }

  async function saveClient() {
    const amount = Number(form.budget.replace(/\./g, '').replace(',', '.'));
    const { error: saveError } = await db.from('crm_clients').update({ name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, event_type: form.eventType.trim() || null, event_date_expected: form.eventDate.trim() || null, budget_expected: Number.isFinite(amount) ? amount : null, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', clientId);
    if (saveError) throw saveError;
    setEditing(false);
  }

  async function generate(type: 'budget' | 'contract') {
    const { error: generateError } = await supabase.functions.invoke('crm-generate-document', { body: { clientId, documentType: type } });
    if (generateError) throw generateError;
  }

  async function sendBudget() {
    if (!client?.email) throw new Error('Cadastre o e-mail do cliente antes de enviar.');
    const { error: sendError } = await supabase.functions.invoke('crm-send-budget', { body: { clientId } });
    if (sendError) throw sendError;
  }

  async function createPapermarkLink() {
    if (!budget) throw new Error('Gere o orçamento antes de criar o link de leitura.');
    const result = await callCrmWebApi<{ url: string | null }>('/api/crm/integrations/papermark/create', { method: 'POST', body: { clientId, documentId: budget.id } });
    const url = safeExternalHttpUrl(result.url);
    if (url) await Linking.openURL(url);
  }

  async function openUrl(raw: string | null | undefined) { const url = safeExternalHttpUrl(raw); if (url) await Linking.openURL(url); else Alert.alert('Link indisponível', 'Gere ou sincronize o documento para criar um link seguro.'); }

  if (loading) return <PrimeLogoLoader label="Preparando o atendimento" />;
  if (!client) return <Screen title="Cliente"><Text style={styles.error}>{error}</Text><Button title="Voltar" onPress={() => router.back()} /></Screen>;

  return (
    <Screen>
      <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.text} /><Text style={styles.backText}>Clientes</Text></Pressable>
      <View style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.grow}><Text style={styles.eyebrow}>ATENDIMENTO COMERCIAL</Text><Text style={styles.name}>{client.name}</Text><Text style={styles.context}>{client.event_type || 'Evento a definir'} · {date(client.event_date_expected)}</Text></View>
        <Pressable style={styles.iconButton} onPress={() => setEditing((value) => !value)} accessibilityLabel="Editar cliente"><Ionicons name="create-outline" size={20} color={colors.text} /></Pressable>
      </View>

      {journey ? <View style={styles.nextCard}><View style={styles.nextIcon}><Ionicons name="sparkles" size={21} color="#17181D" /></View><View style={styles.grow}><Text style={styles.nextLabel}>PRÓXIMO PASSO</Text><Text style={styles.nextTitle}>{journey.label}</Text><Text style={styles.nextText}>{journey.helper}</Text></View></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {editing ? <View style={styles.card}><SectionTitle icon="person-outline" title="Dados do cliente" subtitle="Informações usadas nos documentos e integrações." /><Field label="Nome" value={form.name} onChangeText={(value) => setForm({ ...form, name: value })} /><Field label="E-mail" value={form.email} onChangeText={(value) => setForm({ ...form, email: value })} keyboardType="email-address" /><Field label="Telefone" value={form.phone} onChangeText={(value) => setForm({ ...form, phone: value })} keyboardType="phone-pad" /><View style={styles.twoColumns}><View style={styles.grow}><Field label="Tipo de evento" value={form.eventType} onChangeText={(value) => setForm({ ...form, eventType: value })} /></View><View style={styles.grow}><Field label="Data" value={form.eventDate} onChangeText={(value) => setForm({ ...form, eventDate: value })} placeholder="AAAA-MM-DD" /></View></View><Field label="Valor estimado" value={form.budget} onChangeText={(value) => setForm({ ...form, budget: value })} keyboardType="numeric" /><Field label="Observações" value={form.notes} onChangeText={(value) => setForm({ ...form, notes: value })} multiline /><Button title="Salvar alterações" loading={busy === 'save'} onPress={() => void run('save', saveClient)} /></View> : null}

      <View style={styles.card}>
        <SectionTitle icon="documents-outline" title="Proposta e contrato" subtitle="Prepare uma vez, acompanhe a leitura e conduza até a assinatura." />
        <Pressable style={styles.templatesLink} onPress={() => router.push('/(app)/(tabs)/clientes/modelos' as never)}><View style={styles.templateIcon}><Ionicons name="color-wand-outline" size={19} color={colors.primaryStrong} /></View><View style={styles.grow}><Text style={styles.templatesTitle}>Modelos da sua assessoria</Text><Text style={styles.muted}>Edite textos, seções e identidade do orçamento e contrato.</Text></View><Ionicons name="chevron-forward" size={19} color={colors.mutedText} /></Pressable>
        <DocumentCard title="Orçamento" icon="wallet-outline" status={budget?.approval_status || budget?.status || 'Ainda não criado'} value={client.budget_expected ? money(client.budget_expected) : 'Valor a definir'} busy={Boolean(busy)} onGenerate={() => void run('budget', () => generate('budget'))} onOpen={budget?.external_url ? () => void openUrl(budget.external_url) : undefined} onSend={() => void run('send-budget', sendBudget)} />
        <DocumentCard title="Contrato" icon="create-outline" status={contract?.signed_at ? 'Assinado' : contract?.status || 'Ainda não criado'} value={contract?.advisor_signed_at ? 'Assinado pela assessoria' : 'Aguardando preparação'} busy={Boolean(busy)} onGenerate={() => void run('contract', () => generate('contract'))} onOpen={contract?.external_url ? () => void openUrl(contract.external_url) : undefined} />
      </View>

      <View style={[styles.card, styles.insightCard]}>
        <SectionTitle icon="analytics-outline" title="Interesse na proposta" subtitle="Sinais reais de leitura do Papermark para escolher a hora certa do follow-up." />
        {analytics ? <><View style={styles.scoreRow}><View style={styles.scoreCircle}><Text style={styles.score}>{analytics.score}</Text><Text style={styles.scoreUnit}>/100</Text></View><View style={styles.grow}><Text style={styles.insightTitle}>{analytics.score >= 60 ? 'Cliente quente' : analytics.score >= 20 ? 'Cliente interessado' : 'Aguardando leitura'}</Text><Text style={styles.muted}>{analytics.score >= 60 ? 'É uma boa hora para conversar e conduzir a aprovação.' : analytics.totalViews ? 'Já existe interesse. Tire dúvidas e ofereça o próximo passo.' : 'Compartilhe a proposta e acompanhe a primeira leitura.'}</Text></View></View><View style={styles.metrics}><Metric value={String(analytics.totalViews)} label="visualizações" /><Metric value={duration(analytics.totalDurationSeconds)} label="tempo de leitura" /><Metric value={analytics.lastViewedAt ? date(analytics.lastViewedAt) : '—'} label="último acesso" /></View>{analytics.topPages.length ? <Text style={styles.topPage}>Mais atenção na página {analytics.topPages[0].pageNumber} · {duration(analytics.topPages[0].durationSeconds)}</Text> : null}</> : <View style={styles.emptyInsights}><Ionicons name="eye-outline" size={28} color={colors.primaryStrong} /><Text style={styles.insightTitle}>{budget?.external_provider === 'papermark' ? 'Sem leituras registradas' : 'Ative a leitura inteligente'}</Text><Text style={styles.muted}>{budget?.external_provider === 'papermark' ? 'Quando o cliente abrir a proposta, as métricas aparecerão aqui.' : 'Crie um link Papermark para saber quando e por quanto tempo a proposta foi lida.'}</Text></View>}
        <Button title={budget?.external_provider === 'papermark' ? 'Atualizar métricas' : 'Criar link de leitura'} loading={busy === 'papermark'} onPress={() => void run('papermark', budget?.external_provider === 'papermark' ? async () => { await loadAnalytics(budget); } : createPapermarkLink)} />
      </View>
    </Screen>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }) { return <View style={styles.sectionHeading}><View style={styles.sectionIcon}><Ionicons name={icon} size={20} color={colors.primaryStrong} /></View><View style={styles.grow}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View></View>; }
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput {...props} style={[styles.input, props.multiline && styles.multiline]} placeholderTextColor={colors.mutedText} /></View>; }
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function DocumentCard({ title, icon, status, value, busy, onGenerate, onOpen, onSend }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; status: string; value: string; busy: boolean; onGenerate: () => void; onOpen?: () => void; onSend?: () => void }) { return <View style={styles.documentCard}><View style={styles.documentTop}><View style={styles.documentIcon}><Ionicons name={icon} size={20} color={colors.text} /></View><View style={styles.grow}><Text style={styles.documentTitle}>{title}</Text><Text style={styles.muted}>{value}</Text></View><Badge label={status.replaceAll('_', ' ')} variant={status.includes('approved') || status.includes('signed') || status.includes('Assinado') ? 'success' : 'gold'} /></View><View style={styles.actionRow}><Pressable disabled={busy} style={styles.softAction} onPress={onGenerate}><Text style={styles.softActionText}>{status === 'Ainda não criado' ? 'Criar' : 'Atualizar'}</Text></Pressable>{onOpen ? <Pressable disabled={busy} style={styles.softAction} onPress={onOpen}><Text style={styles.softActionText}>Visualizar</Text></Pressable> : null}{onSend ? <Pressable disabled={busy} style={styles.darkAction} onPress={onSend}>{busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.darkActionText}>Enviar</Text>}</Pressable> : null}</View></View>; }

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 42 }, backText: { color: colors.text, fontWeight: '700' }, grow: { flex: 1, minWidth: 0 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, borderRadius: 23, backgroundColor: colors.ink950, ...shadows.elevated }, avatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }, avatarText: { color: colors.text, fontSize: 22, fontWeight: '900' }, eyebrow: { color: colors.primary, fontSize: 9, letterSpacing: 1.2, fontWeight: '900' }, name: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, context: { color: '#BCC1CC', fontSize: 12 }, iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  nextCard: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#F2D875', borderWidth: 1, borderColor: '#E1BD3F' }, nextIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.65)' }, nextLabel: { color: '#73590E', fontSize: 9, letterSpacing: 1, fontWeight: '900' }, nextTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, nextText: { color: '#5C4A18', fontSize: 12, lineHeight: 18 },
  card: { gap: 14, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...shadows.sm }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 }, sectionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  templatesLink: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 16, backgroundColor: colors.primarySoft }, templateIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, templatesTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  documentCard: { gap: 12, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, documentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, documentIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, documentTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, softAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, softActionText: { color: colors.text, fontSize: 12, fontWeight: '800' }, darkAction: { minWidth: 82, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.ink950 }, darkActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  insightCard: { borderColor: '#D8C07A' }, scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 13 }, scoreCircle: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink950 }, score: { color: colors.primary, fontSize: 25, fontWeight: '900' }, scoreUnit: { color: '#BFC4CF', fontSize: 10 }, insightTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, metrics: { flexDirection: 'row', gap: 8 }, metric: { flex: 1, minWidth: 0, gap: 3, padding: 10, borderRadius: 14, backgroundColor: colors.surfaceSubtle }, metricValue: { color: colors.text, fontSize: 14, fontWeight: '900' }, metricLabel: { color: colors.mutedText, fontSize: 9, lineHeight: 12 }, topPage: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' }, emptyInsights: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  field: { gap: 5 }, label: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' }, input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background }, multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }, twoColumns: { flexDirection: 'row', gap: 9 }, error: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.md },
});
