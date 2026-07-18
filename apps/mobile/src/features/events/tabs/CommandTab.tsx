import { Pressable, Text, TextInput, View } from 'react-native';

import { Card, CommandLine, Small } from '../EventDetailsParts';
import type { EventDetailsTab } from '../eventDetailsData';
import { brl, labelVendorStatus } from '../eventDetailsUtils';
import { styles } from '../eventDetailsStyles';

export type CommandTabModel = {
  command: any;
  commandLeadInput: string;
  commandGraceInput: string;
  savingCommandConfig: boolean;
  alerts: any[];
  commandSlaAlerts: any[];
  incidentStats: any;
  budgetBalance: number;
  vendors: any[];
  latestCommandVendorStatus: Map<string, any>;
  commandIncidentForm: any;
  savingCommandIncident: boolean;
  commandIncidents: any[];
  resolvingIncidentId: string | null;
  onLeadInputChange: (value: string) => void;
  onGraceInputChange: (value: string) => void;
  onSaveRules: () => void;
  onCompleteOverdueTasks: () => void;
  onConfirmVendors: () => void;
  onOpenModule: (tab: EventDetailsTab) => void;
  onUpdateVendorStatus: (vendorId: string, status: any) => void;
  onIncidentFormChange: (updater: (current: any) => any) => void;
  onCreateIncident: () => void;
  onResolveIncident: (incidentId: string) => void;
};

