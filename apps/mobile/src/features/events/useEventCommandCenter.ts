import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { supabase } from '../../lib/supabase';
import type { EventDataState, EventDetailsTab } from './eventDetailsData';
import type {
  CommandComputedAlert,
  CommandConfig,
  CommandIncidentRow,
  CommandStatusRow,
  CommandVendorStatus,
  EventRow,
} from './eventDetailsTypes';
import { combineDateTime, isOverdueDate } from './eventDetailsUtils';

type UseEventCommandCenterArgs = {
  eventId: string;
  activeTab: EventDetailsTab;
  loadingEvent: boolean;
  event: EventRow | null;
  data: EventDataState;
  userId?: string;
  budgetTotal: number;
  totalExpenses: number;
  setError: Dispatch<SetStateAction<string>>;
  act: (action: () => Promise<void>, reload?: boolean) => Promise<void>;
};

const DEFAULT_COMMAND_CONFIG: CommandConfig = {
  lead_minutes: [60, 30, 15],
  late_grace_minutes: 10,
};

const EMPTY_INCIDENT_FORM = {
  vendor_id: '',
  severity: 'warning' as 'warning' | 'critical',
  title: '',
  action_plan: '',
  note: '',
};

export function useEventCommandCenter({
  eventId,
  activeTab,
  loadingEvent,
  event,
  data,
  userId,
  budgetTotal,
  totalExpenses,
  setError,
  act,
}: UseEventCommandCenterArgs) {
  const [commandStatuses, setCommandStatuses] = useState<CommandStatusRow[]>([]);
  const [commandIncidents, setCommandIncidents] = useState<CommandIncidentRow[]>([]);
  const [commandConfig, setCommandConfig] = useState<CommandConfig>(DEFAULT_COMMAND_CONFIG);
  const [commandLeadInput, setCommandLeadInput] = useState('60,30,15');
  const [commandGraceInput, setCommandGraceInput] = useState('10');
  const [savingCommandConfig, setSavingCommandConfig] = useState(false);
  const [savingCommandIncident, setSavingCommandIncident] = useState(false);
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [commandIncidentForm, setCommandIncidentForm] = useState(EMPTY_INCIDENT_FORM);

  useEffect(() => {
    setCommandStatuses([]);
    setCommandIncidents([]);
    setCommandConfig(DEFAULT_COMMAND_CONFIG);
    setCommandLeadInput('60,30,15');
    setCommandGraceInput('10');
    setCommandIncidentForm(EMPTY_INCIDENT_FORM);
  }, [eventId]);

  async function loadCommandCenterData() {
    const [statusRes, incidentsRes, configRes] = await Promise.all([
      supabase
        .from('event_vendor_status')
        .select('vendor_id,status,created_at,updated_by,note')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(240),
      supabase
        .from('event_command_incidents')
        .select('id,event_id,vendor_id,severity,status,title,note,action_plan,created_at,resolved_at,vendor:event_vendors(name,category)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('event_command_config')
        .select('lead_minutes,late_grace_minutes')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);

    if (!statusRes.error) setCommandStatuses((statusRes.data as CommandStatusRow[]) ?? []);
    if (!incidentsRes.error) setCommandIncidents((incidentsRes.data as CommandIncidentRow[]) ?? []);
    if (!configRes.error && configRes.data) {
      const loaded = configRes.data as CommandConfig;
      const lead = Array.isArray(loaded.lead_minutes) ? loaded.lead_minutes : [60, 30, 15];
      const grace = Number(loaded.late_grace_minutes ?? 10);
      setCommandConfig({
        lead_minutes: lead,
        late_grace_minutes: Number.isFinite(grace) ? grace : 10,
      });
      setCommandLeadInput(lead.join(','));
      setCommandGraceInput(String(Number.isFinite(grace) ? grace : 10));
    }
  }

  useEffect(() => {
    if (loadingEvent || activeTab !== 'command') return;
    void loadCommandCenterData();
  }, [activeTab, loadingEvent, eventId]);

  const latestCommandVendorStatus = useMemo(() => {
    const map = new Map<string, CommandStatusRow>();
    commandStatuses.forEach((row) => {
      if (!map.has(row.vendor_id)) map.set(row.vendor_id, row);
    });
    return map;
  }, [commandStatuses]);

  const commandSlaAlerts = useMemo<CommandComputedAlert[]>(() => {
    if (!event?.event_date) return [];
    const now = new Date();
    const leadMinutes = (commandConfig.lead_minutes ?? [60, 30, 15])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((a, b) => b - a);
    const lateGrace = Number(commandConfig.late_grace_minutes ?? 10);
    const out: CommandComputedAlert[] = [];

    data.vendors.forEach((vendor) => {
      const currentStatus = latestCommandVendorStatus.get(vendor.id)?.status ?? 'pending';
      const expectedArrival = combineDateTime(event.event_date, vendor.expected_arrival_time ?? null);
      const expectedDone = combineDateTime(event.event_date, vendor.expected_done_time ?? null);

      if (expectedArrival && currentStatus !== 'arrived' && currentStatus !== 'done') {
        leadMinutes.forEach((minutes) => {
          const trigger = new Date(expectedArrival.getTime() - minutes * 60 * 1000);
          if (now >= trigger && now < expectedArrival) {
            const severity: CommandComputedAlert['severity'] =
              minutes <= 15 ? 'critical' : minutes <= 30 ? 'warning' : 'info';
            out.push({
              vendor_id: vendor.id,
              alert_type: 'arrival_pre_alert',
              severity,
              message: `${vendor.name || 'Fornecedor'}: faltam ${minutes} min para a chegada prevista.`,
              dedupe_key: `${event.id}:${vendor.id}:arrival_pre:${minutes}`,
            });
          }
        });
        const lateAt = new Date(expectedArrival.getTime() + lateGrace * 60 * 1000);
        if (now >= lateAt) {
          out.push({
            vendor_id: vendor.id,
            alert_type: 'arrival_late',
            severity: 'critical',
            message: `${vendor.name || 'Fornecedor'}: chegada atrasada (previsto ${vendor.expected_arrival_time ?? '--:--'}).`,
            dedupe_key: `${event.id}:${vendor.id}:arrival_late`,
          });
        }
      }

      if (expectedDone && currentStatus !== 'done') {
        const doneLateAt = new Date(expectedDone.getTime() + lateGrace * 60 * 1000);
        if (now >= doneLateAt) {
          out.push({
            vendor_id: vendor.id,
            alert_type: 'done_late',
            severity: 'warning',
            message: `${vendor.name || 'Fornecedor'}: finalização atrasada (previsto ${vendor.expected_done_time ?? '--:--'}).`,
            dedupe_key: `${event.id}:${vendor.id}:done_late`,
          });
        }
      }
    });

    const seen = new Set<string>();
    return out.filter((item) => {
      if (seen.has(item.dedupe_key)) return false;
      seen.add(item.dedupe_key);
      return true;
    });
  }, [commandConfig.late_grace_minutes, commandConfig.lead_minutes, data.vendors, event?.event_date, event?.id, latestCommandVendorStatus]);

  const incidentStats = useMemo(() => {
    const open = commandIncidents.filter((row) => row.status === 'open').length;
    const resolved = commandIncidents.filter((row) => row.status === 'resolved').length;
    return { open, resolved };
  }, [commandIncidents]);

  const command = useMemo(() => {
    const pendingTasksCount = data.tasks.filter((task) => !task.completed).length;
    const pendingVendors = data.vendors.filter((vendor) => (vendor.status ?? 'pending') !== 'confirmed').length;
    const pendingRsvp = data.guests.filter((guest) => (guest.rsvp_status ?? 'pending') === 'pending').length;
    const negativeBalance = budgetTotal - totalExpenses < 0;
    const criticalTimeline = data.timeline
      .filter((item) => !item.assignee_name || String(item.assignee_name).trim().length === 0)
      .slice(0, 5);
    const overdueCount = data.tasks.filter((item) => !item.completed && isOverdueDate(item.due_date)).length;
    const score = Math.max(
      0,
      100 -
        pendingTasksCount * 2 -
        pendingVendors * 6 -
        Math.round(pendingRsvp * 0.4) -
        (negativeBalance ? 18 : 0) -
        overdueCount * 3 -
        criticalTimeline.length * 4 -
        Math.min(24, incidentStats.open * 8) -
        Math.min(16, commandSlaAlerts.filter((row) => row.severity !== 'info').length * 2),
    );
    return { pendingTasks: pendingTasksCount, pendingVendors, pendingRsvp, negativeBalance, criticalTimeline, score, overdueCount };
  }, [budgetTotal, commandSlaAlerts, data.guests, data.tasks, data.timeline, data.vendors, incidentStats.open, totalExpenses]);

  async function saveCommandRules() {
    const parsedLead = commandLeadInput
      .split(',')
      .map((row) => Number(row.trim()))
      .filter((row) => Number.isFinite(row) && row >= 0);
    const uniqueLead = Array.from(new Set(parsedLead)).sort((a, b) => b - a);
    const grace = Number(commandGraceInput);
    const safeGrace = Number.isFinite(grace) && grace >= 0 ? grace : 10;
    setSavingCommandConfig(true);
    setError('');
    try {
      const { error: upsertError } = await supabase.from('event_command_config').upsert({
        event_id: eventId,
        lead_minutes: uniqueLead.length > 0 ? uniqueLead : [60, 30, 15],
        late_grace_minutes: safeGrace,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw new Error(upsertError.message);
      setCommandConfig({
        lead_minutes: uniqueLead.length > 0 ? uniqueLead : [60, 30, 15],
        late_grace_minutes: safeGrace,
      });
    } catch (saveError: any) {
      setError(saveError?.message ?? 'Não foi possível salvar regras da torre.');
    } finally {
      setSavingCommandConfig(false);
    }
  }

  async function updateVendorOperationalStatus(vendorId: string, status: CommandVendorStatus) {
    await act(async () => {
      const { error: insertError } = await supabase.from('event_vendor_status').insert({
        event_id: eventId,
        vendor_id: vendorId,
        status,
        updated_by: 'assessoria',
      });
      if (insertError) throw new Error(insertError.message);
      await loadCommandCenterData();
    }, false);
  }

  async function completeOverdueTasks() {
    await act(async () => {
      const overdueIds = data.tasks
        .filter((task) => !task.completed && isOverdueDate(task.due_date))
        .map((task) => task.id);
      if (overdueIds.length === 0) return;
      const { error: updateError } = await supabase
        .from('event_tasks')
        .update({ completed: true })
        .in('id', overdueIds);
      if (updateError) throw new Error(updateError.message);
    });
  }

  async function confirmPendingVendors() {
    await act(async () => {
      const vendorIds = data.vendors
        .filter((vendor) => (vendor.status ?? 'pending') !== 'confirmed')
        .map((vendor) => vendor.id);
      if (vendorIds.length === 0) return;
      const { error: updateError } = await supabase
        .from('event_vendors')
        .update({ status: 'confirmed' })
        .in('id', vendorIds);
      if (updateError) throw new Error(updateError.message);
    });
  }

  async function createCommandIncident() {
    const title = commandIncidentForm.title.trim();
    if (!title || savingCommandIncident) return;
    setSavingCommandIncident(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        event_id: eventId,
        vendor_id: commandIncidentForm.vendor_id || null,
        severity: commandIncidentForm.severity,
        title,
        action_plan: commandIncidentForm.action_plan.trim() || null,
        note: commandIncidentForm.note.trim() || null,
      };
      if (userId) payload.created_by = userId;
      const { error: insertError } = await supabase.from('event_command_incidents').insert(payload);
      if (insertError) throw new Error(insertError.message);
      setCommandIncidentForm(EMPTY_INCIDENT_FORM);
      await loadCommandCenterData();
    } catch (incidentError: any) {
      setError(incidentError?.message ?? 'Não foi possível registrar incidente.');
    } finally {
      setSavingCommandIncident(false);
    }
  }

  async function resolveCommandIncident(incidentId: string) {
    if (resolvingIncidentId) return;
    setResolvingIncidentId(incidentId);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      };
      if (userId) payload.resolved_by = userId;
      const { error: resolveError } = await supabase
        .from('event_command_incidents')
        .update(payload)
        .eq('id', incidentId);
      if (resolveError) throw new Error(resolveError.message);
      await loadCommandCenterData();
    } catch (resolveError: any) {
      setError(resolveError?.message ?? 'Não foi possível resolver incidente.');
    } finally {
      setResolvingIncidentId(null);
    }
  }

  return {
    commandLeadInput,
    setCommandLeadInput,
    commandGraceInput,
    setCommandGraceInput,
    savingCommandConfig,
    commandIncidentForm,
    setCommandIncidentForm,
    savingCommandIncident,
    resolvingIncidentId,
    commandIncidents,
    latestCommandVendorStatus,
    commandSlaAlerts,
    incidentStats,
    command,
    saveCommandRules,
    completeOverdueTasks,
    confirmPendingVendors,
    updateVendorOperationalStatus,
    createCommandIncident,
    resolveCommandIncident,
  };
}
