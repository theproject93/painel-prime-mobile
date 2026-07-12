const sourceRoot = new URL('../', import.meta.url);

const read = (path: string) => Deno.readTextFile(new URL(path, sourceRoot));

Deno.test('uses the approved warm Premium palette only in the mobile theme', async () => {
  const colors = await read('theme/colors.ts');

  for (const token of [
    "background: '#F4F1EA'",
    "surface: '#FAF7F1'",
    "surfaceSubtle: '#EEE9DF'",
    "card: '#FFFDF8'",
    "border: '#DED7CA'",
    "text: '#17181D'",
    "textSecondary: '#555C6B'",
    "mutedText: '#7D8492'",
  ]) {
    if (!colors.includes(token)) throw new Error(`missing Premium token: ${token}`);
  }
});

Deno.test('keeps operational telemetry out of the assessor tools menu', async () => {
  const more = await read('screens/MoreScreen.tsx');
  const tools = more.slice(
    more.indexOf('const ACCOUNT_ITEMS'),
    more.indexOf('const ADMIN_ITEMS')
  );
  const admin = more.slice(
    more.indexOf('const ADMIN_ITEMS'),
    more.indexOf('export function MoreScreen')
  );
  const walkthrough = await read('components/ModuleWalkthroughOverlay.tsx');

  if (tools.toLowerCase().includes('saúde operacional')) {
    throw new Error('technical telemetry is still visible to assessors');
  }
  if (!admin.toLowerCase().includes('saúde operacional')) {
    throw new Error('technical telemetry should remain available to super admins');
  }
  if (walkthrough.includes('Acesse Perfil, Planejamento, Saúde Operacional e Configurações.')) {
    throw new Error('walkthrough still advertises a hidden technical screen');
  }
});

Deno.test('does not log deterministic Plan IA answers as fallback failures', async () => {
  const assistant = await read('components/PlanAssistantFloating.tsx');

  if (!assistant.includes("response_mode?: 'ai' | 'deterministic' | 'fallback'")) {
    throw new Error('Plan IA response mode is not typed');
  }
  if (!assistant.includes("data.meta.response_mode !== 'deterministic'")) {
    throw new Error('deterministic answers are still treated as fallback failures');
  }
});