export function CommandTab({ model: m }: { model: CommandTabModel }) {
  return (
    <Card title="Torre de Comando">
      <Text style={styles.commandTitle}>Status operacional do evento</Text>
      <View style={styles.commandScoreWrap}>
        <Text style={styles.commandScoreLabel}>Score operacional</Text><Text style={styles.commandScoreValue}>{m.command.score}/100</Text>
        <View style={styles.commandTrack}><View style={[styles.commandFill, { width: `${Math.max(8, m.command.score)}%`, backgroundColor: m.command.score < 55 ? '#DC2626' : m.command.score < 75 ? '#D97706' : '#16A34A' }]} /></View>
      </View>

      <View style={styles.commandRulesCard}>
        <Text style={styles.commandBlockTitle}>Regras de alerta (SLA)</Text>
        <View style={styles.commandRuleGrid}>
          <TextInput style={[styles.input, styles.commandRuleInput]} value={m.commandLeadInput} onChangeText={m.onLeadInputChange} placeholder="Pre-alerta (60,30,15)" />
          <TextInput style={[styles.input, styles.commandRuleInput]} value={m.commandGraceInput} onChangeText={m.onGraceInputChange} placeholder="Tolerância (min)" keyboardType="numeric" />
        </View>
        <Pressable style={styles.btnGhost} onPress={m.onSaveRules}><Text style={styles.smallText}>{m.savingCommandConfig ? 'Salvando regras...' : 'Salvar regras'}</Text></Pressable>
      </View>

      {m.alerts.length > 0 ? <View style={styles.commandBlock}>
        <Text style={styles.commandBlockTitle}>Alertas gerais</Text>
        {m.alerts.map((alert, index) => <Text key={`${alert.type}-${index}`} style={styles.commandItem}>{alert.message}</Text>)}
      </View> : null}
      {m.commandSlaAlerts.length > 0 ? <View style={styles.commandBlock}>
        <Text style={styles.commandBlockTitle}>Alertas SLA de fornecedores</Text>
        {m.commandSlaAlerts.map((alert) => <View key={alert.dedupe_key} style={styles.commandSlaRow}>
          <Text style={styles.commandItem}>{alert.message}</Text>
          <Text style={[styles.commandSeverity, alert.severity === 'critical' ? styles.commandSeverityCritical : alert.severity === 'warning' ? styles.commandSeverityWarning : styles.commandSeverityInfo]}>{alert.severity.toUpperCase()}</Text>
        </View>)}
      </View> : null}

      <View style={styles.rowBtns}>
        <Small onPress={m.onCompleteOverdueTasks}>Concluir atrasadas</Small>
        <Small onPress={m.onConfirmVendors}>Confirmar fornecedores</Small>
        <Small onPress={() => m.onOpenModule('budget')}>Abrir financeiro</Small>
      </View>
      <Text style={styles.caption}>Incidentes: {m.incidentStats.open} abertos | {m.incidentStats.resolved} resolvidos</Text>
      <CommandLine level={m.command.pendingTasks > 10 ? 'high' : 'medium'} text={`Tarefas pendentes: ${m.command.pendingTasks}`} />
      <CommandLine level={m.command.overdueCount > 0 ? 'high' : 'low'} text={`Tarefas atrasadas: ${m.command.overdueCount}`} />
      <CommandLine level={m.command.pendingVendors > 3 ? 'high' : 'medium'} text={`Fornecedores pendentes: ${m.command.pendingVendors}`} />
      <CommandLine level={m.command.pendingRsvp > 20 ? 'medium' : 'low'} text={`RSVP pendente: ${m.command.pendingRsvp}`} />
      <CommandLine level={m.command.negativeBalance ? 'high' : 'low'} text={`Saúde financeira: saldo ${brl(m.budgetBalance)}`} />

      <View style={styles.commandBlock}>
        <Text style={styles.commandBlockTitle}>Itens críticos da timeline (sem responsável)</Text>
        {m.command.criticalTimeline.length === 0 ? <Text style={styles.commandItem}>Sem pendências críticas.</Text>
          : m.command.criticalTimeline.map((item: any) => <Text key={item.id} style={styles.commandItem}>{item.time || '--:--'} | {item.activity || 'Atividade'}</Text>)}
      </View>
      <View style={styles.commandBlock}>
        <Text style={styles.commandBlockTitle}>Operação de fornecedores</Text>
        {m.vendors.length === 0 ? <Text style={styles.commandItem}>Sem fornecedores cadastrados.</Text> : m.vendors.slice(0, 12).map((vendor) => {
          const current = m.latestCommandVendorStatus.get(vendor.id)?.status ?? 'pending';
          return <View key={vendor.id} style={styles.commandVendorCard}>
            <View style={styles.rowBetween}><Text style={styles.commandVendorName}>{vendor.name || 'Fornecedor'}</Text><Text style={styles.commandVendorStatus}>{labelVendorStatus(current)}</Text></View>
            <Text style={styles.caption}>Previsto: {vendor.expected_arrival_time || '--:--'} - {vendor.expected_done_time || '--:--'}</Text>
            <View style={styles.rowBtns}>
              <Small onPress={() => m.onUpdateVendorStatus(vendor.id, 'en_route')}>A caminho</Small>
              <Small onPress={() => m.onUpdateVendorStatus(vendor.id, 'arrived')}>Chegou</Small>
              <Small onPress={() => m.onUpdateVendorStatus(vendor.id, 'done')}>Finalizado</Small>
            </View>
          </View>;
        })}
      </View>

      <View style={styles.commandBlock}>
        <Text style={styles.commandBlockTitle}>SOS da assessoria</Text>
        <TextInput style={styles.input} value={m.commandIncidentForm.title} onChangeText={(title) => m.onIncidentFormChange((current) => ({ ...current, title }))} placeholder="Título do incidente" />
        <TextInput style={styles.input} value={m.commandIncidentForm.action_plan} onChangeText={(action_plan) => m.onIncidentFormChange((current) => ({ ...current, action_plan }))} placeholder="Plano B / ação imediata" />
        <TextInput style={[styles.input, styles.area]} value={m.commandIncidentForm.note} onChangeText={(note) => m.onIncidentFormChange((current) => ({ ...current, note }))} placeholder="Detalhes do incidente" multiline />
        <View style={styles.rowBtns}>
          <Small onPress={() => m.onIncidentFormChange((current) => ({ ...current, severity: 'warning' }))}>Severidade warning</Small>
          <Small onPress={() => m.onIncidentFormChange((current) => ({ ...current, severity: 'critical' }))}>Severidade critical</Small>
        </View>
        <TextInput style={styles.input} value={m.commandIncidentForm.vendor_id} onChangeText={(vendor_id) => m.onIncidentFormChange((current) => ({ ...current, vendor_id }))} placeholder="vendor_id (opcional)" />
        <Pressable style={styles.btn} onPress={m.onCreateIncident}><Text style={styles.btnText}>{m.savingCommandIncident ? 'Registrando...' : 'Acionar SOS'}</Text></Pressable>
        {m.commandIncidents.length === 0 ? <Text style={styles.commandItem}>Nenhum incidente registrado.</Text> : m.commandIncidents.map((incident) => {
          const vendorInfo = Array.isArray(incident.vendor) ? incident.vendor[0] : incident.vendor;
          return <View key={incident.id} style={[styles.commandIncidentCard, incident.status === 'open' ? styles.commandIncidentOpen : styles.commandIncidentResolved]}>
            <View style={styles.rowBetween}><Text style={styles.commandVendorName}>{incident.title}</Text><Text style={styles.caption}>{incident.severity.toUpperCase()}</Text></View>
            <Text style={styles.caption}>{vendorInfo?.name ?? 'Sem fornecedor'} | {new Date(incident.created_at).toLocaleString('pt-BR')}</Text>
            {incident.action_plan ? <Text style={styles.row}>Plano: {incident.action_plan}</Text> : null}
            {incident.note ? <Text style={styles.row}>Nota: {incident.note}</Text> : null}
            {incident.status === 'open' ? <Pressable style={styles.btnGhost} onPress={() => m.onResolveIncident(incident.id)}>
              <Text style={styles.smallText}>{m.resolvingIncidentId === incident.id ? 'Resolvendo...' : 'Marcar como resolvido'}</Text>
            </Pressable> : <Text style={styles.caption}>Resolvido</Text>}
          </View>;
        })}
      </View>
      <View style={styles.rowBtns}>
        <Small onPress={() => m.onOpenModule('tasks')}>Abrir tarefas</Small><Small onPress={() => m.onOpenModule('vendors')}>Abrir fornecedores</Small><Small onPress={() => m.onOpenModule('invites')}>Abrir convites</Small>
      </View>
    </Card>
  );
}
