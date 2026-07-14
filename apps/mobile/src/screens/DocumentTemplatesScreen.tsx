import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { PrimeLogoLoader } from '../components/PrimeLogoLoader';
import { Screen } from '../components/Screen';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { createDefaultMobileDocumentTemplate, normalizeMobileDocumentTemplate, serializeMobileDocumentTemplate, type MobileDocumentTemplate, type MobileTemplateKind } from '../features/clients/documentTemplateModel';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { shadows } from '../theme/tokens';

const templateDb = supabase as any;
const VARIABLES = [
  ['nome_cliente', 'Cliente'], ['email_cliente', 'E-mail'], ['telefone_cliente', 'Telefone'], ['tipo_evento', 'Evento'], ['data_evento', 'Data'], ['valor_total', 'Valor'], ['nome_assessoria', 'Assessoria'],
] as const;

export function DocumentTemplatesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [kind, setKind] = useState<MobileTemplateKind>('quote');
  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('Modelo de orçamento');
  const [description, setDescription] = useState('Proposta comercial da minha assessoria');
  const [template, setTemplate] = useState<MobileDocumentTemplate>(() => createDefaultMobileDocumentTemplate('quote'));
  const [selectedBlockId, setSelectedBlockId] = useState('intro');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setMessage('');
    const membership = await templateDb.from('tenant_memberships').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    const nextTenantId = String(membership.data?.tenant_id ?? '');
    if (!nextTenantId) { setMessage('Sua conta ainda não possui uma assessoria ativa.'); setLoading(false); return; }
    setTenantId(nextTenantId);
    const dbType = kind === 'quote' ? 'budget' : 'contract';
    const result = await templateDb.rpc('get_active_template', { p_tenant_id: nextTenantId, p_type: dbType });
    const row = result.data?.[0] as { name?: string; description?: string; content?: string } | undefined;
    setName(row?.name || (kind === 'quote' ? 'Modelo de orçamento' : 'Modelo de contrato'));
    setDescription(row?.description || (kind === 'quote' ? 'Proposta comercial da minha assessoria' : 'Contrato de prestação de serviços'));
    const nextTemplate = normalizeMobileDocumentTemplate(row?.content, kind);
    setTemplate(nextTemplate); setSelectedBlockId(nextTemplate.blocks[0]?.id ?? ''); setLoading(false);
  }, [kind, user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function chooseKind(next: MobileTemplateKind) { if (next !== kind) setKind(next); }
  function updateBlock(id: string, change: Partial<MobileDocumentTemplate['blocks'][number]>) { setTemplate((current) => ({ ...current, blocks: current.blocks.map((block) => block.id === id ? { ...block, ...change } : block) })); }
  function insertVariable(key: string) { const target = template.blocks.find((block) => block.id === selectedBlockId) ?? template.blocks[0]; if (target) updateBlock(target.id, { content: `${target.content}${target.content.endsWith(' ') || !target.content ? '' : ' '}{{${key}}}` }); }

  async function save() {
    if (!user?.id || !tenantId || saving) return;
    setSaving(true); setMessage('');
    const result = await templateDb.rpc('create_template_version', {
      p_tenant_id: tenantId,
      p_user_id: user.id,
      p_name: name.trim() || (kind === 'quote' ? 'Modelo de orçamento' : 'Modelo de contrato'),
      p_description: description.trim() || null,
      p_type: kind === 'quote' ? 'budget' : 'contract',
      p_content: serializeMobileDocumentTemplate(template),
    });
    setSaving(false);
    if (result.error) { setMessage(`Não foi possível salvar: ${result.error.message}`); return; }
    setMessage(`Modelo salvo como nova versão ${result.data?.[0]?.version ?? ''}. A Web e o Android já usarão este conteúdo.`);
  }

  if (loading) return <PrimeLogoLoader label="Abrindo seu estúdio de documentos" />;

  return <Screen>
    <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color={colors.text} /><Text style={styles.backText}>Clientes</Text></Pressable>
    <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="color-wand" size={25} color={colors.text} /></View><View style={styles.grow}><Text style={styles.eyebrow}>ESTÚDIO COMERCIAL</Text><Text style={styles.heroTitle}>Documentos com a sua identidade</Text><Text style={styles.heroText}>Edite uma vez. Os próximos orçamentos e contratos ficam prontos para cada cliente.</Text></View></View>
    <View style={styles.tabs}><Pressable style={[styles.tab, kind === 'quote' && styles.tabOn]} onPress={() => chooseKind('quote')}><Text style={[styles.tabText, kind === 'quote' && styles.tabTextOn]}>Orçamento</Text></Pressable><Pressable style={[styles.tab, kind === 'contract' && styles.tabOn]} onPress={() => chooseKind('contract')}><Text style={[styles.tabText, kind === 'contract' && styles.tabTextOn]}>Contrato</Text></Pressable></View>
    {message ? <Text style={message.startsWith('Não') || message.startsWith('Sua') ? styles.error : styles.success}>{message}</Text> : null}
    <View style={styles.card}><Header icon="create-outline" title="Identidade do modelo" subtitle="Nome interno, descrição e acabamento visual." /><Label text="Nome do modelo" /><TextInput style={styles.input} value={name} onChangeText={setName} /><Label text="Descrição" /><TextInput style={styles.input} value={description} onChangeText={setDescription} /><View style={styles.inline}><View style={styles.grow}><Label text="Cor de destaque" /><TextInput style={styles.input} value={template.style.accentColor} onChangeText={(value) => setTemplate({ ...template, style: { ...template.style, accentColor: value } })} autoCapitalize="characters" /></View><View style={[styles.colorPreview, { backgroundColor: /^#[0-9a-f]{6}$/i.test(template.style.accentColor) ? template.style.accentColor : colors.primary }]} /></View><Label text="Cabeçalho" /><View style={styles.pills}><Pill label="Alinhado à esquerda" on={template.style.headerAlign === 'left'} onPress={() => setTemplate({ ...template, style: { ...template.style, headerAlign: 'left' } })} /><Pill label="Centralizado" on={template.style.headerAlign === 'center'} onPress={() => setTemplate({ ...template, style: { ...template.style, headerAlign: 'center' } })} /></View><Label text="Rodapé" /><TextInput style={[styles.input, styles.textareaSmall]} multiline value={template.style.footerText} onChangeText={(value) => setTemplate({ ...template, style: { ...template.style, footerText: value } })} /></View>
    <View style={styles.card}><Header icon="layers-outline" title="Seções do documento" subtitle="Ative só o que faz sentido e escreva com a voz da sua assessoria." />{template.blocks.map((block) => <Pressable key={block.id} style={[styles.block, selectedBlockId === block.id && styles.blockSelected]} onPress={() => setSelectedBlockId(block.id)}><View style={styles.blockTop}><View style={styles.grow}><TextInput style={styles.blockTitle} value={block.title} onFocus={() => setSelectedBlockId(block.id)} onChangeText={(value) => updateBlock(block.id, { title: value })} /></View><Switch value={block.enabled} onValueChange={(value) => updateBlock(block.id, { enabled: value })} trackColor={{ false: colors.borderStrong, true: colors.primary }} thumbColor="#FFFFFF" /></View><TextInput style={styles.blockContent} value={block.content} editable={block.enabled} multiline onFocus={() => setSelectedBlockId(block.id)} onChangeText={(value) => updateBlock(block.id, { content: value })} placeholder="Escreva o conteúdo desta seção" /></Pressable>)}<Text style={styles.helper}>Toque numa seção e use os atalhos abaixo para inserir dados automáticos.</Text><View style={styles.variables}>{VARIABLES.map(([key, label]) => <Pressable key={key} style={styles.variable} onPress={() => insertVariable(key)}><Ionicons name="add" size={13} color={colors.primaryStrong} /><Text style={styles.variableText}>{label}</Text></Pressable>)}</View></View>
    <View style={styles.card}><Header icon="eye-outline" title="Prévia rápida" subtitle="Uma amostra do ritmo visual. Os dados reais entram quando o documento é gerado." /><View style={[styles.preview, { borderTopColor: template.style.accentColor }]}><Text style={[styles.previewBrand, { color: template.style.accentColor, textAlign: template.style.headerAlign }]}>PAINEL PRIME · SUA ASSESSORIA</Text><Text style={styles.previewTitle}>{kind === 'quote' ? 'Proposta para Cliente Exemplo' : 'Contrato de assessoria'}</Text>{template.blocks.filter((block) => block.enabled).slice(0, 4).map((block) => <View key={block.id} style={styles.previewBlock}><Text style={styles.previewBlockTitle}>{block.title}</Text><Text style={styles.previewText} numberOfLines={3}>{block.content.replaceAll('{{nome_cliente}}', 'Cliente Exemplo').replaceAll('{{tipo_evento}}', 'Evento').replaceAll('{{valor_total}}', 'R$ 8.900,00')}</Text></View>)}<Text style={styles.previewFooter}>{template.style.footerText}</Text></View></View>
    <Button title="Salvar nova versão" loading={saving} onPress={() => void save()} />
  </Screen>;
}

function Header({ icon, title, subtitle }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }) { return <View style={styles.header}><View style={styles.headerIcon}><Ionicons name={icon} size={20} color={colors.primaryStrong} /></View><View style={styles.grow}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View></View>; }
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) { return <Pressable style={[styles.pill, on && styles.pillOn]} onPress={onPress}><Text style={[styles.pillText, on && styles.pillTextOn]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 42 }, backText: { color: colors.text, fontWeight: '700' }, grow: { flex: 1, minWidth: 0 }, hero: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18, borderRadius: 23, backgroundColor: '#F2D875', borderWidth: 1, borderColor: '#E1BD3F', ...shadows.gold }, heroIcon: { width: 49, height: 49, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)' }, eyebrow: { color: '#73590E', fontSize: 9, letterSpacing: 1.1, fontWeight: '900' }, heroTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, heroText: { color: '#5C4A18', fontSize: 12, lineHeight: 17 }, tabs: { flexDirection: 'row', gap: 7, padding: 5, borderRadius: 16, backgroundColor: colors.surfaceSubtle }, tab: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, tabOn: { backgroundColor: colors.ink950 }, tabText: { color: colors.mutedText, fontSize: 13, fontWeight: '800' }, tabTextOn: { color: '#FFFFFF' },
  card: { gap: 11, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...shadows.sm }, header: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primarySoft }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 }, label: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' }, input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.background }, textareaSmall: { minHeight: 75, paddingTop: 11, textAlignVertical: 'top' }, inline: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, colorPreview: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, borderColor: '#FFFFFF' }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, pill: { minHeight: 39, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border }, pillOn: { backgroundColor: colors.primarySoft, borderColor: colors.primaryStrong }, pillText: { color: colors.mutedText, fontSize: 11, fontWeight: '700' }, pillTextOn: { color: colors.primaryStrong, fontWeight: '900' },
  block: { gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, blockSelected: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft }, blockTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, blockTitle: { color: colors.text, fontSize: 14, fontWeight: '900', paddingVertical: 5 }, blockContent: { minHeight: 82, padding: 11, borderRadius: 12, color: colors.text, backgroundColor: colors.card, textAlignVertical: 'top', fontSize: 12, lineHeight: 18 }, helper: { color: colors.mutedText, fontSize: 11 }, variables: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, variable: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.primarySoft }, variableText: { color: colors.primaryStrong, fontSize: 10, fontWeight: '800' },
  preview: { gap: 12, padding: 17, borderRadius: 16, borderWidth: 1, borderTopWidth: 5, borderColor: colors.border, backgroundColor: '#FFFFFF' }, previewBrand: { fontSize: 9, letterSpacing: 1.3, fontWeight: '900' }, previewTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, previewBlock: { gap: 4, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, previewBlockTitle: { color: colors.text, fontSize: 12, fontWeight: '900' }, previewText: { color: colors.textSecondary, fontSize: 10, lineHeight: 15 }, previewFooter: { color: colors.mutedText, fontSize: 8, textAlign: 'center' }, error: { color: colors.dangerText, backgroundColor: colors.dangerBg, padding: 12, borderRadius: 13 }, success: { color: colors.successText, backgroundColor: colors.successBg, padding: 12, borderRadius: 13 },
});
