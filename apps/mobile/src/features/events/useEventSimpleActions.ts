import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Alert, Share } from 'react-native';

import { getPrivateFileDownloadUrl } from '../../lib/r2FileStorage';
import { supabase } from '../../lib/supabase';
import type { EventDataKey, EventDataLoadMode, EventDataState, EventDetailsTab } from './eventDetailsData';
import type { EventRow } from './eventDetailsTypes';

type SimpleFormState = {
  a: string;
  b: string;
  c: string;
  inviteTemplate: string;
  inviteDress: string;
};

type UseEventSimpleActionsArgs = {
  activeTab: EventDetailsTab;
  eventId: string;
  data: EventDataState;
  filteredGuests: any[];
  form: SimpleFormState;
  setForm: Dispatch<SetStateAction<any>>;
  setEvent: Dispatch<SetStateAction<EventRow | null>>;
  setData: Dispatch<SetStateAction<EventDataState>>;
  setComposer: Dispatch<SetStateAction<EventDetailsTab | null>>;
  act: (action: () => Promise<void>, reload?: boolean) => Promise<void>;
  loadTab: (tab: EventDetailsTab, force?: boolean) => Promise<void>;
  loadKey: (key: EventDataKey, mode: EventDataLoadMode) => Promise<void>;
};

export function useEventSimpleActions({
  activeTab,
  eventId,
  data,
  filteredGuests,
  form,
  setForm,
  setEvent,
  setData,
  setComposer,
  act,
  loadTab,
  loadKey,
}: UseEventSimpleActionsArgs) {
  const [teamDirectory, setTeamDirectory] = useState<any[]>([]);
  const teamPhotoSignature = data.team.map((member) => `${member.id}:${member.photo_file_id ?? ''}`).join('|');

  useEffect(() => {
    const pending = data.team.filter((member) => member.photo_file_id);
    if (pending.length === 0) return;
    let cancelled = false;
    void Promise.all(pending.map(async (member) => {
      try { return [member.id, await getPrivateFileDownloadUrl(String(member.photo_file_id))] as const; }
      catch { return [member.id, ''] as const; }
    })).then((entries) => {
      if (cancelled) return;
      const urls = new Map(entries);
      setData((current) => ({
        ...current,
        team: current.team.map((member) => urls.get(member.id) ? { ...member, photo_url: urls.get(member.id) } : member),
      }));
    });
    return () => { cancelled = true; };
  }, [activeTab, teamPhotoSignature]);

  useEffect(() => {
    if (activeTab !== 'team') return;
    void (async () => {
      const db = supabase as any;
      const [teamsRes, membersRes] = await Promise.all([
        db.from('advisor_teams').select('id,name,leader_member_id').order('created_at'),
        db.from('advisor_team_members').select('id,team_id,name,role,phone,email,photo_file_id,photo_url').order('created_at'),
      ]);
      if (teamsRes.error || membersRes.error) return;
      setTeamDirectory((teamsRes.data ?? []).map((team: any) => ({
        ...team,
        members: (membersRes.data ?? []).filter((member: any) => member.team_id === team.id),
      })));
    })();
  }, [activeTab]);

  async function createNote() {
    await act(async () => {
      if (!form.a.trim()) return;
      const { error } = await supabase.from('event_notes').insert({ event_id: eventId, content: form.a.trim(), color: '#FEF3C7' });
      if (error) throw new Error(error.message);
      setForm((current: any) => ({ ...current, a: '' }));
      setComposer(null);
    });
  }

  async function deleteNote(noteId: string) {
    await act(async () => {
      const { error } = await supabase.from('event_notes').delete().eq('id', noteId);
      if (error) throw new Error(error.message);
    });
  }

  async function assignDirectoryMembers(team: any, members: any[]) {
    await act(async () => {
      if (!members.length) return;
      const existingIds = new Set(data.team.map((item) => String(item.advisor_team_member_id ?? '')));
      const rows = members.filter((member) => !existingIds.has(String(member.id))).map((member) => ({
        event_id: eventId,
        advisor_team_id: team.id,
        advisor_team_member_id: member.id,
        team_name: team.name,
        is_leader: team.leader_member_id === member.id,
        name: member.name,
        role: member.role || 'Assessoria',
        phone: member.phone || null,
        photo_file_id: member.photo_file_id || null,
        photo_url: null,
      }));
      if (!rows.length) return;
      const { error } = await (supabase as any).from('event_team_members').insert(rows);
      if (error) throw new Error(error.message);
    });
  }

  async function createTeamMember() {
    await act(async () => {
      if (!form.a.trim()) return;
      const { error } = await supabase.from('event_team_members').insert({
        event_id: eventId,
        name: form.a.trim(),
        phone: form.b.trim() || null,
        role: form.c.trim() || 'Cerimonialista',
      });
      if (error) throw new Error(error.message);
      setForm((current: any) => ({ ...current, a: '', b: '', c: '' }));
      setComposer(null);
    });
  }

  async function deleteTeamMember(memberId: string) {
    await act(async () => {
      const { error } = await supabase.from('event_team_members').delete().eq('id', memberId);
      if (error) throw new Error(error.message);
    });
  }

  async function reloadTablesModule() {
    await Promise.all([loadKey('tables', 'reset'), loadKey('guests', 'reset')]);
  }

  async function allocateNextGuest(tableId: string) {
    await act(async () => {
      const guest = data.guests.find((candidate) => !candidate.table_id);
      if (!guest) return;
      const { error } = await supabase.from('event_guests').update({ table_id: tableId }).eq('id', guest.id);
      if (error) throw new Error(error.message);
    });
  }

  async function deleteTable(tableId: string) {
    await act(async () => {
      await supabase.from('event_guests').update({ table_id: null }).eq('table_id', tableId);
      const { error } = await supabase.from('event_tables').delete().eq('id', tableId);
      if (error) throw new Error(error.message);
    });
  }

  async function createTable() {
    await act(async () => {
      const seats = Number(form.b);
      if (!form.a.trim() || !Number.isFinite(seats) || seats < 1) return;
      const { error } = await supabase.from('event_tables').insert({ event_id: eventId, name: form.a.trim(), seats, shape: 'round' });
      if (error) throw new Error(error.message);
      setForm((current: any) => ({ ...current, a: '', b: '' }));
      setComposer(null);
    });
  }

  function updateTablePosition(tableId: string, x: number, y: number) {
    setData((current) => ({
      ...current,
      tables: current.tables.map((table) => table.id === tableId ? { ...table, posx: x, posy: y } : table),
    }));
  }

  async function dispatchWhatsApp(mode: 'bulk' | 'single', guestId?: string) {
    await act(async () => {
      const baseInviteUrl = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://app.painelprime.com.br/convite';
      const { data: response, error } = await supabase.functions.invoke('whatsapp-rsvp-dispatch', {
        body: { action: mode, baseInviteUrl, eventId, guestId },
      });
      if (error) throw new Error(error.message);
      const summary = (response as any)?.summary;
      const sent = Number(summary?.sent ?? summary?.accepted ?? 0);
      const failed = Number(summary?.failed ?? 0);
      Alert.alert('Disparo concluído', `${sent} convite(s) enviado(s)${failed ? ` e ${failed} falha(s)` : ''}.`);
      await loadTab('invites', true);
    }, false);
  }

  async function resendGuestQr(guestId: string) {
    await act(async () => {
      const { error } = await supabase.functions.invoke('whatsapp-rsvp-review-action', {
        body: { action: 'resend_qr', eventId, guestId },
      });
      if (error) throw new Error(error.message);
      Alert.alert('QR Code enviado', 'O QR Code de entrada foi reenviado pelo WhatsApp.');
    }, false);
  }

  async function ensureInviteToken(guest: any) {
    if (guest.invite_token) return guest.invite_token as string;
    const token = `${guest.id}-${Date.now()}`;
    const { error } = await supabase.from('event_guests').update({ invite_token: token }).eq('id', guest.id);
    if (error) throw new Error(error.message);
    return token;
  }

  async function shareFilteredInvites() {
    await act(async () => {
      const lines: string[] = [];
      for (const guest of filteredGuests) {
        const token = await ensureInviteToken(guest);
        const base = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://painelprime.com.br/convite';
        const link = `${base}/${token}`;
        const message = form.inviteTemplate.replaceAll('[Nome do Convidado]', guest.name || 'Convidado').replaceAll('[LinkRSVP]', link);
        lines.push(`${guest.name}: ${message}`);
      }
      await Share.share({ message: lines.join('\n\n') || 'Sem convidados filtrados.' });
    });
  }

  async function shareGuestInvite(guest: any) {
    await act(async () => {
      const token = await ensureInviteToken(guest);
      const base = process.env.EXPO_PUBLIC_BASE_INVITE_URL || 'https://painelprime.com.br/convite';
      const finalLink = `${base}/${token}`;
      const finalMessage = form.inviteTemplate
        .replaceAll('[Nome do Convidado]', guest.name || 'Convidado')
        .replaceAll('[LinkRSVP]', finalLink);
      await Share.share({ message: finalMessage });
    });
  }

  async function saveInviteConfig() {
    await act(async () => {
      const payload = {
        invite_message_template: form.inviteTemplate.trim() || null,
        invite_dress_code: form.inviteDress.trim() || null,
      };
      const { error } = await supabase.from('events').update(payload).eq('id', eventId);
      if (error) throw new Error(error.message);
      setEvent((current) => current ? { ...current, ...payload } : current);
      setComposer(null);
    }, false);
  }

  async function sendReceptionAccess(memberId: string) {
    await act(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente.');
      const { error } = await supabase.functions.invoke('send-reception-access-link', {
        body: { accessToken, eventId, memberId },
      });
      if (error) throw new Error(error.message);
      Alert.alert('Acesso enviado', 'O link seguro da recepção foi enviado pelo WhatsApp.');
    }, false);
  }

  return {
    teamDirectory,
    createNote,
    deleteNote,
    assignDirectoryMembers,
    createTeamMember,
    deleteTeamMember,
    reloadTablesModule,
    allocateNextGuest,
    deleteTable,
    createTable,
    updateTablePosition,
    dispatchWhatsApp,
    resendGuestQr,
    shareFilteredInvites,
    shareGuestInvite,
    saveInviteConfig,
    sendReceptionAccess,
  };
}
