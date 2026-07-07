export const ROUTES = {
  landing: '/',
  login: '/login',
  signup: '/cadastro',
  onboarding: '/onboarding',
  checkout: '/checkout',
  authCallback: '/auth/callback',
  expiredSubscription: '/assinatura-expirada',
  legacyAi: '/atendimento-ia',
  vendorPublic: '/torre/:token',
  couplePublic: '/noivos/:token',
  invitePublic: '/convite/:token',
  signaturePublic: '/assinatura/:token',
  portfolioPublic: '/portfolio/:token',
  privacyPolicy: '/politica-de-privacidade',
  dashboard: '/dashboard',
  dashboardEvents: '/dashboard/eventos',
  dashboardEventDetails: '/dashboard/eventos/:id',
  dashboardEventCommandCenter: '/dashboard/eventos/:id/torre',
  dashboardProfile: '/dashboard/perfil',
  dashboardBilling: '/dashboard/assinaturas',
  dashboardHealth: '/dashboard/saude',
  dashboardReports: '/dashboard/relatorios',
  dashboardClients: '/dashboard/clientes',
  dashboardFinance: '/dashboard/financeiro',
  dashboardSettings: '/dashboard/configuracoes',
  adminDashboard: '/dashboard/admin',
  helpCenter: '/help-center',
  adminUsers: '/dashboard/admin/users',
  adminUserDetails: '/dashboard/admin/users/:userId',
  adminTelemetry: '/dashboard/admin/telemetry',
  adminSettings: '/dashboard/admin/settings',
  adminTickets: '/dashboard/admin/tickets',
} as const;

export function buildAppLoginUrl(
  nextPath: string,
  baseUrl = 'https://app.painelprime.com.br/login'
) {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  const url = new URL(baseUrl);
  url.searchParams.set('next', next);
  return url.toString();
}
