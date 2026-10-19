import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const NOTIFICATION_CHANNELS = {
  REUNIOES: 'reunioes_alertas',
  TAREFAS: 'tarefas_prazos',
  RSVP: 'rsvp_atividade',
  FINANCEIRO: 'financeiro_avisos',
} as const;

export type NotificationChannelId = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export interface MeetingNotificationPayload {
  id: string;
  title: string;
  scheduledAt: string; // ISO String
  roomUrl?: string;
}

export interface TaskNotificationPayload {
  id: string;
  title: string;
  dueDate: string; // ISO String or YYYY-MM-DD
  eventName?: string;
}

// Configura o comportamento quando a notificação chega com o app em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Inicializa e registra os canais nativos de notificação do Android.
 * Essencial no Android 8.0+ (API 26+) para exibição de som, vibração e banner heads-up.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Canal 1: Reuniões e Chamadas (Prioridade MÁXIMA — som, banner heads-up e vibração proeminente)
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.REUNIOES, {
    name: 'Reuniões e Chamadas',
    description: 'Alertas de início imediato e 15 minutos antes das reuniões virtuais',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#023c69',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  // Canal 2: Tarefas e Prazos do Evento (Prioridade ALTA)
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.TAREFAS, {
    name: 'Tarefas e Prazos',
    description: 'Lembretes de tarefas pendentes e prazos com vencimento hoje',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 150, 150, 150],
    lightColor: '#023c69',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  // Canal 3: Confirmações do WhatsApp RSVP (Prioridade PADRÃO)
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.RSVP, {
    name: 'Confirmações de Convidados',
    description: 'Atualizações de respostas de presença e transbordo IA de convidados',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    lightColor: '#023c69',
  });

  // Canal 4: Faturamento e Assinaturas (Prioridade BAIXA)
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.FINANCEIRO, {
    name: 'Faturamento e Assinaturas',
    description: 'Avisos de recarga de mensagens WhatsApp e extratos de assinaturas',
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
  });
}

/**
 * Solicita permissão para disparo de notificações locais e remotas.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Agenda lembretes locais para reuniões:
 * 1. Alerta de 15 minutos antes do início
 * 2. Alerta imediato no momento exato do início
 */
export async function scheduleMeetingAlerts(meeting: MeetingNotificationPayload): Promise<{
  scheduled15m: boolean;
  scheduledStart: boolean;
}> {
  if (Platform.OS === 'web') return { scheduled15m: false, scheduledStart: false };

  const meetingTime = new Date(meeting.scheduledAt).getTime();
  const now = Date.now();

  let scheduled15m = false;
  let scheduledStart = false;

  // 1. Alerta de 15 minutos antes
  const alert15m = meetingTime - 15 * 60 * 1000;
  if (alert15m > now) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `meeting-15m-${meeting.id}`,
        content: {
          title: 'Reunião em 15 minutos 📅',
          body: `"${meeting.title}" começará em breve. Toque para acessar a sala.`,
          sound: 'default',
          color: '#023c69',
          data: {
            url: `painelprime://reunioes/${meeting.id}`,
            meetingId: meeting.id,
            roomUrl: meeting.roomUrl,
            type: 'meeting_15m',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(alert15m),
          channelId: NOTIFICATION_CHANNELS.REUNIOES,
        },
      });
      scheduled15m = true;
    } catch (err) {
      console.warn('Erro ao agendar alerta de 15m da reunião:', err);
    }
  }

  // 2. Alerta de Início Imediato
  if (meetingTime > now) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `meeting-start-${meeting.id}`,
        content: {
          title: 'Sua reunião está começando agora! 🚀',
          body: `A sala de "${meeting.title}" já está disponível.`,
          sound: 'default',
          color: '#023c69',
          data: {
            url: `painelprime://reunioes/${meeting.id}`,
            meetingId: meeting.id,
            roomUrl: meeting.roomUrl,
            type: 'meeting_start',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(meetingTime),
          channelId: NOTIFICATION_CHANNELS.REUNIOES,
        },
      });
      scheduledStart = true;
    } catch (err) {
      console.warn('Erro ao agendar alerta de início da reunião:', err);
    }
  }

  return { scheduled15m, scheduledStart };
}

/**
 * Agenda lembrete local para tarefas pendentes com vencimento.
 */
export async function scheduleTaskReminder(task: TaskNotificationPayload): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const dueTime = new Date(task.dueDate).getTime();
  const now = Date.now();

  if (dueTime <= now) return false;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `task-due-${task.id}`,
      content: {
        title: 'Tarefa com vencimento próximo ⏱️',
        body: `"${task.title}"${task.eventName ? ` do evento ${task.eventName}` : ''} precisa da sua atenção.`,
        sound: 'default',
        color: '#023c69',
        data: {
          url: `painelprime://tarefas/${task.id}`,
          taskId: task.id,
          type: 'task_due',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(dueTime),
        channelId: NOTIFICATION_CHANNELS.TAREFAS,
      },
    });
    return true;
  } catch (err) {
    console.warn('Erro ao agendar lembrete de tarefa:', err);
    return false;
  }
}

/**
 * Cancela lembretes agendados de uma reunião.
 */
export async function cancelMeetingAlerts(meetingId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`meeting-15m-${meetingId}`);
    await Notifications.cancelScheduledNotificationAsync(`meeting-start-${meetingId}`);
  } catch (err) {
    console.warn('Erro ao cancelar alertas da reunião:', err);
  }
}

/**
 * Cancela lembrete agendado de uma tarefa.
 */
export async function cancelTaskReminder(taskId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`task-due-${taskId}`);
  } catch (err) {
    console.warn('Erro ao cancelar lembrete de tarefa:', err);
  }
}

/**
 * Registra o listener para quando o usuário toca em uma notificação na bandeja do sistema.
 * Despacha o deep link correspondente.
 */
export function setupNotificationResponseListener(
  onNavigate: (url: string, data: Record<string, unknown>) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
    const url = typeof data.url === 'string' ? data.url : null;

    if (url) {
      onNavigate(url, data);
    }
  });

  return () => {
    subscription.remove();
  };
}
