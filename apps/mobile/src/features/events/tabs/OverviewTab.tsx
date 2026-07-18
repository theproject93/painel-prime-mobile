import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MoneyField, PrivacyToggle, SensitiveMoney } from '../../../components/ui/PremiumInputs';
import type { EventDetailsInitialTab } from '../../../navigation/eventRouteTypes';
import { colors } from '../../../theme/colors';
import { TaskSegment } from '../EventDetailsParts';
import type { OverviewAlert } from '../eventDetailsTypes';
import { brl } from '../eventDetailsUtils';
import { styles } from '../eventDetailsStyles';

export type OverviewTabModel = {
  alerts: OverviewAlert[];
  budgetTitle: string;
  budgetDescription: string;
  budgetEditDescription: string;
  hideFinancialValues: boolean;
  editingBudget: boolean;
  budgetDraft: string;
  budgetTotal: number;
  totalExpenses: number;
  budgetProgress: number;
  savingBudget: boolean;
  hasEventDate: boolean;
  daysRemaining: number;
  completedTasks: number;
  totalTasks: number;
  guestSummary: any;
  expensesForCharts: any[];
  paymentsByMethod: any[];
  totalPaidByMethod: number;
  pendingTasks: any[];
  overdueTasks: any[];
  todayTasks: any[];
  thisWeekTasks: any[];
  futureTasks: any[];
  onTogglePrivacy: () => void;
  onBudgetDraftChange: (value: string) => void;
  onCancelBudgetEdit: () => void;
  onStartBudgetEdit: () => void;
  onSaveBudget: () => void;
  onOpenModule: (tab: EventDetailsInitialTab) => void;
  onToggleTask: (taskId: string, completed: boolean) => Promise<void>;
};

