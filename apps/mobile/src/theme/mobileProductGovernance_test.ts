const sourceRoot = new URL('../', import.meta.url);

const read = (path: string) => Deno.readTextFile(new URL(path, sourceRoot));

Deno.test('keeps assessor account navigation focused on useful actions', async () => {
  const more = await read('screens/MoreScreen.tsx');

  for (const forbidden of [
    "label: 'Planejamento'",
    "from('user_finance_entries')",
    'Exportar resumo',
    'Limpar antigos',
    'Tarefas concluídas',
  ]) {
    if (more.includes(forbidden)) {
      throw new Error(`assessor More screen still exposes internal tooling: ${forbidden}`);
    }
  }
});

Deno.test('removes the authenticated command center without touching the public portal', async () => {
  const modules = await read('navigation/eventRouteTypes.ts');
  const details = await read('screens/EventDetailsScreen.tsx');
  const publicRoute = await read('../app/(public)/torre/[token].tsx');

  if (modules.includes("key: 'command'")) {
    throw new Error('authenticated event picker still exposes command center');
  }
  if (details.includes('>Torre de Comando</Text>')) {
    throw new Error('event header still exposes command center CTA');
  }
  if (!publicRoute.includes('PublicVendorCommandCenterScreen')) {
    throw new Error('public vendor command route must remain available');
  }
});

Deno.test('does not expose test checkout plans to regular assessors', async () => {
  const profile = await read('screens/ProfileScreen.tsx');

  if (!profile.includes('isSuperAdmin')) {
    throw new Error('billing test controls are not protected by the super-admin role');
  }
  if (!profile.includes('TEST_BILLING_OPTIONS')) {
    throw new Error('billing test controls are not isolated from customer plans');
  }
});

Deno.test('removes settings that have no runtime consumers', async () => {
  const settings = await read('screens/SettingsScreen.tsx');

  for (const forbidden of [
    'planejar_pro_app_settings_v1',
    'autoRefresh',
    'compactMode',
    "notifications: boolean",
  ]) {
    if (settings.includes(forbidden)) {
      throw new Error(`placebo setting is still present: ${forbidden}`);
    }
  }
});

Deno.test('landing copy does not advertise a removed authenticated dashboard', async () => {
  const landing = await read('screens/LandingScreen.tsx');
  const signup = await read('screens/SignupScreen.tsx');
  const assistant = await read('components/PlanAssistantFloating.tsx');
  const walkthrough = await read('components/ModuleWalkthroughOverlay.tsx');

  for (const [name, source] of [
    ['landing', landing],
    ['signup', signup],
    ['assistant', assistant],
    ['walkthrough', walkthrough],
  ] as const) {
    if (source.toLocaleLowerCase('pt-BR').includes('torre de comando')) {
      throw new Error(`${name} still advertises Torre de Comando`);
    }
  }

  if (assistant.includes("router.push('/mais/planejamento')")) {
    throw new Error('Plan assistant still routes to removed planning dashboard');
  }
  if (walkthrough.includes("moduleLabel: 'Planejamento'")) {
    throw new Error('walkthrough still advertises removed planning dashboard');
  }
});
