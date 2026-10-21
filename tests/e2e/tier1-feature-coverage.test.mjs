import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ROOT_DIR, MOBILE_DIR, DOCS_MOBILE_DIR, TestRunner, hasUtf8Bom, getFilesRecursively } from './common.mjs';

export function registerTier1Tests(runner) {
  // Feature F1: Route Parity Mapping
  runner.register('F1: Route Parity Matrix Document Presence & Completeness', async () => {
    const parityDocPath = [
      path.join(ROOT_DIR, 'PARITY_MATRIX.md'),
      path.join(DOCS_MOBILE_DIR, 'PARITY_MATRIX.md'),
      path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_1/route_analysis.json'),
    ].find((p) => fs.existsSync(p));

    assert.ok(parityDocPath, 'PARITY_MATRIX.md must exist in root or docs/mobile/');
    const content = fs.readFileSync(parityDocPath, 'utf8');

    // Check essential section headers and route counts
    assert.match(content, /(88\s*rotas|88\s*páginas|88\s*rotas\s*web)/i, 'Must reference all 88 Web routes');
    assert.match(content, /(27\s*rotas|27\s*telas|27\s*rotas\s*mobile)/i, 'Must reference the 27 Mobile routes');
    assert.match(content, /(padrinhos|corte de honra)/i, 'Must document Padrinhos parity gap');
    assert.match(content, /(rsvp|review_queue)/i, 'Must document RSVP Inbox parity gap');
    assert.match(content, /(reuniões|meeting)/i, 'Must document MeetingCenter parity gap');
    assert.match(content, /(mesas|table-map)/i, 'Must document Table Map parity gap');
    assert.match(content, /(billing|infinitepay|superbilling)/i, 'Must document SuperBilling parity gap');
  }, { featureId: 'F1', milestone: 'M1' });

  // Feature F2: Spec: Padrinhos com Plan IA
  runner.register('F2: Tech Spec — Padrinhos & Corte de Honra with Plan IA', async () => {
    const specPath = [
      path.join(ROOT_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(DOCS_MOBILE_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md'),
    ].find((p) => fs.existsSync(p));

    assert.ok(specPath, 'ANDROID_TECH_SPECS.md must exist in root, docs/mobile/ or survey handoff');
    const content = fs.readFileSync(specPath, 'utf8');

    assert.match(content, /event_padrinhos/i, 'Must specify event_padrinhos table schema');
    assert.match(content, /whatsapp-padrinhos-dispatch/i, 'Must specify whatsapp-padrinhos-dispatch Edge Function');
    assert.match(content, /manual/i, 'Must cover manual dispatch action');
    assert.match(content, /concentration/i, 'Must cover concentration dispatch action');
    assert.match(content, /attire/i, 'Must cover attire dispatch action');
    assert.match(content, /(padrinho|madrinha|corte de honra)/i, 'Must cover role distinctions');
  }, { featureId: 'F2', milestone: 'M1' });

  // Feature F3: Spec: WhatsApp RSVP Native Inbox
  runner.register('F3: Tech Spec — WhatsApp RSVP Native Inbox & QR Resend', async () => {
    const specPath = [
      path.join(ROOT_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(DOCS_MOBILE_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md'),
    ].find((p) => fs.existsSync(p));

    assert.ok(specPath, 'ANDROID_TECH_SPECS.md must exist');
    const content = fs.readFileSync(specPath, 'utf8');

    assert.match(content, /get_whatsapp_rsvp_review_queue/i, 'Must specify get_whatsapp_rsvp_review_queue RPC');
    assert.match(content, /whatsapp-rsvp-review-action/i, 'Must specify whatsapp-rsvp-review-action Edge Function');
    assert.match(content, /resend_qr/i, 'Must specify resend_qr action');
    assert.match(content, /(janela|24h|window)/i, 'Must specify 24h conversation window badge');
  }, { featureId: 'F3', milestone: 'M1' });

  // Feature F4: Spec: MeetingCenter & Atas
  runner.register('F4: Tech Spec — MeetingCenter Daily.co & Executive Minutes', async () => {
    const specPath = [
      path.join(ROOT_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(DOCS_MOBILE_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md'),
    ].find((p) => fs.existsSync(p));

    assert.ok(specPath, 'ANDROID_TECH_SPECS.md must exist');
    const content = fs.readFileSync(specPath, 'utf8');

    assert.match(content, /(daily\.co|meeting-management)/i, 'Must specify Daily.co integration contract');
    assert.match(content, /(meeting_minutes|ata executiva|ata)/i, 'Must specify executive minutes schema/viewer');
    assert.match(content, /(whatsapp|compartilhar)/i, 'Must specify WhatsApp minutes sharing feature');
  }, { featureId: 'F4', milestone: 'M1' });

  // Feature F5: Spec: Mapa de Mesas Drag-and-Drop
  runner.register('F5: Tech Spec — Table Map Drag-and-Drop & Guest Allocation', async () => {
    const specPath = [
      path.join(ROOT_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(DOCS_MOBILE_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md'),
    ].find((p) => fs.existsSync(p));

    assert.ok(specPath, 'ANDROID_TECH_SPECS.md must exist');
    const content = fs.readFileSync(specPath, 'utf8');

    assert.match(content, /(TableMapSurface|useMapDrag|panresponder)/i, 'Must specify surface drag mechanics');
    assert.match(content, /(drawer|gaveta|guestdrawer)/i, 'Must specify unallocated guest allocation drawer');
    assert.match(content, /(church|party|igreja|festa)/i, 'Must specify church and party space partitioning');
  }, { featureId: 'F5', milestone: 'M1' });

  // Feature F6: Spec: SuperBilling & InfinitePay
  runner.register('F6: Tech Spec — SuperBilling Plans & InfinitePay Integration', async () => {
    const specPath = [
      path.join(ROOT_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(DOCS_MOBILE_DIR, 'ANDROID_TECH_SPECS.md'),
      path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md'),
    ].find((p) => fs.existsSync(p));

    assert.ok(specPath, 'ANDROID_TECH_SPECS.md must exist');
    const content = fs.readFileSync(specPath, 'utf8');

    assert.match(content, /(essencial|profissional|elite|equilíbrio prime)/i, 'Must document standard subscription plans');
    assert.match(content, /(infinitepay|billing-create-checkout)/i, 'Must specify InfinitePay gateway integration');
    assert.match(content, /(whatsapp|disparos|créditos)/i, 'Must specify WhatsApp messaging credit packages');
  }, { featureId: 'F6', milestone: 'M1' });

  // Feature F7: TypeScript TS5097 Fix in apps/mobile/tsconfig.json
  runner.register('F7: TypeScript TS5097 Compiler Options Configuration', async () => {
    const tsconfigPath = path.join(MOBILE_DIR, 'tsconfig.json');
    assert.ok(fs.existsSync(tsconfigPath), 'apps/mobile/tsconfig.json must exist');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

    assert.equal(tsconfig.compilerOptions?.moduleResolution?.toLowerCase(), 'bundler',
      'compilerOptions.moduleResolution must be "bundler"');
    assert.equal(tsconfig.compilerOptions?.allowImportingTsExtensions, true,
      'compilerOptions.allowImportingTsExtensions must be true');
    assert.equal(tsconfig.compilerOptions?.strict, true,
      'compilerOptions.strict must remain true');
  }, { featureId: 'F7', milestone: 'M2' });

  // Feature F8: Strip UTF-8 BOM in Target Files
  runner.register('F8: Absence of UTF-8 BOM in Flagged Files', async () => {
    const targetFiles = [
      path.join(MOBILE_DIR, 'app/(app)/(tabs)/clientes/index.tsx'),
      path.join(MOBILE_DIR, 'app/(app)/(tabs)/clientes/_layout.tsx'),
      path.join(MOBILE_DIR, 'app/(app)/(tabs)/fornecedores.tsx'),
      path.join(MOBILE_DIR, 'src/theme/fonts.ts'),
    ];

    for (const file of targetFiles) {
      if (fs.existsSync(file)) {
        assert.equal(hasUtf8Bom(file), false, `File ${path.relative(ROOT_DIR, file)} must NOT contain UTF-8 BOM`);
      }
    }
  }, { featureId: 'F8', milestone: 'M2' });

  // Feature F9: Sentry Allowlist Hygiene in pnpm-workspace.yaml & root package.json
  runner.register('F9: Sentry CLI in onlyBuiltDependencies Allowlist', async () => {
    const workspaceYamlPath = path.join(ROOT_DIR, 'pnpm-workspace.yaml');
    assert.ok(fs.existsSync(workspaceYamlPath), 'pnpm-workspace.yaml must exist');
    const yamlContent = fs.readFileSync(workspaceYamlPath, 'utf8');

    // Verify @sentry/cli is in onlyBuiltDependencies block
    const onlyBuiltBlock = yamlContent.split('onlyBuiltDependencies:')[1]?.split('\n\n')[0] || '';
    assert.match(onlyBuiltBlock, /@sentry\/cli/, 'pnpm-workspace.yaml must declare @sentry/cli under onlyBuiltDependencies');

    const rootPkgPath = path.join(ROOT_DIR, 'package.json');
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const pnpmOnlyBuilt = rootPkg.pnpm?.onlyBuiltDependencies || [];
    assert.ok(pnpmOnlyBuilt.includes('@sentry/cli'), 'root package.json pnpm.onlyBuiltDependencies must include @sentry/cli');
  }, { featureId: 'F9', milestone: 'M2' });

  // Feature F10: RedBox Protection / Landing Route Presence
  runner.register('F10: RedBox Protection — Landing Route Screen Presence', async () => {
    const landingPath = path.join(MOBILE_DIR, 'app/(public)/landing.tsx');
    assert.ok(fs.existsSync(landingPath), 'apps/mobile/app/(public)/landing.tsx must exist to prevent Unmatched Route /landing crash');
    const content = fs.readFileSync(landingPath, 'utf8');
    assert.match(content, /export\s+default/, 'landing.tsx must export a default component');
  }, { featureId: 'F10', milestone: 'M2' });

  // Feature F11: Mobile Validation Script
  runner.register('F11: Mobile Package Script "validate" Definition', async () => {
    const mobilePkgPath = path.join(MOBILE_DIR, 'package.json');
    assert.ok(fs.existsSync(mobilePkgPath), 'apps/mobile/package.json must exist');
    const mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8'));

    assert.ok(mobilePkg.scripts?.validate, 'apps/mobile/package.json must contain "validate" script');
    assert.match(mobilePkg.scripts.validate, /tsc\s+--noEmit/, 'validate script must execute tsc --noEmit');
    assert.match(mobilePkg.scripts.validate, /expo\s+config\s+--type\s+introspect/, 'validate script must introspect expo config');
  }, { featureId: 'F11', milestone: 'M2' });

  // Feature F12: Anti-Mojibake Verification
  runner.register('F12: Zero Mojibake Occurrences in Mobile Codebase', async () => {
    const mojibakeRegex = /[\u00C3][\u0080-\u00BF]|[\u00C2][\u0080-\u00BF]|[\u251C\u2524\u252C\uFFFD]|\u0000/;
    const files = [
      ...getFilesRecursively(path.join(MOBILE_DIR, 'app'), ['.ts', '.tsx', '.json']),
      ...getFilesRecursively(path.join(MOBILE_DIR, 'src'), ['.ts', '.tsx', '.json']),
    ];

    assert.ok(files.length > 50, 'Must inspect mobile source files');
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (mojibakeRegex.test(content)) {
        violations.push(path.relative(ROOT_DIR, file));
      }
    }

    assert.equal(violations.length, 0, `Detected mojibake corrupted characters in: ${violations.join(', ')}`);
  }, { featureId: 'F12', milestone: 'M2' });

  // Feature F13: API Key Isolation & Security Audit
  runner.register('F13: API Key Isolation — Strict EXPO_PUBLIC_ Prefix Enforcement', async () => {
    const files = [
      ...getFilesRecursively(path.join(MOBILE_DIR, 'app'), ['.ts', '.tsx']),
      ...getFilesRecursively(path.join(MOBILE_DIR, 'src'), ['.ts', '.tsx']),
    ];

    const envRegex = /process\.env\.([A-Za-z0-9_]+)/g;
    const nonPublicVars = new Set();
    const allowedSystemVars = new Set(['NODE_ENV', 'EXPO_ROUTER_APP_ROOT']);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = envRegex.exec(content)) !== null) {
        const varName = match[1];
        if (!varName.startsWith('EXPO_PUBLIC_') && !allowedSystemVars.has(varName)) {
          nonPublicVars.add(`${varName} in ${path.relative(ROOT_DIR, file)}`);
        }
      }
    }

    assert.equal(nonPublicVars.size, 0, `Forbidden non-public environment variables found: ${[...nonPublicVars].join(', ')}`);
  }, { featureId: 'F13', milestone: 'M3' });

  // Feature F14: CI/CD Sanity & APK Signing Pipeline Structure
  runner.register('F14: CI/CD Workflow Sanity & Keystore Signing Specification', async () => {
    const aiRulesPath = path.join(ROOT_DIR, 'AI_RULES.md');
    assert.ok(fs.existsSync(aiRulesPath), 'AI_RULES.md must exist');
    const aiRules = fs.readFileSync(aiRulesPath, 'utf8');

    // Invariants per AI_RULES.md §4:
    assert.match(aiRules, /preview-build\.yml/, 'Must document preview-build.yml pipeline');
    assert.match(aiRules, /painel-prime-mobile/, 'Must specify dedicated mobile repository');
    assert.match(aiRules, /android-v\*/, 'Must document tag-based release gating');

    // Check release fingerprint documented in survey 3 or docs/mobile/PARITY_MATRIX.md
    const survey3Path = path.join(ROOT_DIR, '.agents/teamwork/teamwork_preview_explorer_survey_3/handoff.md');
    const parityPath = path.join(DOCS_MOBILE_DIR, 'PARITY_MATRIX.md');
    const sourceContent = (fs.existsSync(survey3Path) ? fs.readFileSync(survey3Path, 'utf8') : '') +
      (fs.existsSync(parityPath) ? fs.readFileSync(parityPath, 'utf8') : '');

    assert.match(sourceContent, /bf524e07f7cb2457aa8cd183aa38b8454f2addd6a6e229ecf858778965bec82b/,
      'Must document official certificate SHA256 fingerprint');
  }, { featureId: 'F14', milestone: 'M4' });

  // Feature F15: Android Device Streaming Validation & Identity
  runner.register('F15: Android Device Streaming & Identity Configuration in app.json', async () => {
    const appJsonPath = path.join(MOBILE_DIR, 'app.json');
    assert.ok(fs.existsSync(appJsonPath), 'apps/mobile/app.json must exist');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo;

    assert.equal(appJson.name, 'Painel Prime', 'App name must be "Painel Prime"');
    assert.equal(appJson.scheme, 'painelprime', 'Deep link scheme must be "painelprime"');
    assert.equal(appJson.android?.package, 'br.com.painelprime.app', 'Android package must be "br.com.painelprime.app"');
    assert.equal(appJson.ios?.bundleIdentifier, 'br.com.painelprime.app', 'iOS bundle must be "br.com.painelprime.app"');
    assert.equal(appJson.newArchEnabled, true, 'Fabric newArchEnabled must be true');

    const appJsonRaw = fs.readFileSync(appJsonPath, 'utf8');
    assert.doesNotMatch(appJsonRaw, /planejarpro/i, 'Forbidden legacy brand "planejarpro" found in app.json');
  }, { featureId: 'F15', milestone: 'M4' });
  // Feature F16: Implementation — Padrinhos & Corte de Honra
  runner.register('F16: Implementation — Padrinhos & Corte de Honra Module', async () => {
    // 1. Route presence and exports
    const routeFile = path.join(MOBILE_DIR, 'app/(app)/eventos/[id]/padrinhos.tsx');
    assert.ok(fs.existsSync(routeFile), 'padrinhos.tsx route must exist');
    const routeContent = fs.readFileSync(routeFile, 'utf8');
    assert.match(routeContent, /export\s+default\s+function\s+EventPadrinhosRoute/, 'Must export EventPadrinhosRoute');
    assert.match(routeContent, /PadrinhosTab/, 'Must render PadrinhosTab');
    assert.match(routeContent, /getEventPersonaCopy/, 'Must use getEventPersonaCopy for persona-aware title');
    assert.match(routeContent, /Corte de Honra/, 'Must handle debutante title');

    // 2. Models and pairing logic
    const modelFile = path.join(MOBILE_DIR, 'src/features/padrinhos/padrinhosModel.ts');
    assert.ok(fs.existsSync(modelFile), 'padrinhosModel.ts must exist');
    const modelContent = fs.readFileSync(modelFile, 'utf8');
    assert.match(modelContent, /export\s+type\s+PadrinhoRole/, 'Must define PadrinhoRole');
    assert.match(modelContent, /export\s+type\s+PadrinhoSide/, 'Must define PadrinhoSide');
    assert.match(modelContent, /export\s+type\s+AttireStatus/, 'Must define AttireStatus');
    assert.match(modelContent, /export\s+function\s+buildPadrinhoPairs/, 'Must export buildPadrinhoPairs');
    assert.match(modelContent, /export\s+function\s+roleLabel/, 'Must export roleLabel');
    assert.match(modelContent, /export\s+function\s+sideLabel/, 'Must export sideLabel');
    assert.match(modelContent, /export\s+function\s+attireStatusLabel/, 'Must export attireStatusLabel');

    // 3. Service layer and Edge Function invocation
    const serviceFile = path.join(MOBILE_DIR, 'src/features/padrinhos/padrinhosService.ts');
    assert.ok(fs.existsSync(serviceFile), 'padrinhosService.ts must exist');
    const serviceContent = fs.readFileSync(serviceFile, 'utf8');
    assert.match(serviceContent, /from\('event_padrinhos'\)/, 'Must query event_padrinhos table');
    assert.match(serviceContent, /whatsapp-padrinhos-dispatch/, 'Must invoke whatsapp-padrinhos-dispatch Edge Function');
    assert.match(serviceContent, /InsufficientCreditsError/, 'Must handle InsufficientCreditsError');
    assert.match(serviceContent, /organization_whatsapp_wallets/, 'Must query organization_whatsapp_wallets');
    assert.match(serviceContent, /subscribeToPadrinhos/, 'Must export realtime subscription');

    // 4. Feature UI components
    const componentFiles = [
      'PadrinhosTab.tsx',
      'PadrinhoPairCard.tsx',
      'PadrinhosPlanIaModal.tsx',
      'PadrinhosStatsCards.tsx',
      'PadrinhoFormModal.tsx',
    ];
    for (const comp of componentFiles) {
      const compPath = path.join(MOBILE_DIR, 'src/features/padrinhos', comp);
      assert.ok(fs.existsSync(compPath), `${comp} must exist`);
      const compContent = fs.readFileSync(compPath, 'utf8');
      assert.doesNotMatch(compContent, /expo-linear-gradient/, `${comp} must not use expo-linear-gradient`);
    }
  }, { featureId: 'F16', milestone: 'M3' });

  // Feature F17: Implementation — WhatsApp RSVP Native Inbox
  runner.register('F17: Implementation — WhatsApp RSVP Native Inbox Module', async () => {
    // 1. Route presence and exports
    const routeFile = path.join(MOBILE_DIR, 'app/(app)/eventos/[id]/rsvp-inbox.tsx');
    assert.ok(fs.existsSync(routeFile), 'rsvp-inbox.tsx route must exist');
    const routeContent = fs.readFileSync(routeFile, 'utf8');
    assert.match(routeContent, /export\s+default\s+function\s+EventRsvpInboxRoute/, 'Must export EventRsvpInboxRoute');
    assert.match(routeContent, /RsvpInboxScreen/, 'Must render RsvpInboxScreen');

    // 2. Models and 24h window calculation
    const modelFile = path.join(MOBILE_DIR, 'src/features/rsvp-inbox/rsvpInboxModel.ts');
    assert.ok(fs.existsSync(modelFile), 'rsvpInboxModel.ts must exist');
    const modelContent = fs.readFileSync(modelFile, 'utf8');
    assert.match(modelContent, /export\s+function\s+isWithin24hWindow/, 'Must export isWithin24hWindow');
    assert.match(modelContent, /export\s+function\s+format24hRemaining/, 'Must export format24hRemaining');
    assert.match(modelContent, /export\s+function\s+threadStateLabel/, 'Must export threadStateLabel');
    assert.match(modelContent, /export\s+function\s+flowStateLabel/, 'Must export flowStateLabel');
    assert.match(modelContent, /export\s+function\s+summarizeReviewThreads/, 'Must export summarizeReviewThreads');
    assert.match(modelContent, /export\s+function\s+extractSuggestedMembers/, 'Must export extractSuggestedMembers');
    assert.match(modelContent, /export\s+function\s+buildDefaultReviewSelections/, 'Must export buildDefaultReviewSelections');

    // 3. Service layer and RPC / Edge Function invocation
    const serviceFile = path.join(MOBILE_DIR, 'src/features/rsvp-inbox/rsvpInboxService.ts');
    assert.ok(fs.existsSync(serviceFile), 'rsvpInboxService.ts must exist');
    const serviceContent = fs.readFileSync(serviceFile, 'utf8');
    assert.match(serviceContent, /get_whatsapp_rsvp_review_queue/, 'Must call get_whatsapp_rsvp_review_queue RPC');
    assert.match(serviceContent, /whatsapp-rsvp-review-action/, 'Must invoke whatsapp-rsvp-review-action Edge Function');
    assert.match(serviceContent, /resend_qr/, 'Must support resend_qr action');
    assert.match(serviceContent, /subscribeToRsvpInbox/, 'Must export realtime subscription for threads and messages');

    // 4. Feature UI components
    const componentFiles = [
      'RsvpInboxScreen.tsx',
      'RsvpThreadList.tsx',
      'RsvpChatView.tsx',
      'RsvpMessageBubble.tsx',
      'RsvpFamilyGroupBar.tsx',
    ];
    for (const comp of componentFiles) {
      const compPath = path.join(MOBILE_DIR, 'src/features/rsvp-inbox', comp);
      assert.ok(fs.existsSync(compPath), `${comp} must exist`);
    }
  }, { featureId: 'F17', milestone: 'M3' });

  // Feature F18: Implementation — MeetingCenter & Daily.co Video
  runner.register('F18: Implementation — MeetingCenter & Daily.co Module', async () => {
    // 1. Route files
    const indexRoute = path.join(MOBILE_DIR, 'app/(app)/reunioes/index.tsx');
    const detailRoute = path.join(MOBILE_DIR, 'app/(app)/reunioes/[id].tsx');
    assert.ok(fs.existsSync(indexRoute), 'app/(app)/reunioes/index.tsx must exist');
    assert.ok(fs.existsSync(detailRoute), 'app/(app)/reunioes/[id].tsx must exist');

    const indexContent = fs.readFileSync(indexRoute, 'utf8');
    const detailContent = fs.readFileSync(detailRoute, 'utf8');
    assert.match(indexContent, /export\s+default\s+function\s+GlobalMeetingsIndexRoute/, 'index.tsx must export GlobalMeetingsIndexRoute');
    assert.match(detailContent, /export\s+default\s+function\s+MeetingDetailRoute/, '[id].tsx must export MeetingDetailRoute');

    // 2. Models and parsing
    const modelFile = path.join(MOBILE_DIR, 'src/features/meetings/meetingModel.ts');
    const utilsFile = path.join(MOBILE_DIR, 'src/features/meetings/meetingUtils.ts');
    const parserFile = path.join(MOBILE_DIR, 'src/features/meetings/ataMarkdownParser.ts');

    assert.ok(fs.existsSync(modelFile), 'meetingModel.ts must exist');
    assert.ok(fs.existsSync(utilsFile), 'meetingUtils.ts must exist');
    assert.ok(fs.existsSync(parserFile), 'ataMarkdownParser.ts must exist');

    const utilsContent = fs.readFileSync(utilsFile, 'utf8');
    assert.match(utilsContent, /groupMeetings/, 'Must export groupMeetings');
    assert.match(utilsContent, /parseBrazilianDateTime/, 'Must export parseBrazilianDateTime');
    assert.match(utilsContent, /shouldOfferAtaRetry/, 'Must export shouldOfferAtaRetry');

    // 3. Service layer and Edge Function
    const serviceFile = path.join(MOBILE_DIR, 'src/features/meetings/meetingService.ts');
    assert.ok(fs.existsSync(serviceFile), 'meetingService.ts must exist');
    const serviceContent = fs.readFileSync(serviceFile, 'utf8');
    assert.match(serviceContent, /meeting-management/, 'Must invoke meeting-management Edge Function');
    assert.match(serviceContent, /fetchMeetingById/, 'Must export fetchMeetingById');
    assert.match(serviceContent, /subscribeToGlobalMeetings/, 'Must export subscribeToGlobalMeetings');

    // 4. MeetingCenter and Ata components
    const centerFile = path.join(MOBILE_DIR, 'src/features/meetings/MeetingCenter.tsx');
    const ataModalFile = path.join(MOBILE_DIR, 'src/features/meetings/AtaDocumentModal.tsx');
    assert.ok(fs.existsSync(centerFile), 'MeetingCenter.tsx must exist');
    assert.ok(fs.existsSync(ataModalFile), 'AtaDocumentModal.tsx must exist');
  }, { featureId: 'F18', milestone: 'M3' });

  // Feature F19: Implementation — Mapa de Mesas Touch
  runner.register('F19: Implementation — Mapa de Mesas Touch & Gestures Module', async () => {
    // 1. Route file
    const routeFile = path.join(MOBILE_DIR, 'app/(app)/eventos/[id]/mesas.tsx');
    assert.ok(fs.existsSync(routeFile), 'mesas.tsx route must exist');
    const routeContent = fs.readFileSync(routeFile, 'utf8');
    assert.match(routeContent, /export\s+default\s+function\s+EventMesasTouchRoute/, 'Must export EventMesasTouchRoute');
    assert.match(routeContent, /TableGuestDrawer/, 'Must integrate TableGuestDrawer');
    assert.match(routeContent, /TableMapSurface/, 'Must integrate TableMapSurface');
    assert.match(routeContent, /useMapDrag/, 'Must use useMapDrag hook');

    // 2. Core math, occupancy, and helpers
    const coreFile = path.join(MOBILE_DIR, 'src/features/table-map/core.ts');
    assert.ok(fs.existsSync(coreFile), 'core.ts must exist');
    const coreContent = fs.readFileSync(coreFile, 'utf8');
    assert.match(coreContent, /export\s+function\s+clamp/, 'Must export clamp');
    assert.match(coreContent, /export\s+function\s+snap/, 'Must export snap');
    assert.match(coreContent, /export\s+function\s+buildOccupancy/, 'Must export buildOccupancy');
    assert.match(coreContent, /export\s+function\s+buildMapLines/, 'Must export buildMapLines');
    assert.match(coreContent, /export\s+function\s+getFixtureSpace/, 'Must support church and party space partitioning');

    // 3. Drawer and touch components
    const drawerFile = path.join(MOBILE_DIR, 'src/features/table-map/TableGuestDrawer.tsx');
    assert.ok(fs.existsSync(drawerFile), 'TableGuestDrawer.tsx must exist');
    const drawerContent = fs.readFileSync(drawerFile, 'utf8');
    assert.match(drawerContent, /export\s+function\s+TableGuestDrawer/, 'Must export TableGuestDrawer component');
    assert.match(drawerContent, /family_group_id/, 'Must handle family group allocation');

    // 4. Drag gesture controller
    const dragFile = path.join(MOBILE_DIR, 'src/features/table-map/useMapDrag.ts');
    assert.ok(fs.existsSync(dragFile), 'useMapDrag.ts must exist');
    const dragContent = fs.readFileSync(dragFile, 'utf8');
    assert.match(dragContent, /PanResponder/, 'Must implement PanResponder touch mechanics');
    assert.match(dragContent, /requestAnimationFrame/, 'Must use requestAnimationFrame for 60fps dragging');

    // 5. PDF Export
    const pdfExportFile = path.join(MOBILE_DIR, 'src/features/table-map/mapPdfExport.ts');
    assert.ok(fs.existsSync(pdfExportFile), 'mapPdfExport.ts must exist');
    const pdfContent = fs.readFileSync(pdfExportFile, 'utf8');
    assert.match(pdfContent, /escapeMapHtml/, 'Must sanitize HTML to prevent injection');
  }, { featureId: 'F19', milestone: 'M3' });

  // Feature F20: Implementation — SuperBilling & InfinitePay
  runner.register('F20: Implementation — SuperBilling & InfinitePay Checkout Module', async () => {
    // 1. Route file and Screen
    const routeFile = path.join(MOBILE_DIR, 'app/(app)/planos/index.tsx');
    assert.ok(fs.existsSync(routeFile), 'planos/index.tsx route must exist');
    const screenFile = path.join(MOBILE_DIR, 'src/screens/SuperBillingScreen.tsx');
    assert.ok(fs.existsSync(screenFile), 'SuperBillingScreen.tsx must exist');

    const screenContent = fs.readFileSync(screenFile, 'utf8');
    assert.match(screenContent, /CustomerBillingView/, 'Must render CustomerBillingView for standard users');
    assert.match(screenContent, /SuperAdminBillingView/, 'Must render SuperAdminBillingView for superadmins');

    // 2. Billing constants and plans
    const constantsFile = path.join(MOBILE_DIR, 'src/features/billing/constants.ts');
    assert.ok(fs.existsSync(constantsFile), 'billing constants.ts must exist');
    const constantsContent = fs.readFileSync(constantsFile, 'utf8');
    assert.match(constantsContent, /PLANS_CATALOG/, 'Must export PLANS_CATALOG');
    assert.match(constantsContent, /essencial/, 'Must include essencial plan');
    assert.match(constantsContent, /profissional/, 'Must include profissional plan');
    assert.match(constantsContent, /elite/, 'Must include elite plan');
    assert.match(constantsContent, /WHATSAPP_CREDITS_CATALOG/, 'Must export WHATSAPP_CREDITS_CATALOG');

    // 3. Components
    const planCardFile = path.join(MOBILE_DIR, 'src/features/billing/PlanCard.tsx');
    const creditsFile = path.join(MOBILE_DIR, 'src/features/billing/WhatsappCreditsSection.tsx');
    const cycleToggleFile = path.join(MOBILE_DIR, 'src/features/billing/BillingCycleToggle.tsx');

    assert.ok(fs.existsSync(planCardFile), 'PlanCard.tsx must exist');
    assert.ok(fs.existsSync(creditsFile), 'WhatsappCreditsSection.tsx must exist');
    assert.ok(fs.existsSync(cycleToggleFile), 'BillingCycleToggle.tsx must exist');

    // 4. Hook and InfinitePay Edge Function invocation
    const hookFile = path.join(MOBILE_DIR, 'src/features/billing/useBillingState.ts');
    assert.ok(fs.existsSync(hookFile), 'useBillingState.ts must exist');
    const hookContent = fs.readFileSync(hookFile, 'utf8');
    assert.match(hookContent, /billing-create-checkout/, 'Must invoke billing-create-checkout Edge Function');
    assert.match(hookContent, /paymentMethod:\s*['"]pix['"]/, 'Must configure pix payment method for Instant Checkout');
    assert.match(hookContent, /openBrowserAsync/, 'Must open native browser for checkout');
  }, { featureId: 'F20', milestone: 'M3' });

  // Feature F21: Implementation — Android Notification Architecture & Native Channels
  runner.register('F21: Implementation — Android Notification Tray Icon, Native Channels & Offline Scheduling', async () => {
    // 1. Notification Icon Asset (API 26+ monochrome)
    const iconAsset = path.join(MOBILE_DIR, 'assets/notification-icon.png');
    assert.ok(fs.existsSync(iconAsset), 'notification-icon.png must exist in mobile assets');
    const iconStat = fs.statSync(iconAsset);
    assert.ok(iconStat.size > 0, 'notification-icon.png must not be empty');

    // 2. app.json Notification Configuration
    const appJsonFile = path.join(MOBILE_DIR, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonFile, 'utf8'));
    assert.ok(appJson.expo.notification, 'app.json must contain expo.notification configuration');
    assert.equal(appJson.expo.notification.icon, './assets/notification-icon.png', 'Notification icon must match asset path');
    assert.equal(appJson.expo.notification.color, '#023c69', 'Notification color must be brand color #023c69');

    // 3. Notification Service & Native Channels
    const notifServiceFile = path.join(MOBILE_DIR, 'src/services/notificationService.ts');
    assert.ok(fs.existsSync(notifServiceFile), 'notificationService.ts must exist');
    const notifContent = fs.readFileSync(notifServiceFile, 'utf8');
    assert.match(notifContent, /reunioes_alertas/, 'Must configure reunioes_alertas channel (MAX)');
    assert.match(notifContent, /tarefas_prazos/, 'Must configure tarefas_prazos channel (HIGH)');
    assert.match(notifContent, /rsvp_atividade/, 'Must configure rsvp_atividade channel (DEFAULT)');
    assert.match(notifContent, /financeiro_avisos/, 'Must configure financeiro_avisos channel (LOW)');
    assert.match(notifContent, /setupNotificationChannels/, 'Must export setupNotificationChannels');
    assert.match(notifContent, /setupNotificationResponseListener/, 'Must export setupNotificationResponseListener');
    assert.match(notifContent, /scheduleMeetingAlerts/, 'Must export scheduleMeetingAlerts');
    assert.match(notifContent, /scheduleTaskReminder/, 'Must export scheduleTaskReminder');
    assert.match(notifContent, /painelprime:\/\/reunioes\//, 'Must support deep link to meetings');
    assert.match(notifContent, /painelprime:\/\/tarefas\//, 'Must support deep link to tasks');

    // 4. Root Bootstrap Registration
    const rootProvidersFile = path.join(MOBILE_DIR, 'src/bootstrap/MobileRootProviders.tsx');
    assert.ok(fs.existsSync(rootProvidersFile), 'MobileRootProviders.tsx must exist');
    const rootContent = fs.readFileSync(rootProvidersFile, 'utf8');
    assert.match(rootContent, /setupNotificationChannels/, 'MobileRootProviders must initialize notification channels');
    assert.match(rootContent, /setupNotificationResponseListener/, 'MobileRootProviders must initialize notification response listener');

    // 5. Deep Link Target Screen
    const taskScreenFile = path.join(MOBILE_DIR, 'app/(app)/tarefas/[id].tsx');
    assert.ok(fs.existsSync(taskScreenFile), 'tarefas/[id].tsx route must exist for notification deep links');
  }, { featureId: 'F21', milestone: 'M6' });

  // Feature F22: Implementation — Corporate Mobile UI/UX Package
  runner.register('F22: Implementation — Corporate Mobile UI/UX Package (Touch Targets, AppHaptics, Skeletons, Empty States & Keyboard Ergonomics)', async () => {
    // 1. Touch Targets >= 44x44pt in Button & Modal
    const buttonFile = path.join(MOBILE_DIR, 'src/components/ui/Button.tsx');
    const modalFile = path.join(MOBILE_DIR, 'src/components/ui/Modal.tsx');
    assert.ok(fs.existsSync(buttonFile), 'Button.tsx must exist');
    assert.ok(fs.existsSync(modalFile), 'Modal.tsx must exist');

    const buttonContent = fs.readFileSync(buttonFile, 'utf8');
    assert.match(buttonContent, /hitSlop/, 'Button must define hitSlop for touch targets');
    assert.match(buttonContent, /minHeight:\s*44/, 'Button base must guarantee minHeight >= 44pt');

    const modalContent = fs.readFileSync(modalFile, 'utf8');
    assert.match(modalContent, /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/, 'Modal close button must have hitSlop 12');
    assert.match(modalContent, /minWidth:\s*44/, 'Modal close button must have minWidth 44');
    assert.match(modalContent, /minHeight:\s*44/, 'Modal close button must have minHeight 44');

    // 2. Feedback Háptico Integrado (AppHaptics)
    const hapticsFile = path.join(MOBILE_DIR, 'src/lib/haptics.ts');
    assert.ok(fs.existsSync(hapticsFile), 'haptics.ts must exist');
    const hapticsContent = fs.readFileSync(hapticsFile, 'utf8');
    assert.match(hapticsContent, /export\s+const\s+AppHaptics/, 'Must export AppHaptics');
    assert.match(hapticsContent, /selection\(/, 'AppHaptics must implement selection');
    assert.match(hapticsContent, /light\(/, 'AppHaptics must implement light impact');
    assert.match(hapticsContent, /medium\(/, 'AppHaptics must implement medium impact');
    assert.match(hapticsContent, /heavy\(/, 'AppHaptics must implement heavy impact');
    assert.match(hapticsContent, /success\(/, 'AppHaptics must implement success notification');
    assert.match(hapticsContent, /error\(/, 'AppHaptics must implement error notification');

    // 3. Skeletons Shimmer Loaders
    const skeletonFile = path.join(MOBILE_DIR, 'src/components/ui/Skeleton.tsx');
    assert.ok(fs.existsSync(skeletonFile), 'Skeleton.tsx must exist');
    const skeletonContent = fs.readFileSync(skeletonFile, 'utf8');
    assert.match(skeletonContent, /export\s+function\s+Skeleton/, 'Must export Skeleton component');
    assert.match(skeletonContent, /Animated\.timing|Animated\.loop|opacity/, 'Skeleton must implement animated shimmer/pulsing');

    // 4. Empty States with CTAs
    const emptyStateFile = path.join(MOBILE_DIR, 'src/components/ui/EmptyState.tsx');
    assert.ok(fs.existsSync(emptyStateFile), 'EmptyState.tsx must exist');
    const emptyContent = fs.readFileSync(emptyStateFile, 'utf8');
    assert.match(emptyContent, /export\s+function\s+EmptyState/, 'Must export EmptyState component');
    assert.match(emptyContent, /hitSlop/, 'EmptyState action button must define hitSlop');
    assert.match(emptyContent, /minHeight:\s*4[4-9]/, 'EmptyState action button must have minHeight >= 44pt');
    assert.match(emptyContent, /AppHaptics/, 'EmptyState action button must trigger AppHaptics feedback');

    // 5. Keyboard Ergonomics in Forms & Modals
    const padrinhosModalFile = path.join(MOBILE_DIR, 'src/features/padrinhos/PadrinhoFormModal.tsx');
    const meetingModalFile = path.join(MOBILE_DIR, 'src/features/meetings/MeetingCenter.tsx');
    const taskDetailFile = path.join(MOBILE_DIR, 'app/(app)/tarefas/[id].tsx');
    assert.ok(fs.existsSync(padrinhosModalFile), 'PadrinhoFormModal.tsx must exist');
    assert.ok(fs.existsSync(meetingModalFile), 'MeetingCenter.tsx must exist');
    assert.ok(fs.existsSync(taskDetailFile), 'tarefas/[id].tsx must exist');

    const formContents = [
      fs.readFileSync(padrinhosModalFile, 'utf8'),
      fs.readFileSync(meetingModalFile, 'utf8'),
      fs.readFileSync(taskDetailFile, 'utf8'),
    ].join('\n');
    assert.match(formContents, /KeyboardAvoidingView/, 'Forms must be wrapped with KeyboardAvoidingView');
    assert.match(formContents, /keyboardShouldPersistTaps/, 'Form scrolls must configure keyboardShouldPersistTaps');
  }, { featureId: 'F22', milestone: 'M7' });

  // Feature F23: Google Play Submission Checklist Presence & Structure
  runner.register('F23: Google Play Submission Checklist Presence & Structure (App Access & Data Safety)', async () => {
    const checklistPath = path.join(DOCS_MOBILE_DIR, 'GOOGLE_PLAY_SUBMISSION_CHECKLIST.md');
    assert.ok(fs.existsSync(checklistPath), 'GOOGLE_PLAY_SUBMISSION_CHECKLIST.md must exist in docs/mobile/');
    const content = fs.readFileSync(checklistPath, 'utf8');

    // Invariants per Google Play Console requirements:
    assert.match(content, /google-teste-elite@painelprime\.com\.br/, 'Must contain reviewer demo email');
    assert.match(content, /PainelPrime!2026Elite/, 'Must contain reviewer demo password');
    assert.match(content, /INSTRUÇÕES DE ACESSO PARA REVISÃO DO GOOGLE PLAY/i, 'Must contain PT-BR App Access instructions');
    assert.match(content, /APP ACCESS INSTRUCTIONS FOR GOOGLE PLAY REVIEWERS/i, 'Must contain EN App Access instructions');
    assert.match(content, /SEM 2FA \/ MFA \/ SMS|NO 2FA \/ MFA \/ SMS/i, 'Must explicitly state no 2FA/SMS required');
    assert.match(content, /SEM BLOQUEIO GEOGRÁFICO|NO GEOBLOCKING/i, 'Must explicitly state no geoblocking');
    assert.match(content, /Segurança dos Dados|Data Safety/i, 'Must contain Data Safety mapping section');
    assert.match(content, /https:\/\/painelprime\.com\.br\/privacidade\/exclusao-de-dados/, 'Must include canonical deletion URL');
    assert.match(content, /https:\/\/painelprime\.com\.br\/privacidade/, 'Must include canonical privacy URL');
    assert.match(content, /lgpd@painelprime\.com\.br/, 'Must include DPO contact email');
  }, { featureId: 'F23', milestone: 'M10' });

  // Feature F24: In-App Account & Data Deletion Flow (Mobile)
  runner.register('F24: In-App Account & Data Deletion Flow & Privacy Integration (Mobile)', async () => {
    // 1. DeleteAccountModal component existence & invariants
    const modalPath = path.join(MOBILE_DIR, 'src/components/DeleteAccountModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'DeleteAccountModal.tsx must exist');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert.match(modalContent, /EXCLUIR MINHA CONTA/, 'Must require exact confirmation phrase EXCLUIR MINHA CONTA');
    assert.match(modalContent, /\/functions\/v1\/delete-account/, 'Must call /functions/v1/delete-account Edge Function');
    assert.match(modalContent, /refreshSession/, 'Must handle 401 retry with refreshSession');
    assert.match(modalContent, /signOut\(\)/, 'Must trigger signOut upon successful deletion');
    assert.match(modalContent, /onRequestClose/, 'Must handle Android back button via onRequestClose');
    assert.match(modalContent, /minHeight:\s*44|hitSlop/, 'Must guarantee accessible touch targets (minHeight 44 or hitSlop 12)');
    assert.match(modalContent, /https:\/\/painelprime\.com\.br\/privacidade\/exclusao-de-dados/, 'Must link to web deletion page');

    // 2. Integration in ProfileScreen.tsx
    const profilePath = path.join(MOBILE_DIR, 'src/screens/ProfileScreen.tsx');
    const profileContent = fs.readFileSync(profilePath, 'utf8');
    assert.match(profileContent, /DeleteAccountModal/, 'ProfileScreen must integrate DeleteAccountModal');
    assert.match(profileContent, /Zona de Perigo|Excluir Conta/i, 'ProfileScreen must contain Danger Zone section');
    assert.match(profileContent, /minHeight:\s*44/, 'ProfileScreen buttons must have minHeight: 44');

    // 3. Integration in SettingsScreen.tsx
    const settingsPath = path.join(MOBILE_DIR, 'src/screens/SettingsScreen.tsx');
    const settingsContent = fs.readFileSync(settingsPath, 'utf8');
    assert.match(settingsContent, /DeleteAccountModal/, 'SettingsScreen must integrate DeleteAccountModal');
    assert.match(settingsContent, /Zona de Perigo|Excluir Conta/i, 'SettingsScreen must contain Danger Zone section');
    assert.match(settingsContent, /privacidade\/exclusao-de-dados/, 'SettingsScreen must link to web deletion page');

    // 4. Session Hydration Fallback in AuthContext.tsx
    const authContextPath = path.join(MOBILE_DIR, 'src/contexts/AuthContext.tsx');
    const authContent = fs.readFileSync(authContextPath, 'utf8');
    assert.match(authContent, /fallbackTimer|setTimeout\(.+4000\)/, 'AuthContext must implement defensive timeout (<= 4s) for session hydration');

    // 5. Privacy Policy and Auth Screens
    const privacyScreenPath = path.join(MOBILE_DIR, 'src/screens/PublicPrivacyPolicyScreen.tsx');
    const privacyContent = fs.readFileSync(privacyScreenPath, 'utf8');
    assert.match(privacyContent, /Sentry/i, 'Privacy Screen must disclose Sentry');
    assert.match(privacyContent, /biometria/i, 'Privacy Screen must disclose local hardware biometrics');
    assert.match(privacyContent, /privacidade\/exclusao-de-dados/, 'Privacy Screen must link to data deletion page');

    const loginScreenPath = path.join(MOBILE_DIR, 'src/screens/LoginScreen.tsx');
    const loginContent = fs.readFileSync(loginScreenPath, 'utf8');
    assert.match(loginContent, /privacyPolicy/, 'LoginScreen must link to Privacy Policy');

    const signupScreenPath = path.join(MOBILE_DIR, 'src/screens/SignupScreen.tsx');
    const signupContent = fs.readFileSync(signupScreenPath, 'utf8');
    assert.match(signupContent, /privacyPolicy/, 'SignupScreen must link to Privacy Policy');
  }, { featureId: 'F24', milestone: 'M10' });

  // Feature F25: Public Web Data Deletion & Privacy Routes (Web)
  runner.register('F25: Public Web Data Deletion & Privacy Routes (Web Next.js App Router)', async () => {
    const webAppDir = path.join(ROOT_DIR, 'apps/web/src/app');
    const webScreensDir = path.join(ROOT_DIR, 'apps/web/src/screens');

    // 1. Next.js Routes presence & canonical metadata
    const canonicalRoutePath = path.join(webAppDir, 'privacidade/exclusao-de-dados/page.tsx');
    assert.ok(fs.existsSync(canonicalRoutePath), 'apps/web/src/app/privacidade/exclusao-de-dados/page.tsx must exist');
    const canonicalContent = fs.readFileSync(canonicalRoutePath, 'utf8');
    assert.match(canonicalContent, /canonicalPath:\s*['"]\/privacidade\/exclusao-de-dados['"]/, 'Must specify canonicalPath');

    const brRoutePath = path.join(webAppDir, 'br/privacidade/exclusao-de-dados/page.tsx');
    assert.ok(fs.existsSync(brRoutePath), 'apps/web/src/app/br/privacidade/exclusao-de-dados/page.tsx must exist');
    const brContent = fs.readFileSync(brRoutePath, 'utf8');
    assert.match(brContent, /canonicalPath:\s*['"]\/privacidade\/exclusao-de-dados['"]/, 'Must mirror canonicalPath');

    // 2. DataDeletionPage content invariants
    const dataDeletionPagePath = path.join(webScreensDir, 'DataDeletionPage.tsx');
    assert.ok(fs.existsSync(dataDeletionPagePath), 'DataDeletionPage.tsx must exist');
    const dataDeletionContent = fs.readFileSync(dataDeletionPagePath, 'utf8');

    assert.match(dataDeletionContent, /br\.com\.painelprime\.app/, 'Must document Android app deletion steps');
    assert.match(dataDeletionContent, /app\.painelprime\.com\.br/, 'Must document web platform deletion steps');
    assert.match(dataDeletionContent, /mailto:lgpd@painelprime\.com\.br/, 'Must provide pre-configured mailto link');
    assert.match(dataDeletionContent, /Marco Civil|Art(\.|igo)?\s*15|6\s*meses/i, 'Must document 6-month Marco Civil retention');
    assert.match(dataDeletionContent, /5\s*anos|tribut/i, 'Must document 5-year tax/fiscal retention');

    // 3. SecuritySettingsTab bug fix verification
    const securityTabPath = path.join(webScreensDir, 'settings/SecuritySettingsTab.tsx');
    assert.ok(fs.existsSync(securityTabPath), 'SecuritySettingsTab.tsx must exist');
    const securityTabContent = fs.readFileSync(securityTabPath, 'utf8');
    assert.match(securityTabContent, /functionName:\s*['"]delete-account['"]/, 'Must call delete-account Edge Function');
    assert.doesNotMatch(securityTabContent, /functionName:\s*['"]account-delete['"]/, 'Must NOT call non-existent account-delete');

    // 4. PrivacyPolicyPage Web Content
    const privacyWebPath = path.join(webScreensDir, 'PrivacyPolicyPage.tsx');
    assert.ok(fs.existsSync(privacyWebPath), 'PrivacyPolicyPage.tsx must exist');
    const privacyWebContent = fs.readFileSync(privacyWebPath, 'utf8');
    assert.match(privacyWebContent, /Sentry/i, 'Must disclose Sentry telemetry');
    assert.match(privacyWebContent, /Meta Pixel|CAPI/i, 'Must disclose Meta Pixel/CAPI');
    assert.match(privacyWebContent, /biometria/i, 'Must disclose local biometrics');
    assert.match(privacyWebContent, /\/privacidade\/exclusao-de-dados/, 'Must link to /privacidade/exclusao-de-dados');
  }, { featureId: 'F25', milestone: 'M10' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runner = new TestRunner('Tier 1: Feature Coverage (F1 to F25)');
  registerTier1Tests(runner);
  runner.run().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
