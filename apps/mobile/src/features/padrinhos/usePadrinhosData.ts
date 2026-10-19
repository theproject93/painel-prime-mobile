import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildPadrinhoPairs,
  type EventPadrinhoGuest,
  type EventPadrinhoItem,
  type PadrinhoPairGroup,
} from './padrinhosModel';
import {
  deletePadrinho,
  dispatchPadrinhosPlanIa,
  fetchEventGuests,
  fetchEventPadrinhos,
  fetchWhatsAppWalletCredits,
  savePadrinho,
  subscribeToPadrinhos,
  type DispatchPlanIaResult,
} from './padrinhosService';

export function usePadrinhosData(eventId: string) {
  const [padrinhos, setPadrinhos] = useState<EventPadrinhoItem[]>([]);
  const [guests, setGuests] = useState<EventPadrinhoGuest[]>([]);
  const [whatsappCredits, setWhatsappCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pairs = useMemo<PadrinhoPairGroup[]>(() => {
    return buildPadrinhoPairs(padrinhos);
  }, [padrinhos]);

  const loadAll = useCallback(
    async (isRefresh = false) => {
      if (!eventId) return;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [padrinhosData, guestsData, credits] = await Promise.all([
          fetchEventPadrinhos(eventId),
          fetchEventGuests(eventId),
          fetchWhatsAppWalletCredits(),
        ]);
        setPadrinhos(padrinhosData);
        setGuests(guestsData);
        setWhatsappCredits(credits);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados dos padrinhos.';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = subscribeToPadrinhos(eventId, () => {
      void loadAll(true);
    });
    return () => {
      unsubscribe();
    };
  }, [eventId, loadAll]);

  const handleSave = useCallback(
    async (payload: Partial<EventPadrinhoItem> & { event_id: string; guest_id: string }) => {
      setError(null);
      try {
        const saved = await savePadrinho(payload);
        setPadrinhos((current) => {
          const filtered = current.filter((p) => p.id !== saved.id);
          return [...filtered, saved];
        });
        return saved;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Falha ao salvar membro do cortejo.';
        setError(msg);
        throw err;
      }
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    try {
      await deletePadrinho(id);
      setPadrinhos((current) => current.filter((p) => p.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover membro do cortejo.';
      setError(msg);
      throw err;
    }
  }, []);

  const handleDispatchPlanIa = useCallback(
    async (
      actionType: 'manual' | 'concentration' | 'attire',
      padrinhoIds?: string[]
    ): Promise<DispatchPlanIaResult> => {
      setError(null);
      const result = await dispatchPadrinhosPlanIa({
        actionType,
        eventId,
        padrinhoIds,
      });
      // Refresh to update manual_sent_at timestamps and balance
      void loadAll(true);
      return result;
    },
    [eventId, loadAll]
  );

  return {
    padrinhos,
    pairs,
    guests,
    whatsappCredits,
    loading,
    refreshing,
    error,
    setError,
    refresh: () => loadAll(true),
    savePadrinho: handleSave,
    deletePadrinho: handleDelete,
    dispatchPlanIa: handleDispatchPlanIa,
  };
}
