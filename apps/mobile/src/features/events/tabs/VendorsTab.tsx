import { Pressable, Text, TextInput, View } from 'react-native';
import { PrimeLogoLoader } from '../../../components/PrimeLogoLoader';
import { EventEmptyState, EventFilterChips, EventFormSheet, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { vendorStatusLabel } from '../eventWorkspaceUtils';
import { styles } from '../eventDetailsStyles';

export type VendorsTabModel = {
  vendors: any[]; visibleVendors: any[]; filteredCount: number; visibleLimit: number; catalog: any[]; loadingCatalog: boolean;
  search: string; sort: string; composerOpen: boolean; name: string; category: string; phone: string; email: string; arrival: string; done: string;
  receiptCounts: Map<string, number>; hasMore: boolean; loadingMore: boolean;
  onSearchChange: (value: string) => void; onSortChange: (value: string) => void; onOpenComposer: () => void; onCloseComposer: () => void;
  onLinkCatalog: (id: string) => void; onAdvance: (vendor: any) => void; onOpenBudget: (id: string) => void; onOpenDocuments: (id: string) => void;
  onDelete: (id: string) => void; onShowMore: () => void; onLoadMore: () => void;
  onNameChange: (v: string) => void; onCategoryChange: (v: string) => void; onPhoneChange: (v: string) => void; onEmailChange: (v: string) => void;
  onArrivalChange: (v: string) => void; onDoneChange: (v: string) => void; onCreate: () => void;
};

export function VendorsTab({ model: m }: { model: VendorsTabModel }) {
  const available = m.catalog.filter((vendor) => !m.vendors.some((linked) => String(linked.catalog_vendor_id ?? '') === String(vendor.id))).slice(0, 8);
  return (
    <EventModuleShell title="Fornecedores" description="Contatos, confirmação e operação em um só lugar." icon="storefront-outline"
      metrics={[{ label: 'Total', value: m.vendors.length, tone: 'neutral' }, { label: 'Confirmados', value: m.vendors.filter((v) => ['confirmed', 'paid'].includes(v.status)).length, tone: 'success' }, { label: 'A confirmar', value: m.vendors.filter((v) => !v.status || v.status === 'pending').length, tone: 'warning' }]}
      actionLabel="Vincular fornecedor" onAction={m.onOpenComposer}>
      <View style={styles.cardSoft}><Text style={styles.subtitle}>Seus fornecedores de confiança</Text><Text style={styles.caption}>Escolha alguém já cadastrado na aba Fornecedores. Os contatos entram neste evento sem você digitar tudo novamente.</Text>
        {m.loadingCatalog ? <PrimeLogoLoader label="Carregando fornecedores..." /> : available.map((vendor) => <EventListCard key={vendor.id} title={String(vendor.name)} subtitle={String(vendor.category || 'Sem categoria')} meta={[vendor.whatsapp || vendor.email || 'Contato não informado']} status="Disponível" statusTone="info" actions={[{ label: 'Usar neste evento', icon: 'add-circle-outline', onPress: () => m.onLinkCatalog(String(vendor.id)) }]} />)}
        {!m.loadingCatalog && m.catalog.length === 0 ? <Text style={styles.caption}>Cadastre parceiros na aba Fornecedores para reutilizá-los em todos os eventos.</Text> : null}
      </View>
      <TextInput style={styles.input} value={m.search} onChangeText={m.onSearchChange} placeholder="Buscar por nome/categoria" />
      <EventFilterChips selected={m.sort} onSelect={m.onSortChange} options={[{ value: 'name_asc', label: 'A–Z' }, { value: 'name_desc', label: 'Z–A' }, { value: 'status', label: 'Por status' }]} />
      <EventSectionTitle title="Equipe de fornecedores" />
      {m.visibleVendors.length === 0 ? <EventEmptyState icon="storefront-outline" title="Nenhum fornecedor encontrado" description="Vincule o primeiro parceiro deste evento ou altere sua busca." actionLabel="Vincular fornecedor" onAction={m.onOpenComposer} /> : null}
      {m.visibleVendors.map((vendor) => <EventListCard key={vendor.id} title={String(vendor.name ?? 'Fornecedor')} subtitle={vendor.category || 'Categoria não informada'} status={vendorStatusLabel(vendor.status)} statusTone={vendor.status === 'paid' || vendor.status === 'confirmed' ? 'success' : vendor.status === 'cancelled' ? 'danger' : 'warning'} meta={[vendor.phone || vendor.email || 'Contato não informado', vendor.expected_arrival_time ? `Chegada: ${vendor.expected_arrival_time}` : 'Horário a combinar', `${m.receiptCounts.get(String(vendor.id)) ?? 0} recibo(s)`]} actions={[
        { label: vendor.status === 'confirmed' ? 'Marcar pago' : 'Confirmar', icon: 'checkmark-outline', onPress: () => m.onAdvance(vendor) },
        { label: 'Gastos', icon: 'wallet-outline', onPress: () => m.onOpenBudget(String(vendor.id)) },
        { label: 'Documentos', icon: 'document-text-outline', onPress: () => m.onOpenDocuments(String(vendor.id)) },
        { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => m.onDelete(String(vendor.id)) },
      ]} />)}
      {m.filteredCount > m.visibleLimit ? <Pressable style={styles.btnGhostWide} onPress={m.onShowMore}><Text style={styles.smallText}>Mostrar mais ({m.filteredCount - m.visibleLimit} restantes)</Text></Pressable> : null}
      {m.hasMore ? <Pressable style={styles.btnGhostWide} onPress={m.onLoadMore}><Text style={styles.smallText}>{m.loadingMore ? 'Carregando...' : 'Carregar mais do servidor'}</Text></Pressable> : null}
      <EventFormSheet visible={m.composerOpen} title="Outro fornecedor" subtitle="Não encontrou na sua lista? Cadastre manualmente para este evento." onClose={m.onCloseComposer}>
        <Text style={styles.formLabel}>Nome</Text><TextInput style={styles.input} value={m.name} onChangeText={m.onNameChange} placeholder="Nome do fornecedor" />
        <Text style={styles.formLabel}>Categoria</Text><TextInput style={styles.input} value={m.category} onChangeText={m.onCategoryChange} placeholder="Ex.: Buffet" />
        <Text style={styles.formLabel}>Contato</Text><TextInput style={styles.input} value={m.phone} onChangeText={m.onPhoneChange} placeholder="Telefone (opcional)" keyboardType="phone-pad" />
        <TextInput style={styles.input} value={m.email} onChangeText={m.onEmailChange} placeholder="E-mail (opcional)" keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.formLabel}>Operação no dia</Text><View style={styles.formRow}><TextInput style={[styles.input, styles.formGrow]} value={m.arrival} onChangeText={m.onArrivalChange} placeholder="Chegada HH:MM" /><TextInput style={[styles.input, styles.formGrow]} value={m.done} onChangeText={m.onDoneChange} placeholder="Fim HH:MM" /></View>
        <Pressable style={styles.btn} onPress={m.onCreate}><Text style={styles.btnText}>Vincular fornecedor</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
