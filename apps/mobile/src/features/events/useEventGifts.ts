import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { supabase } from '../../lib/supabase';

export type EventGift = {
  id: string;
  guest_name: string;
  guest_phone: string;
  amount: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
};

export function useEventGifts(eventId: string, enabled: boolean) {
  const [gifts, setGifts] = useState<EventGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let active = true;
      setLoadingGifts(true);
      supabase
        .rpc('get_event_gift_intentions_for_owner', { p_event_id: eventId })
        .then(({ data, error }) => {
          if (!active) return;
          if (!error && data) setGifts(data as EventGift[]);
          setLoadingGifts(false);
        });
      return () => { active = false; };
    }, [enabled, eventId]),
  );

  return { gifts, loadingGifts };
}