export function OverviewTab({ model: m }: { model: OverviewTabModel }) {
  return (
    <View style={styles.overviewStack}>
      {m.alerts.length > 0 ? <View style={styles.alertsWrap}>
        {m.alerts.map((alert, index) => <View key={`${alert.type}-${index}`} style={[styles.alertRow,
          alert.type === 'error' ? styles.alertError : alert.type === 'warning' ? styles.alertWarning : styles.alertInfo]}>
          <Text style={styles.alertText}>{alert.message}</Text>
        </View>)}
      </View> : null}

      <View style={styles.overviewFinanceHero}>
        <View style={styles.overviewFinanceHeader}>
          <View style={styles.formGrow}>
            <Text style={styles.overviewEyebrow}>Planejamento financeiro</Text>
            <Text style={styles.overviewFinanceTitle}>{m.budgetTitle}</Text>
            <Text style={styles.overviewFinanceCopy}>{m.budgetDescription}</Text>
          </View>
          <PrivacyToggle hidden={m.hideFinancialValues} onPress={m.onTogglePrivacy} />
        </View>
        {m.editingBudget ? <View style={styles.metricEditWrap}>
          <Text style={styles.overviewFinanceCopy}>{m.budgetEditDescription}</Text>
          <MoneyField value={m.budgetDraft} onChangeValue={m.onBudgetDraftChange} />
          <View style={styles.overviewFinanceActions}>
            <Pressable style={styles.overviewSecondaryAction} onPress={m.onCancelBudgetEdit}>
              <Text style={styles.overviewSecondaryActionText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.overviewPrimaryAction} onPress={m.onSaveBudget}>
              <Text style={styles.overviewPrimaryActionText}>{m.savingBudget ? 'Salvando...' : 'Salvar valor'}</Text>
            </Pressable>
          </View>
        </View> : <>
          <SensitiveMoney value={m.budgetTotal} hidden={m.hideFinancialValues} />
          <View style={styles.overviewMoneySplit}>
            <View style={styles.overviewMoneyItem}><View style={[styles.overviewMoneyDot, styles.overviewMoneyDotSpent]} />
              <View style={styles.formGrow}><Text style={styles.overviewMoneyLabel}>Já investido</Text>
                <Text style={styles.overviewMoneyValue}>{m.hideFinancialValues ? 'R$ ••••••' : brl(m.totalExpenses)}</Text></View>
            </View>
            <View style={styles.overviewMoneyDivider} />
            <View style={styles.overviewMoneyItem}><View style={[styles.overviewMoneyDot, styles.overviewMoneyDotAvailable]} />
              <View style={styles.formGrow}><Text style={styles.overviewMoneyLabel}>Ainda disponível</Text>
                <Text style={styles.overviewMoneyValue}>{m.hideFinancialValues ? 'R$ ••••••' : brl(m.budgetTotal - m.totalExpenses)}</Text></View>
            </View>
          </View>
          <View style={styles.overviewProgressTrack}><View style={[styles.overviewProgressFill, { width: `${Math.max(0, m.budgetProgress)}%` }]} /></View>
          <View style={styles.overviewFinanceActions}>
            <Pressable style={styles.overviewSecondaryAction} onPress={m.onStartBudgetEdit}><Ionicons name="pencil-outline" size={16} color={colors.text} accessible={false} /><Text style={styles.overviewSecondaryActionText}>Editar limite</Text></Pressable>
            <Pressable style={styles.overviewPrimaryAction} onPress={() => m.onOpenModule('budget')}><Text style={styles.overviewPrimaryActionText}>Ver orçamento</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF" accessible={false} /></Pressable>
          </View>
        </>}
      </View>

      <View style={styles.overviewSectionHeading}><View><Text style={styles.overviewSectionTitle}>O que merece atenção</Text><Text style={styles.caption}>Atalhos para conduzir o evento sem se perder.</Text></View></View>
      <View style={styles.overviewActionStack}>
        <Pressable style={styles.overviewActionCard} onPress={() => m.onOpenModule('history')}>
          <View style={[styles.overviewActionIcon, styles.overviewActionIconRose]}><Ionicons name="calendar-outline" size={20} color="#BE185D" accessible={false} /></View>
          <View style={styles.formGrow}><Text style={styles.overviewActionTitle}>Data do evento</Text><Text style={styles.overviewActionCopy}>Acompanhe o histórico e os marcos importantes.</Text></View>
          <View style={styles.overviewActionValueWrap}><Text style={styles.overviewActionValue}>{!m.hasEventDate ? '-' : m.daysRemaining <= 0 ? 'Hoje' : m.daysRemaining}</Text><Text style={styles.overviewActionUnit}>{m.daysRemaining > 0 ? 'dias' : ''}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedText} accessible={false} />
        </Pressable>
        <Pressable style={styles.overviewActionCard} onPress={() => m.onOpenModule('tasks')}>
          <View style={[styles.overviewActionIcon, styles.overviewActionIconBlue]}><Ionicons name="checkmark-done-outline" size={20} color="#1D4ED8" accessible={false} /></View>
          <View style={styles.formGrow}><Text style={styles.overviewActionTitle}>Tarefas do evento</Text><Text style={styles.overviewActionCopy}>{m.totalTasks - m.completedTasks} pendente{m.totalTasks - m.completedTasks === 1 ? '' : 's'} para organizar.</Text></View>
          <Text style={styles.overviewActionCounter}>{m.completedTasks}/{m.totalTasks}</Text><Ionicons name="chevron-forward" size={18} color={colors.mutedText} accessible={false} />
        </Pressable>
        <Pressable style={styles.overviewActionCard} onPress={() => m.onOpenModule('guests')}>
          <View style={[styles.overviewActionIcon, styles.overviewActionIconGreen]}><Ionicons name="people-outline" size={20} color="#047857" accessible={false} /></View>
          <View style={styles.formGrow}><Text style={styles.overviewActionTitle}>Lista de convidados</Text><Text style={styles.overviewActionCopy}>{m.guestSummary.pending} aguardando confirmação.</Text></View>
          <Text style={styles.overviewActionCounter}>{m.guestSummary.confirmed}/{m.guestSummary.total}</Text><Ionicons name="chevron-forward" size={18} color={colors.mutedText} accessible={false} />
        </Pressable>
      </View>

      <ChartCard title="Gastos por categoria" total={`Total gasto: ${brl(m.totalExpenses)}`} empty="Sem despesas ainda - adicione na aba Orçamento."
        rows={m.expensesForCharts.map((row) => ({ ...row, label: row.name }))} limit={6} />
      <ChartCard title="Pagamentos por método" total={`Total pago: ${brl(m.totalPaidByMethod)}`} empty="Sem pagamentos ainda - registre na aba Orçamento."
        rows={m.paymentsByMethod} />

      <View style={styles.card}>
        <View style={styles.rowBetween}><Text style={styles.subtitle}>Tarefas pendentes</Text><Text style={styles.caption}>{m.pendingTasks.length} de {m.totalTasks}</Text></View>
        <TaskSegment title={`Atrasadas (${m.overdueTasks.length})`} tone="error" tasks={m.overdueTasks} onToggle={m.onToggleTask} />
        <TaskSegment title={`Hoje (${m.todayTasks.length})`} tone="warning" tasks={m.todayTasks} onToggle={m.onToggleTask} />
        <TaskSegment title={`Esta semana (${m.thisWeekTasks.length})`} tone="info" tasks={m.thisWeekTasks} onToggle={m.onToggleTask} />
        <TaskSegment title={`Futuro (${m.futureTasks.length})`} tone="neutral" tasks={m.futureTasks} onToggle={m.onToggleTask} limit={2} />
        {m.pendingTasks.length === 0 ? <Text style={styles.caption}>Nenhuma tarefa pendente.</Text> : null}
        <Pressable style={styles.btnGhostWide} onPress={() => m.onOpenModule('tasks')}><Text style={styles.smallText}>Ver checklist completo</Text></Pressable>
      </View>
    </View>
  );
}

function ChartCard({ title, total, empty, rows, limit }: { title: string; total: string; empty: string; rows: any[]; limit?: number }) {
  const max = Math.max(...rows.map((item) => Number(item.value || 0)), 1);
  return <View style={styles.card}>
    <View style={styles.rowBetween}><Text style={styles.subtitle}>{title}</Text><Text style={styles.caption}>{total}</Text></View>
    {rows.length === 0 ? <Text style={styles.caption}>{empty}</Text> : <View style={styles.chartRows}>
      {rows.slice(0, limit ?? rows.length).map((row) => <View key={row.id} style={styles.chartRowItem}>
        <View style={styles.rowBetween}><Text style={styles.chartLabel}>{row.label}</Text><Text style={styles.chartValue}>{brl(Number(row.value || 0))}</Text></View>
        <View style={styles.chartTrack}><View style={[styles.chartFill, { width: `${Math.max(8, (Number(row.value || 0) / max) * 100)}%`, backgroundColor: row.color || '#D4AF37' }]} /></View>
      </View>)}
    </View>}
  </View>;
}
