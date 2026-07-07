import { ROUTES } from './routes';
import type { BillingCycle } from './billingPlans';

type RouteParams = Record<string, string | number>;
type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;
type BillingPaymentMethod = 'card' | 'pix';

function interpolateRoute(
  template: string,
  params: RouteParams = {}
) {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params[key];

    if (value === undefined || value === null) {
      throw new Error(`Missing route param "${key}" for template "${template}"`);
    }

    return encodeURIComponent(String(value));
  });
}

function withQuery(path: string, query?: QueryParams) {
  if (!query) {
    return path;
  }
  const entries: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }

  return entries.length > 0 ? `${path}?${entries.join('&')}` : path;
}

export const routeHrefs = {
  landing: () => ROUTES.landing,
  login: (nextPath?: string) =>
    withQuery(ROUTES.login, nextPath ? { next: nextPath } : undefined),
  signup: (plan?: string) =>
    withQuery(ROUTES.signup, plan ? { plano: plan } : undefined),
  onboarding: (plan?: string, payment?: BillingPaymentMethod, cycle?: BillingCycle) =>
    withQuery(ROUTES.onboarding, plan ? { plan, payment, cycle } : undefined),
  checkout: (plan?: string, payment?: BillingPaymentMethod, cycle?: BillingCycle) =>
    withQuery(ROUTES.checkout, plan ? { plan, payment, cycle } : undefined),
  authCallback: (nextPath?: string) =>
    withQuery(ROUTES.authCallback, nextPath ? { next: nextPath } : undefined),
  expiredSubscription: () => ROUTES.expiredSubscription,
  privacyPolicy: () => ROUTES.privacyPolicy,
  legacyAi: () => ROUTES.legacyAi,
  vendorPublic: (token: string) =>
    interpolateRoute(ROUTES.vendorPublic, { token }),
  couplePublic: (token: string) =>
    interpolateRoute(ROUTES.couplePublic, { token }),
  invitePublic: (token: string) =>
    interpolateRoute(ROUTES.invitePublic, { token }),
  signaturePublic: (token: string) =>
    interpolateRoute(ROUTES.signaturePublic, { token }),
  portfolioPublic: (token: string) =>
    interpolateRoute(ROUTES.portfolioPublic, { token }),
  dashboard: () => ROUTES.dashboard,
  dashboardEvents: () => ROUTES.dashboardEvents,
  dashboardEventDetails: (
    id: string,
    query?: QueryParams
  ) => withQuery(interpolateRoute(ROUTES.dashboardEventDetails, { id }), query),
  dashboardEventCommandCenter: (id: string) =>
    interpolateRoute(ROUTES.dashboardEventCommandCenter, { id }),
  dashboardClients: () => ROUTES.dashboardClients,
  dashboardFinance: () => ROUTES.dashboardFinance,
  dashboardProfile: () => ROUTES.dashboardProfile,
  dashboardBilling: () => ROUTES.dashboardBilling,
  dashboardHealth: () => ROUTES.dashboardHealth,
  dashboardReports: () => ROUTES.dashboardReports,
  dashboardSettings: () => ROUTES.dashboardSettings,
} as const;
