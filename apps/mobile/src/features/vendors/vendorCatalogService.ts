import { supabase } from '../../lib/supabase';
import { vendorPayload, type VendorForm, type VendorRecord } from './vendorCatalogModel';
export async function fetchVendors() { const result = await supabase.rpc('get_vendors'); return { ...result, data: (result.data ?? []) as VendorRecord[] }; }
export async function saveVendor(form: VendorForm, id?: string) { return supabase.rpc('upsert_vendor', { p_vendor: vendorPayload(form, id) }); }
export async function deleteVendor(id: string) { return supabase.rpc('delete_vendor', { p_vendor_id: id }); }
export async function persistVendorOrder(ids: string[]) { return supabase.rpc('reorder_vendors', { p_ordered_ids: ids }); }
