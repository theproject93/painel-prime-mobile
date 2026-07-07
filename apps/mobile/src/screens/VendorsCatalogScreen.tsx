import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Modal, confirmAlert } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import { WalkthroughAnchorTarget } from '../components/WalkthroughAnchors';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatCardPremium } from '../components/ui/StatCardPremium';
import { colors } from '../theme/colors';
import { gradients, radii, shadows, spacing } from '../theme/colors';

const SCREEN_W = Dimensions.get('window').width;
const CARD_IMAGE_H = 140;

const CATEGORIES = [
  'Assessoria/Cerimonial',
  'Espaço/Local',
  'Buffet/Gastronomia',
  'Bar/Bebidas',
  'Bolo/Doces',
  'Decoração/Floral',
  'Foto',
  'Vídeo',
  'Música/DJ/Banda',
  'Som/Iluminação/Estrutura',
  'Locação/Mobiliário',
  'Beleza/Dia da noiva',
  'Trajes/Acessórios',
  'Convites/Papelaria',
  'Celebrante',
  'Transporte/Logística',
  'Lembranças/Personalizados',
  'Entretenimento/Experiências',
  'Conteúdo/Redes sociais',
  'Outros',
] as const;

type VendorRecord = {
  id: string;
  assessor_id: string;
  name: string;
  category: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  cover_image_url: string | null;
  cover_image_file_id: string | null;
  presentation_url: string | null;
  presentation_file_id: string | null;
  is_visible_in_vitrine: boolean;
  display_order: number;
  created_at: string;
  city: string | null;
  state: string | null;
  price_range: string | null;
};

type VendorForm = {
  name: string;
  category: string;
  phone: string;
  whatsapp: string;
  email: string;
  is_visible_in_vitrine: boolean;
  city: string;
  state: string;
  price_range: string;
};

const EMPTY_FORM: VendorForm = {
  name: '',
  category: 'Outros',
  phone: '',
  whatsapp: '',
  email: '',
  is_visible_in_vitrine: false,
  city: '',
  state: '',
  price_range: '',
};

const PRICE_RANGE_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: '$', label: '$ - Econômico' },
  { value: '$$', label: '$$ - Moderado' },
  { value: '$$$', label: '$$$ - Premium' },
  { value: '$$$$', label: '$$$$ - Luxo' },
];

