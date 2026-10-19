import { useCallback, useEffect, useMemo, useState } from 'react';
import { Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { Meeting } from './meetingModel';
import { meetingError } from './meetingModel';
import {
  fetchAllMeetings,
  invokeMeetingAction,
  subscribeToGlobalMeetings,
} from './meetingService';
import { scheduleMeetingAlerts } from '../../services/notificationService';
import { supabase } from '../../lib/supabase';

export type MeetingFilterType = 'all' | 'scheduled' | 'active' | 'completed';

export function useGlobalMeetingsData() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<MeetingFilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string>('');

  const loadMeetings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetchAllMeetings();
      setMeetings(res.data);

      // Sincronização offline-first dos alertas na bandeja do sistema
      for (const m of res.data) {
        if (m.status === 'scheduled' && m.scheduled_at) {
          scheduleMeetingAlerts({
            id: m.id,
            title: m.title,
            scheduledAt: m.scheduled_at,
            roomUrl: m.room_url || undefined,
          }).catch(() => {});
        }
      }
    } catch (err) {
      setError(meetingError(err, 'Falha ao carregar reuniões.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings(false);
  }, [loadMeetings]);

  useEffect(() => {
    const unsub = subscribeToGlobalMeetings(() => {
      void loadMeetings(true);
    });
    return () => {
      unsub();
    };
  }, [loadMeetings]);

  const filteredMeetings = useMemo(() => {
    if (filter === 'all') return meetings;
    return meetings.filter((m) => m.status === filter);
  }, [meetings, filter]);

  const stats = useMemo(() => {
    const scheduled = meetings.filter((m) => m.status === 'scheduled').length;
    const active = meetings.filter((m) => m.status === 'active').length;
    const completed = meetings.filter((m) => m.status === 'completed').length;
    return { total: meetings.length, scheduled, active, completed };
  }, [meetings]);

  const openHostRoom = useCallback(
    async (meeting: Meeting) => {
      if (busyAction) return;
      setBusyAction(`host:${meeting.id}`);
      setError(null);
      try {
        const response = await invokeMeetingAction<{ url?: string }>('host-link', {
          meetingId: meeting.id,
        });
        if (!response?.url) throw new Error('A sala não retornou um link de acesso.');
        await WebBrowser.openBrowserAsync(response.url);
      } catch (err) {
        setError(meetingError(err, 'Não foi possível abrir a sala.'));
      } finally {
        setBusyAction('');
      }
    },
    [busyAction]
  );

  const shareGuestLink = useCallback(async (meeting: Meeting) => {
    if (!meeting.room_url) {
      throw new Error('O convite desta reunião ainda não está disponível.');
    }
    await Share.share({
      title: `Reunião: ${meeting.title}`,
      message: `Olá! Segue o link da nossa reunião "${meeting.title}":\n${meeting.room_url}\n\nPainel Prime`,
    });
  }, []);

  const completeMeeting = useCallback(
    async (meeting: Meeting) => {
      if (busyAction) return;
      setBusyAction(`complete:${meeting.id}`);
      setError(null);
      try {
        await invokeMeetingAction('complete', { meetingId: meeting.id });
        void loadMeetings(true);
      } catch (err) {
        setError(meetingError(err, 'Falha ao encerrar reunião.'));
        throw err;
      } finally {
        setBusyAction('');
      }
    },
    [busyAction, loadMeetings]
  );

  const retryAta = useCallback(
    async (meeting: Meeting) => {
      if (busyAction) return;
      setBusyAction(`retry:${meeting.id}`);
      setError(null);
      try {
        await invokeMeetingAction('retry-ata', { meetingId: meeting.id });
        void loadMeetings(true);
      } catch (err) {
        setError(meetingError(err, 'Falha ao solicitar nova geração de ata.'));
        throw err;
      } finally {
        setBusyAction('');
      }
    },
    [busyAction, loadMeetings]
  );

  const saveNotes = useCallback(async (meetingId: string, notes: string) => {
    const { error: dbError } = await supabase
      .from('event_meetings')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', meetingId);

    if (dbError) {
      throw new Error(dbError.message || 'Falha ao salvar anotações.');
    }

    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, notes } : m))
    );
  }, []);

  return {
    meetings: filteredMeetings,
    allMeetings: meetings,
    filter,
    setFilter,
    stats,
    loading,
    refreshing,
    error,
    busyAction,
    refresh: () => loadMeetings(true),
    openHostRoom,
    shareGuestLink,
    completeMeeting,
    retryAta,
    saveNotes,
  };
}
