import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteVendor, fetchVendors, persistVendorOrder, saveVendor } from './vendorCatalogService';
import { moveVendor, sortVendors, type VendorForm, type VendorRecord } from './vendorCatalogModel';
export function useVendorCatalog(enabled: boolean) {
  const [vendors, setVendors] = useState<VendorRecord[]>([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const vendorsRef = useRef<VendorRecord[]>([]);
  useEffect(() => { vendorsRef.current = vendors; }, [vendors]);
  const load = useCallback(async () => { if (!enabled) { setLoading(false); return; } setLoading(true); setError(''); const result = await fetchVendors(); if (result.error) setError(result.error.message); else setVendors(sortVendors(result.data)); setLoading(false); }, [enabled]);
  const save = useCallback(async (form: VendorForm, editing?: VendorRecord | null) => { setSaving(true); setError(''); const result = await saveVendor(form, editing?.id); setSaving(false); if (result.error || !result.data) { setError(result.error?.message ?? 'Erro ao salvar fornecedor.'); return false; } const saved = result.data as VendorRecord; setVendors((current) => sortVendors([saved, ...current.filter(({ id }) => id !== saved.id)])); return true; }, []);
  const remove = useCallback(async (id: string) => { const result = await deleteVendor(id); if (result.error) { setError(result.error.message); return; } setVendors((current) => current.filter((vendor) => vendor.id !== id)); }, []);
  const move = useCallback(async (id: string, direction: 'up' | 'down') => { const previous = vendorsRef.current, optimistic = moveVendor(previous, id, direction); vendorsRef.current = optimistic; setVendors(optimistic); const result = await persistVendorOrder(optimistic.map((vendor) => vendor.id)); if (result.error) { vendorsRef.current = previous; setVendors(previous); setError(result.error.message); } }, []);
  return { vendors, loading, saving, error, setError, load, save, remove, move };
}
