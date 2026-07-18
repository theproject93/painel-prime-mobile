import { Pressable, Share, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventEmptyState, EventFilterChips, EventFormSheet, EventListCard, EventModuleShell, EventSectionTitle } from '../EventWorkspace';
import { styles } from '../eventDetailsStyles';
import { colors } from '../../../theme/colors';

export type DocumentsTabModel = {
  documents: any[]; filteredCount: number; visibleLimit: number; vendors: any[]; categories: string[];
  receiptFilter: string; vendorFilter: string; categoryFilter: string; search: string; composerOpen: boolean; uploading: boolean;
  name: string; link: string; category: string; vendorInput: string; hasMore: boolean; loadingMore: boolean;
  onClearReceipt: () => void; onClearVendor: () => void; onSearchChange: (v: string) => void; onCategoryFilterChange: (v: string) => void;
  onOpen: (doc: any) => void; onDelete: (doc: any) => void; onShowMore: () => void; onLoadMore: () => void;
  onOpenComposer: () => void; onCloseComposer: () => void; onUpload: () => void; onNameChange: (v: string) => void;
  onLinkChange: (v: string) => void; onCategoryChange: (v: string) => void; onVendorInputChange: (v: string) => void; onCreateLink: () => void;
};

export function DocumentsTab({ model: m }: { model: DocumentsTabModel }) {
  return (
    <EventModuleShell title="Documentos" description="Contratos, recibos e arquivos importantes do evento." icon="document-text-outline" metrics={[{ label: 'Arquivos', value: m.documents.length, tone: 'gold' }, { label: 'Categorias', value: m.categories.length, tone: 'neutral' }]} actionLabel="Adicionar documento" onAction={m.onOpenComposer}>
      {m.receiptFilter ? <Pressable style={styles.activeFilter} onPress={m.onClearReceipt}><Text style={styles.activeFilterText}>Exibindo o recibo selecionado</Text><Ionicons name="close" size={16} color={colors.gold700} /></Pressable> : null}
      {m.vendorFilter ? <Pressable style={styles.activeFilter} onPress={m.onClearVendor}><Text style={styles.activeFilterText}>Fornecedor: {m.vendors.find((v) => String(v.id) === m.vendorFilter)?.name ?? 'selecionado'}</Text><Ionicons name="close" size={16} color={colors.gold700} /></Pressable> : null}
      <TextInput style={styles.input} value={m.search} onChangeText={m.onSearchChange} placeholder="Buscar documento" />
      <EventFilterChips selected={m.categoryFilter} onSelect={m.onCategoryFilterChange} options={[{ value: '', label: 'Todos' }, ...m.categories.slice(0, 6).map((category) => ({ value: category, label: category }))]} />
      <EventSectionTitle title="Arquivos do evento" actionLabel="Compartilhar links" onAction={() => void Share.share({ message: m.documents.filter((d) => !d.file_id && typeof d.file_url === 'string' && d.file_url.trim()).map((d) => d.file_url).join('\n') || 'Nenhum link público para compartilhar.' })} />
      {m.documents.length === 0 ? <EventEmptyState icon="document-text-outline" title="Nenhum documento encontrado" description="Envie um arquivo ou adicione um link para centralizar os documentos." actionLabel="Adicionar documento" onAction={m.onOpenComposer} /> : null}
      {m.documents.map((doc) => <EventListCard key={doc.id} title={String(doc.name ?? 'Documento')} subtitle={m.vendors.find((v) => String(v.id) === String(doc.vendor_id))?.name || 'Documento geral'} status={doc.category || 'Outros'} statusTone="info" actions={[
        { label: 'Abrir', icon: 'open-outline', onPress: () => m.onOpen(doc) },
        ...(!doc.file_id && doc.file_url ? [{ label: 'Compartilhar', icon: 'share-outline' as const, onPress: () => void Share.share({ message: doc.file_url }) }] : []),
        { label: 'Excluir', icon: 'trash-outline', tone: 'danger', onPress: () => m.onDelete(doc) },
      ]} />)}
      {m.filteredCount > m.visibleLimit ? <Pressable style={styles.btnGhostWide} onPress={m.onShowMore}><Text style={styles.smallText}>Mostrar mais ({m.filteredCount - m.visibleLimit} restantes)</Text></Pressable> : null}
      {m.hasMore ? <Pressable style={styles.btnGhostWide} onPress={m.onLoadMore}><Text style={styles.smallText}>{m.loadingMore ? 'Carregando...' : 'Carregar mais do servidor'}</Text></Pressable> : null}
      <EventFormSheet visible={m.composerOpen} title="Adicionar documento" subtitle="Envie um arquivo do celular ou salve um link." onClose={m.onCloseComposer}>
        <Pressable style={styles.uploadAction} onPress={m.onUpload}><Ionicons name="cloud-upload-outline" size={22} color={colors.gold700} /><View style={styles.formGrow}><Text style={styles.uploadTitle}>{m.uploading ? 'Enviando arquivo...' : 'Escolher arquivo do celular'}</Text><Text style={styles.uploadSubtitle}>PDF, imagem ou documento</Text></View></Pressable>
        <Text style={styles.formDivider}>ou adicione um link</Text>
        <Text style={styles.formLabel}>Nome</Text><TextInput style={styles.input} value={m.name} onChangeText={m.onNameChange} placeholder="Ex.: Contrato do buffet" />
        <Text style={styles.formLabel}>Link</Text><TextInput style={styles.input} value={m.link} onChangeText={m.onLinkChange} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        <Text style={styles.formLabel}>Categoria</Text><TextInput style={styles.input} value={m.category} onChangeText={m.onCategoryChange} placeholder="Ex.: Contratos" />
        {m.vendors.length ? <><Text style={styles.formLabel}>Fornecedor (opcional)</Text><EventFilterChips selected={m.vendorInput} onSelect={m.onVendorInputChange} options={[{ value: '', label: 'Geral' }, ...m.vendors.map((v) => ({ value: String(v.id), label: String(v.name) }))]} /></> : null}
        <Pressable style={styles.btn} onPress={m.onCreateLink}><Text style={styles.btnText}>Salvar link</Text></Pressable>
      </EventFormSheet>
    </EventModuleShell>
  );
}
