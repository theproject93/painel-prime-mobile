import {
  NOTIFICATION_CHANNELS,
  setupNotificationChannels,
  scheduleMeetingAlerts,
  scheduleTaskReminder,
  cancelMeetingAlerts,
  cancelTaskReminder,
} from './notificationService';

// Mock simples para validação isolada das regras de agendamento e canais
describe('notificationService', () => {
  it('deve exportar os 4 canais obrigatórios do Android', () => {
    expect(NOTIFICATION_CHANNELS.REUNIOES).toBe('reunioes_alertas');
    expect(NOTIFICATION_CHANNELS.TAREFAS).toBe('tarefas_prazos');
    expect(NOTIFICATION_CHANNELS.RSVP).toBe('rsvp_atividade');
    expect(NOTIFICATION_CHANNELS.FINANCEIRO).toBe('financeiro_avisos');
  });

  it('deve validar estrutura de payloads de agendamento de reuniões', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    const result = await scheduleMeetingAlerts({
      id: 'test-meeting-1',
      title: 'Alinhamento Cerimonial',
      scheduledAt: futureDate,
      roomUrl: 'https://painelprime.daily.co/test-room',
    });

    expect(result).toHaveProperty('scheduled15m');
    expect(result).toHaveProperty('scheduledStart');
  });

  it('não deve agendar reuniões com data no passado', async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const result = await scheduleMeetingAlerts({
      id: 'test-meeting-past',
      title: 'Reunião Passada',
      scheduledAt: pastDate,
    });

    expect(result.scheduled15m).toBe(false);
    expect(result.scheduledStart).toBe(false);
  });

  it('não deve agendar tarefas com vencimento no passado', async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const result = await scheduleTaskReminder({
      id: 'task-1',
      title: 'Conferir lista de padrinhos',
      dueDate: pastDate,
    });

    expect(result).toBe(false);
  });
});