export function VendorsCatalogScreen() {
  const { user } = useAuth();

  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM);

  const loadVendors = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: rpcError } = await supabase
      .rpc('get_vendors');

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    const rows = ((data ?? []) as VendorRecord[]).sort(
      (a, b) => a.display_order - b.display_order
    );
    setVendors(rows);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadVendors();
    }, [loadVendors]),
  );

  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => a.display_order - b.display_order),
    [vendors],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedVendors.filter((row) => {
      if (categoryFilter !== 'todas' && row.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term) ||
        (row.phone ?? '').toLowerCase().includes(term) ||
        (row.whatsapp ?? '').toLowerCase().includes(term) ||
        (row.email ?? '').toLowerCase().includes(term)
      );
    });
  }, [sortedVendors, search, categoryFilter]);

  function openCreateModal() {
    setEditingVendor(null);
    setForm(EMPTY_FORM);
    setIsCreateModalOpen(true);
  }

  function openEditModal(vendor: VendorRecord) {
    setEditingVendor(vendor);
    setForm({
      name: vendor.name,
      category: vendor.category,
      phone: vendor.phone ?? '',
      whatsapp: vendor.whatsapp ?? '',
      email: vendor.email ?? '',
      is_visible_in_vitrine: vendor.is_visible_in_vitrine,
      city: vendor.city ?? '',
      state: vendor.state ?? '',
      price_range: vendor.price_range ?? '',
    });
    setIsCreateModalOpen(true);
  }

  function closeModal() {
    setIsCreateModalOpen(false);
    setEditingVendor(null);
    setForm(EMPTY_FORM);
  }

  async function saveVendor() {
    if (!user || saving || !form.name.trim() || !form.category.trim()) return;
    setSaving(true);
    setError('');

    const payload: Record<string, unknown> = {
      id: editingVendor?.id ?? null,
      name: form.name.trim(),
      category: form.category.trim(),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      is_visible_in_vitrine: form.is_visible_in_vitrine,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      price_range: form.price_range || null,
    };

    const { data, error: saveError } = await supabase
      .rpc('upsert_vendor', { p_vendor: payload });

    if (saveError || !data) {
      setError(saveError?.message ?? 'Erro ao salvar fornecedor.');
      setSaving(false);
      return;
    }

    const saved = data as VendorRecord;
    setVendors((prev) => {
      const exists = prev.some((v) => v.id === saved.id);
      const next = exists
        ? prev.map((v) => (v.id === saved.id ? saved : v))
        : [...prev, saved];
      return [...next].sort((a, b) => a.display_order - b.display_order);
    });

    setSaving(false);
    closeModal();
  }

  function handleDelete(vendor: VendorRecord) {
    confirmAlert(
      'Remover fornecedor',
      `Deseja remover "${vendor.name}" do catálogo? Esta ação não pode ser desfeita.`,
      async () => {
        const { error: deleteError } = await supabase
          .rpc('delete_vendor', { p_vendor_id: vendor.id });

        if (deleteError) {
          setError(deleteError.message);
          return;
        }

        setVendors((prev) => prev.filter((row) => row.id !== vendor.id));
      },
    );
  }

  async function handleMoveVendor(vendorId: string, direction: 'up' | 'down') {
    const idx = sortedVendors.findIndex((v) => v.id === vendorId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sortedVendors.length - 1) return;

    const reordered = [...sortedVendors];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    const orderedIds = reordered.map((v) => v.id);
    const { error: reorderError } = await supabase
      .rpc('reorder_vendors', { p_ordered_ids: orderedIds });

    if (reorderError) {
      setError(reorderError.message);
      return;
    }

    setVendors(
      reordered.map((v, i) => ({ ...v, display_order: i })),
    );
  }

  function handleCall(phone: string) {
    Linking.openURL(`tel:${phone}`);
  }

  function handleWhatsApp(whatsapp: string) {
    Linking.openURL(`https://wa.me/${whatsapp.replace(/\D/g, '')}`);
  }

  function handleEmail(email: string) {
    Linking.openURL(`mailto:${email}`);
  }

  function renderVendorCard({ item }: { item: VendorRecord }) {
    const canMoveUp = sortedVendors.findIndex((v) => v.id === item.id) > 0;
    const canMoveDown = sortedVendors.findIndex((v) => v.id === item.id) < sortedVendors.length - 1;

    return (
      <View style={styles.vendorCard}>
        <View style={styles.vendorImageWrap}>
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={styles.vendorImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={gradients.royal} style={styles.vendorImagePlaceholder}>
              <Ionicons name="storefront" size={32} color="#FFFFFF" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.vendorImageOverlay}
          />
          <View style={styles.vendorImageOverlayContent}>
            <Text style={styles.vendorImageName} numberOfLines={1}>{item.name}</Text>
            {item.city || item.state ? (
              <Text style={styles.vendorImageLocation}>
                <Ionicons name="location" size={11} color="rgba(255,255,255,0.8)" /> {[item.city, item.state].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </View>
          <View style={styles.vendorBadges}>
            <Badge variant="royal" size="sm">{item.category}</Badge>
            {item.is_visible_in_vitrine && <Badge variant="gold" size="sm">Vitrine</Badge>}
          </View>
          {item.price_range && (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagText}>{item.price_range}</Text>
            </View>
          )}
        </View>

        <View style={styles.vendorCardBody}>
          <View style={styles.contactRow}>
            {item.phone ? (
              <Pressable style={styles.contactAction} onPress={() => handleCall(item.phone!)}>
                <Ionicons name="call" size={18} color={colors.primaryStrong} />
              </Pressable>
            ) : null}
            {item.whatsapp ? (
              <Pressable style={[styles.contactAction, styles.contactActionGreen]} onPress={() => handleWhatsApp(item.whatsapp!)}>
                <Ionicons name="logo-whatsapp" size={18} color="#22c55e" />
              </Pressable>
            ) : null}
            {item.email ? (
              <Pressable style={styles.contactAction} onPress={() => handleEmail(item.email!)}>
                <Ionicons name="mail" size={18} color={colors.primaryStrong} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.vendorActions}>
            <View style={styles.reorderGroup}>
              <Pressable
                style={[styles.reorderBtn, !canMoveUp && styles.reorderBtnDisabled]}
                onPress={() => void handleMoveVendor(item.id, 'up')}
                disabled={!canMoveUp}
              >
                <Ionicons name="chevron-up" size={16} color={canMoveUp ? colors.text : colors.mutedText} />
              </Pressable>
              <Text style={styles.orderLabel}>#{item.display_order + 1}</Text>
              <Pressable
                style={[styles.reorderBtn, !canMoveDown && styles.reorderBtnDisabled]}
                onPress={() => void handleMoveVendor(item.id, 'down')}
                disabled={!canMoveDown}
              >
                <Ionicons name="chevron-down" size={16} color={canMoveDown ? colors.text : colors.mutedText} />
              </Pressable>
            </View>
            <View style={styles.actionGroup}>
              <Pressable style={styles.editBtn} onPress={() => openEditModal(item)}>
                <Ionicons name="create-outline" size={18} color={colors.primaryStrong} />
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={18} color={colors.dangerText} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <SkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Fornecedores</Text>
          <Text style={styles.subtitle}>{filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''}</Text>
        </View>
        <WalkthroughAnchorTarget id="vendors.create" borderRadius={12}>
          <Pressable style={styles.addBtn} onPress={openCreateModal}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </WalkthroughAnchorTarget>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <StatCardPremium title="Total" value={vendors.length} icon="people" gradient="royal" subtitle="cadastrados" />
        <StatCardPremium title="Vitrine" value={vendors.filter(v => v.is_visible_in_vitrine).length} icon="eye" gradient="gold" subtitle="visíveis" />
      </View>

      <View style={{ marginHorizontal: 16, marginTop: spacing.md }}>
        <SectionHeader icon="search" title="Buscar fornecedor" />
      </View>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome, categoria ou contato"
        placeholderTextColor={colors.mutedText}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        <Pressable
          style={[
            styles.categoryPill,
            categoryFilter === 'todas' && styles.categoryPillActive,
          ]}
          onPress={() => setCategoryFilter('todas')}
        >
          <Text
            style={[
              styles.categoryPillText,
              categoryFilter === 'todas' && styles.categoryPillTextActive,
            ]}
          >
            Todas
          </Text>
        </Pressable>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryPill,
              categoryFilter === cat && styles.categoryPillActive,
            ]}
            onPress={() => setCategoryFilter(cat)}
          >
            <Text
              style={[
                styles.categoryPillText,
                categoryFilter === cat && styles.categoryPillTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <WalkthroughAnchorTarget id="vendors.list" borderRadius={14} style={styles.listWrapper}>
        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum fornecedor cadastrado"
            message="Cadastre fornecedores no catálogo global para reutilizar em vários eventos."
            actionLabel="Cadastrar fornecedor"
            onAction={openCreateModal}
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderVendorCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </WalkthroughAnchorTarget>

      <Modal visible={isCreateModalOpen} onClose={closeModal} title={editingVendor ? 'Editar fornecedor' : 'Novo fornecedor'}>
        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>Nome</Text>
          <TextInput
            style={styles.textInput}
            value={form.name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="Ex.: Lumière Filmes"
            placeholderTextColor={colors.mutedText}
          />

          <Text style={styles.fieldLabel}>Categoria</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.categoryPill,
                  form.category === cat && styles.categoryPillActive,
                ]}
                onPress={() => setForm((prev) => ({ ...prev, category: cat }))}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    form.category === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Telefone</Text>
          <TextInput
            style={styles.textInput}
            value={form.phone}
            onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            placeholder="(31) 99999-9999"
            placeholderTextColor={colors.mutedText}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>WhatsApp</Text>
          <TextInput
            style={styles.textInput}
            value={form.whatsapp}
            onChangeText={(value) => setForm((prev) => ({ ...prev, whatsapp: value }))}
            placeholder="(31) 99999-9999"
            placeholderTextColor={colors.mutedText}
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.textInput}
            value={form.email}
            onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
            placeholder="contato@fornecedor.com"
            placeholderTextColor={colors.mutedText}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Cidade</Text>
          <TextInput
            style={styles.textInput}
            value={form.city}
            onChangeText={(value) => setForm((prev) => ({ ...prev, city: value }))}
            placeholder="Ex.: Belo Horizonte"
            placeholderTextColor={colors.mutedText}
          />

          <Text style={styles.fieldLabel}>Estado</Text>
          <TextInput
            style={styles.textInput}
            value={form.state}
            onChangeText={(value) => setForm((prev) => ({ ...prev, state: value }))}
            placeholder="Ex.: MG"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="characters"
            maxLength={2}
          />

          <Text style={styles.fieldLabel}>Faixa de Preço</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {PRICE_RANGE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.categoryPill,
                  form.price_range === opt.value && styles.categoryPillActive,
                ]}
                onPress={() => setForm((prev) => ({ ...prev, price_range: opt.value }))}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    form.price_range === opt.value && styles.categoryPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={styles.vitrineRow}
            onPress={() => setForm((prev) => ({ ...prev, is_visible_in_vitrine: !prev.is_visible_in_vitrine }))}
          >
            <Ionicons
              name={form.is_visible_in_vitrine ? 'checkbox' : 'square-outline'}
              size={22}
              color={form.is_visible_in_vitrine ? colors.primaryStrong : colors.mutedText}
            />
            <View style={styles.vitrineTextGroup}>
              <Text style={styles.fieldLabel}>Exibir na vitrine pública</Text>
              <Text style={styles.vitrineHint}>
                Quando ativado, aparece na página pública da sua assessoria.
              </Text>
            </View>
          </Pressable>

          <View style={styles.modalActions}>
            <Button
              title="Cancelar"
              onPress={closeModal}
              variant="ghost"
              size="md"
            />
            <Button
              title={saving ? 'Salvando...' : 'Salvar'}
              onPress={() => void saveVendor()}
              variant="primary"
              size="md"
              loading={saving}
              disabled={!form.name.trim() || !form.category.trim() || saving}
            />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: gradients.gold[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 13,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.card,
    fontSize: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  categoryPill: {
    minHeight: 34,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  categoryPillActive: {
    borderColor: colors.primaryStrong,
    backgroundColor: colors.primarySoft,
  },
  categoryPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: colors.primaryStrong,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  vendorCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  vendorImageWrap: {
    height: CARD_IMAGE_H,
    width: '100%',
  },
  vendorImage: {
    width: '100%',
    height: '100%',
  },
  vendorImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  vendorImageOverlayContent: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
  },
  vendorImageName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  vendorImageLocation: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  vendorBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  priceTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  vendorCardBody: {
    padding: 12,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactActionGreen: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fef4',
  },
  vendorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  reorderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.4,
  },
  orderLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 26,
    textAlign: 'center',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editBtnText: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    gap: 8,
    paddingBottom: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  vitrineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  vitrineTextGroup: {
    flex: 1,
  },
  vitrineHint: {
    color: colors.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
});
