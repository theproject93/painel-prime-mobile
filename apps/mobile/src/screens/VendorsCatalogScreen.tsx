import { useCallback, useId, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Modal, confirmAlert } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatCardPremium } from '../components/ui/StatCardPremium';
import { OptionPickerModal, type PickerOption } from '../components/ui/OptionPickerModal';
import { colors } from '../theme/colors';
import { spacing } from '../theme/colors';
import { vendorCatalogStyles as styles } from '../features/vendors/vendorCatalogStyles';
import { EMPTY_VENDOR_FORM, PRICE_RANGE_OPTIONS, VENDOR_CATEGORIES, filterVendors, sortVendors, type VendorForm, type VendorRecord } from '../features/vendors/vendorCatalogModel';
import { useVendorCatalog } from '../features/vendors/useVendorCatalog';
import { VendorCard } from '../features/vendors/VendorCard';

type CategoryPickerMode = 'filter' | 'form' | null;

const CATEGORY_OPTIONS: PickerOption[] = VENDOR_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}));

const CATEGORY_FILTER_OPTIONS: PickerOption[] = [
  { value: 'todas', label: 'Todas' },
  ...CATEGORY_OPTIONS,
];

export function VendorsCatalogScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const vcId = useId();

  const catalog = useVendorCatalog(Boolean(user));
  const { vendors, loading, saving, error } = catalog;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [categoryPickerMode, setCategoryPickerMode] = useState<CategoryPickerMode>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY_VENDOR_FORM);

  useFocusEffect(
    useCallback(() => {
      void catalog.load();
    }, [catalog.load]),
  );

  const sortedVendors = useMemo(
    () => sortVendors(vendors),
    [vendors],
  );

  const filtered = useMemo(() => {
    return filterVendors(vendors, search, categoryFilter);
  }, [sortedVendors, search, categoryFilter]);

  const selectedCategoryFilterLabel = categoryFilter === 'todas' ? 'Todas' : categoryFilter;
  const categoryPickerOptions = categoryPickerMode === 'filter'
    ? CATEGORY_FILTER_OPTIONS
    : CATEGORY_OPTIONS;
  const selectedCategoryValue = categoryPickerMode === 'filter'
    ? categoryFilter
    : form.category;

  function handleCategorySelect(value: string) {
    if (categoryPickerMode === 'filter') {
      setCategoryFilter(value);
      return;
    }

    if (categoryPickerMode === 'form') {
      setForm((prev) => ({ ...prev, category: value }));
    }
  }

  function openCreateModal() {
    setEditingVendor(null);
    setForm(EMPTY_VENDOR_FORM);
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
    setForm(EMPTY_VENDOR_FORM);
  }

  async function saveVendor() {
    if (!user || saving || !form.name.trim() || !form.category.trim()) return;
    if (await catalog.save(form, editingVendor)) closeModal();
  }

  function handleDelete(vendor: VendorRecord) {
    confirmAlert(
      'Remover fornecedor',
      `Deseja remover "${vendor.name}" do catálogo? Esta ação não pode ser desfeita.`,
      () => catalog.remove(vendor.id),
    );
  }

  async function handleMoveVendor(vendorId: string, direction: 'up' | 'down') {
    await catalog.move(vendorId, direction);
  }

  if (loading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 140 }]}>
        <SkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top + 10 }]}>
      <ScrollView
        style={styles.catalogScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.catalogContent, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Fornecedores</Text>
          <Text style={styles.subtitle}>{filtered.length} fornecedor{filtered.length !== 1 ? 'es' : ''}</Text>
        </View>
                  <Pressable style={styles.addBtn} onPress={openCreateModal}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
              </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.reuseInfoCard}>
        <Ionicons name="sparkles-outline" size={22} color={colors.gold700} />
        <View style={styles.reuseInfoText}>
          <Text style={styles.reuseInfoTitle}>Sua lista de parceiros</Text>
          <Text style={styles.reuseInfoBody}>Cadastre uma vez os fornecedores que você mais usa. Depois, escolha-os dentro de qualquer evento sem preencher nome e contato novamente.</Text>
        </View>
      </View>

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

      <Pressable
        style={styles.categorySelector}
        onPress={() => setCategoryPickerMode('filter')}
        accessibilityRole="button"
        accessibilityLabel={`Filtrar categoria. Categoria atual: ${selectedCategoryFilterLabel}`}
      >
        <View style={styles.categorySelectorTextGroup}>
          <Text style={styles.categorySelectorLabel}>Categoria</Text>
          <Text style={styles.categorySelectorValue} numberOfLines={1}>
            {selectedCategoryFilterLabel}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.primaryStrong} />
      </Pressable>

              {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum fornecedor cadastrado"
            message="Cadastre fornecedores no catálogo global para reutilizar em vários eventos."
            actionLabel="Cadastrar fornecedor"
            onAction={openCreateModal}
          />
        ) : <View style={styles.listContent}>{filtered.map((item, index) => <VendorCard key={item.id} item={item} index={index} total={filtered.length} gradientId={vcId} edit={() => openEditModal(item)} remove={() => handleDelete(item)} move={(direction) => void handleMoveVendor(item.id, direction)} />)}</View>}
      </ScrollView>

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
          <Pressable
            style={[styles.categorySelector, styles.formCategorySelector]}
            onPress={() => setCategoryPickerMode('form')}
            accessibilityRole="button"
            accessibilityLabel={`Selecionar categoria do fornecedor. Categoria atual: ${form.category}`}
          >
            <Text style={styles.categorySelectorValue} numberOfLines={1}>
              {form.category}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.primaryStrong} />
          </Pressable>

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
                Quando ativado, aparece na pígina pública da sua assessoria.
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

      <OptionPickerModal
        visible={categoryPickerMode !== null}
        title={categoryPickerMode === 'form' ? 'Categoria do fornecedor' : 'Filtrar por categoria'}
        options={categoryPickerOptions}
        selectedValue={selectedCategoryValue}
        onSelect={handleCategorySelect}
        onClose={() => setCategoryPickerMode(null)}
      />
    </View>
  );
}
