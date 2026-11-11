export type AdoptionAudience = 'agency' | 'team' | 'vendor';
export type AdoptionProgress = { journey_id: string; step: number; status: 'active' | 'paused' | 'dismissed' | 'presented'; revision: number; version?: number };
export type AdoptionSnapshot = {
  tenant_id: string;
  audience: AdoptionAudience;
  plan: string;
  event_id: string | null;
  allowed: string[];
  facts: Record<string, boolean>;
  progress: AdoptionProgress[];
  achievements: { mission_id: string; earned_at: string; scope?: 'agency' | 'event' | 'individual'; context_key?: string }[];
};
export type Mission = {
  id: string;
  title: string;
  instruction: string;
  route: string | null;
  eventScoped?: boolean;
  orientation?: boolean;
  achievement?: string;
  criterion?: string;
};

export const MISSIONS: readonly Mission[] = [
  { id: 'overview', title: 'Encontre seu próximo passo', instruction: 'Veja seus eventos e os atalhos de trabalho no início.', route: '/dashboard', orientation: true },
  { id: 'agency', title: 'Apresente sua assessoria', instruction: 'Confira e salve o nome da sua assessoria. A marca é opcional.', route: '/mais/configuracoes', achievement: 'Assessoria identificada', criterion: 'Nome da assessoria salvo.' },
  { id: 'event', title: 'Cadastre seu primeiro evento', instruction: 'Crie um evento, informe nome e data e revise antes de salvar.', route: '/eventos', achievement: 'Primeiro evento', criterion: 'Evento salvo na assessoria.' },
  { id: 'client', title: 'Organize seu primeiro cliente', instruction: 'Cadastre um cliente com os dados de contato necessários.', route: '/clientes', achievement: 'Clientes em organização', criterion: 'Cliente salvo na assessoria.' },
  { id: 'contract', title: 'Prepare um contrato', instruction: 'Revise o contrato de um cliente. Assinaturas e envios exigem confirmação.', route: '/clientes' },
  { id: 'guests', title: 'Adicione os convidados', instruction: 'Cadastre um convidado neste evento e confira os dados antes de salvar.', route: 'guests', eventScoped: true, achievement: 'Lista de convidados iniciada', criterion: 'Convidado salvo neste evento.' },
  { id: 'vendors', title: 'Organize seus fornecedores', instruction: 'Adicione um fornecedor ao catálogo e salve os dados necessários.', route: '/fornecedores', achievement: 'Parceiros em organização', criterion: 'Fornecedor salvo no catálogo da assessoria.' },
  { id: 'timeline', title: 'Comece o cronograma', instruction: 'Inclua uma atividade com horário no cronograma deste evento.', route: 'timeline', eventScoped: true, achievement: 'Cronograma iniciado', criterion: 'Atividade salva no cronograma deste evento.' },
  { id: 'tasks', title: 'Conclua uma tarefa real', instruction: 'Marque uma tarefa como concluída somente depois de realizá-la.', route: 'tasks', eventScoped: true, achievement: 'Primeira tarefa concluída', criterion: 'Tarefa concluída neste evento.' },
  { id: 'finance', title: 'Registre um valor real', instruction: 'Registre uma receita ou despesa real e confira o valor antes de salvar.', route: '/financeiro' },
  { id: 'team', title: 'Conecte sua equipe', instruction: 'Convide uma pessoa para sua equipe e aguarde a ativação do acesso.', route: '/mais/equipe', achievement: 'Equipe conectada', criterion: 'Pessoa com acesso ativo na equipe.' },
  { id: 'reception', title: 'Prepare a Portaria Prime', instruction: 'Confira a lista. Faça check-in somente quando o convidado chegar.', route: 'reception', eventScoped: true },
  { id: 'ai', title: 'Peça ajuda à Plan IA', instruction: 'Na tela inicial, abra a Plan IA. Revise as sugestões. Toda ação proposta exige sua confirmação.', route: '/dashboard', achievement: 'Inteligência em ação', criterion: 'Proposta confirmada e executada pela Plan IA na sua conta.' },
  { id: 'rsvp', title: 'Acompanhe o WhatsApp RSVP', instruction: 'Confira contatos, destinatários e custos antes de confirmar um envio.', route: 'invites', eventScoped: true },
  { id: 'vendor-profile', title: 'Prepare sua vitrine', instruction: 'Salve sua apresentação profissional no perfil de fornecedor.', route: null, achievement: 'Vitrine preparada', criterion: 'Apresentação salva no seu próprio perfil de fornecedor.' },
  { id: 'assigned-timeline', title: 'Consulte seu cronograma', instruction: 'Confira os horários e responsabilidades no evento em que você está escalado.', route: 'timeline', eventScoped: true, orientation: true },
  { id: 'assigned-reception', title: 'Trabalhe na portaria', instruction: 'Prepare a recepção e registre chegadas somente quando ocorrerem.', route: 'reception', eventScoped: true, orientation: true },
];

export function visibleMissions(snapshot: AdoptionSnapshot): Mission[] {
  return MISSIONS.filter(mission => snapshot.allowed.includes(mission.id));
}

export function missionStatus(mission: Mission, snapshot: AdoptionSnapshot): string {
  if (snapshot.facts[mission.id]) return 'Concluída';
  if (mission.eventScoped && !snapshot.event_id) return 'Escolha um evento';
  const progress = snapshot.progress.find(row => row.journey_id === mission.id);
  if (mission.orientation) return progress?.status === 'presented' ? 'Orientação vista' : progress?.status === 'paused' ? 'Orientação pausada' : progress?.status === 'active' ? 'Em andamento' : 'Orientação disponível';
  if (progress?.status === 'dismissed') return 'Ignorada';
  return progress ? 'Em andamento' : 'Disponível';
}

export function earnedAchievement(mission: Mission, snapshot: AdoptionSnapshot) {
  const scope = mission.id === 'ai' || mission.id === 'vendor-profile' ? 'individual' : mission.eventScoped ? 'event' : 'agency';
  return snapshot.achievements.find(row => row.mission_id === mission.id
    && (!row.scope || row.scope === scope)
    && (scope !== 'individual' || row.scope === 'individual')
    && (!mission.eventScoped || Boolean(snapshot.event_id) && (!row.context_key || row.context_key === snapshot.event_id)));
}
