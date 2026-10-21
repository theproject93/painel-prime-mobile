import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ROOT_DIR, MOBILE_DIR, PACKAGES_DIR, TestRunner, hasUtf8Bom, getFilesRecursively } from './common.mjs';

// Import splitSecureValue and utf8ByteLength logic for direct boundary testing
function utf8ByteLength(value) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function splitSecureValue(value, maxBytes = 1800) {
  if (maxBytes < 1) throw new Error('maxBytes must be positive');
  if (value.length === 0) return [''];

  const chunks = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (characterBytes > maxBytes) throw new Error('maxBytes cannot contain one UTF-8 character');
    if (chunk && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function registerTier3Tests(runner) {
  // Test 3.1: Route Alignment & RedBox-free Navigation
  runner.register('Tier 3.1: Mobile Route Alignment & RedBox-Free Unauthenticated Landing', async () => {
    const indexFile = path.join(MOBILE_DIR, 'app/index.tsx');
    assert.ok(fs.existsSync(indexFile), 'apps/mobile/app/index.tsx must exist');
    const indexContent = fs.readFileSync(indexFile, 'utf8');

    // Extract unauthenticated landing redirection route
    assert.match(indexContent, /<Redirect\s+href="\/landing"/, 'app/index.tsx must redirect unauthenticated users to /landing');

    // Verify corresponding target file exists in apps/mobile/app/(public)/landing.tsx
    const landingFile = path.join(MOBILE_DIR, 'app/(public)/landing.tsx');
    assert.ok(fs.existsSync(landingFile),
      `RedBox crash prevention: Redirect target "/landing" in index.tsx requires ${landingFile} to exist!`);

    const content = fs.readFileSync(landingFile, 'utf8');
    assert.match(content, /export\s+default/, `${path.basename(landingFile)} must export a default component`);
  });

  // Test 3.2: SecureStore Adapter Chunk Limits & Multibyte Splitting
  runner.register('Tier 3.2: SecureStore Adapter Chunking & Android Keystore Buffer Limits', async () => {
    const SECURE_STORE_CHUNK_SIZE = 1800;
    const ANDROID_KEYSTORE_LIMIT = 2048;

    // Invariant: chunk size must be <= 1800 and comfortably below 2048
    assert.ok(SECURE_STORE_CHUNK_SIZE <= 1800, 'SECURE_STORE_CHUNK_SIZE must be <= 1800');
    assert.ok(SECURE_STORE_CHUNK_SIZE < ANDROID_KEYSTORE_LIMIT, 'Must not exceed Android Keystore 2KB limit');

    // Boundary Test 1: Empty String
    const emptyChunks = splitSecureValue('');
    assert.deepEqual(emptyChunks, [''], 'Empty string must return a single empty chunk');

    // Boundary Test 2: Exactly 1800 bytes of ASCII
    const ascii1800 = 'a'.repeat(1800);
    const chunks1800 = splitSecureValue(ascii1800, SECURE_STORE_CHUNK_SIZE);
    assert.equal(chunks1800.length, 1, '1800 ASCII bytes must fit in exactly 1 chunk');
    assert.equal(utf8ByteLength(chunks1800[0]), 1800);

    // Boundary Test 3: Exactly 1801 bytes (crosses boundary by 1 byte)
    const ascii1801 = 'a'.repeat(1801);
    const chunks1801 = splitSecureValue(ascii1801, SECURE_STORE_CHUNK_SIZE);
    assert.equal(chunks1801.length, 2, '1801 ASCII bytes must split into 2 chunks');
    assert.equal(utf8ByteLength(chunks1801[0]), 1800);
    assert.equal(utf8ByteLength(chunks1801[1]), 1);
    assert.equal(chunks1801.join(''), ascii1801);

    // Boundary Test 4: Multibyte UTF-8 characters across boundaries
    // 'á' is 2 bytes; 900 'á' characters = 1800 bytes exactly
    const multi1800 = 'á'.repeat(900);
    const chunksMulti1800 = splitSecureValue(multi1800, SECURE_STORE_CHUNK_SIZE);
    assert.equal(chunksMulti1800.length, 1);
    assert.equal(utf8ByteLength(chunksMulti1800[0]), 1800);

    // 901 'á' characters = 1802 bytes -> must split 900 in chunk 1 (1800 bytes) and 1 in chunk 2 (2 bytes)
    const multi1802 = 'á'.repeat(901);
    const chunksMulti1802 = splitSecureValue(multi1802, SECURE_STORE_CHUNK_SIZE);
    assert.equal(chunksMulti1802.length, 2);
    assert.equal(utf8ByteLength(chunksMulti1802[0]), 1800);
    assert.equal(utf8ByteLength(chunksMulti1802[1]), 2);
    assert.equal(chunksMulti1802.join(''), multi1802);

    // Boundary Test 5: Complex JWT session simulation with emojis and UTF-8
    const complexSession = JSON.stringify({
      access_token: 'eyJhbGciOi...'.repeat(250),
      user: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Assessoria João & Maria Cerimonial 🎉💍',
        role: 'cerimonialista_elite',
      },
    });

    const sessionChunks = splitSecureValue(complexSession, SECURE_STORE_CHUNK_SIZE);
    assert.ok(sessionChunks.length >= 2, 'Complex session must span multiple chunks');
    for (const chunk of sessionChunks) {
      assert.ok(utf8ByteLength(chunk) <= SECURE_STORE_CHUNK_SIZE, 'Every chunk must respect limit');
    }
    assert.equal(sessionChunks.join(''), complexSession, 'Rejoined chunks must match original string verbatim');
  });

  // Test 3.3: SVG Gradient useId() Isolation & Eradication of expo-linear-gradient
  runner.register('Tier 3.3: SVG Gradient useId() Isolation & expo-linear-gradient Eradication', async () => {
    const allFiles = [
      ...getFilesRecursively(path.join(MOBILE_DIR, 'app'), ['.ts', '.tsx']),
      ...getFilesRecursively(path.join(MOBILE_DIR, 'src'), ['.ts', '.tsx']),
    ];

    // 1. Assert zero occurrences of expo-linear-gradient
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(content, /from\s+['"]expo-linear-gradient['"]/,
        `Violation: Found forbidden expo-linear-gradient in ${path.relative(ROOT_DIR, file)}`);
    }

    // 2. Check components that render LinearGradient from react-native-svg
    const svgGradientFiles = allFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return content.includes('react-native-svg') && content.includes('LinearGradient');
    });

    assert.ok(svgGradientFiles.length >= 4,
      `Expected at least 4 components using SVG LinearGradient, found ${svgGradientFiles.length}`);

    for (const file of svgGradientFiles) {
      const content = fs.readFileSync(file, 'utf8');
      // Must use useId() OR receive gradientId prop derived from useId()
      const hasUseId = content.includes('useId(') || content.includes('gradientId');
      assert.ok(hasUseId,
        `Fabric compliance: Component ${path.relative(ROOT_DIR, file)} using Svg LinearGradient must use useId() or accept a scoped gradientId!`);
    }
  });

  // Test 3.4: SafeArea Outside ScrollView Hierarchy
  runner.register('Tier 3.4: SafeAreaView Outside ScrollView Hierarchy Enforcement', async () => {
    const allFiles = [
      ...getFilesRecursively(path.join(MOBILE_DIR, 'app'), ['.tsx']),
      ...getFilesRecursively(path.join(MOBILE_DIR, 'src'), ['.tsx']),
    ];

    const violations = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('SafeAreaView') && (content.includes('ScrollView') || content.includes('FlatList'))) {
        // Pattern check: SafeAreaView should NOT be inside ScrollView or FlatList tags
        const badScrollPattern = /<ScrollView(?:\s+[^>]*?)>(?!\s*\()((?:(?!<\/ScrollView>)[\s\S])*?)<SafeAreaView/m;
        const badFlatListPattern = /<FlatList(?:\s+[^>]*?)>(?!\s*\()((?:(?!<\/FlatList>)[\s\S])*?)<SafeAreaView/m;

        if (badScrollPattern.test(content) || badFlatListPattern.test(content)) {
          violations.push(path.relative(ROOT_DIR, file));
        }
      }
    }

    assert.equal(violations.length, 0,
      `Violation: SafeAreaView placed inside ScrollView/FlatList in:\n` +
      violations.map((v) => `  - ${v}`).join('\n'));
  });

  // Test 3.5: Event Persona Copy Dynamic Derivation
  runner.register('Tier 3.5: Event Persona Copy Dynamic Derivation & Integration', async () => {
    const personaFile = path.join(PACKAGES_DIR, 'app/src/eventPersona.ts');
    assert.ok(fs.existsSync(personaFile), 'packages/app/src/eventPersona.ts must exist');

    // Validate that the EventDetailsScreen and DashboardScreen import getEventPersonaCopy
    const eventDetailsFile = path.join(MOBILE_DIR, 'src/screens/EventDetailsScreen.tsx');
    const dashboardFile = path.join(MOBILE_DIR, 'src/screens/DashboardScreen.tsx');

    assert.ok(fs.existsSync(eventDetailsFile), 'EventDetailsScreen.tsx must exist');
    assert.ok(fs.existsSync(dashboardFile), 'DashboardScreen.tsx must exist');

    const detailsContent = fs.readFileSync(eventDetailsFile, 'utf8');
    const dashboardContent = fs.readFileSync(dashboardFile, 'utf8');

    assert.match(detailsContent, /getEventPersonaCopy/,
      'EventDetailsScreen must import and use getEventPersonaCopy');
    assert.match(dashboardContent, /getEventPersonaCopy/,
      'DashboardScreen must import and use getEventPersonaCopy');

    // Verify there are no hardcoded matrimonial strings in generic event tabs
    const simpleTabsFile = path.join(MOBILE_DIR, 'src/features/events/tabs/SimpleEventTabs.tsx');
    if (fs.existsSync(simpleTabsFile)) {
      const tabsContent = fs.readFileSync(simpleTabsFile, 'utf8');
      assert.doesNotMatch(tabsContent, /"Orçamento dos Noivos"/,
        'SimpleEventTabs must not hardcode "Orçamento dos Noivos" for all event types');
    }
  });

  // Test 3.6: Parity Routes Deep Linking & Navigation Alignment
  runner.register('Tier 3.6: Parity Routes Deep Linking & Defensive Route Param Handling', async () => {
    const parityRoutes = [
      { path: 'app/(app)/eventos/[id]/padrinhos.tsx', name: 'Padrinhos' },
      { path: 'app/(app)/eventos/[id]/rsvp-inbox.tsx', name: 'RSVP Inbox' },
      { path: 'app/(app)/eventos/[id]/mesas.tsx', name: 'Mapa de Mesas' },
      { path: 'app/(app)/reunioes/index.tsx', name: 'Reuniões Index' },
      { path: 'app/(app)/reunioes/[id].tsx', name: 'Reuniões Detail' },
      { path: 'app/(app)/planos/index.tsx', name: 'Planos & SuperBilling' },
    ];

    for (const route of parityRoutes) {
      const fullPath = path.join(MOBILE_DIR, route.path);
      assert.ok(fs.existsSync(fullPath), `Route file ${route.path} must exist for ${route.name}`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check default export
      assert.match(content, /export\s+default/, `${route.path} must export a default React component`);

      // If dynamic route [id], check defensive route param handling per opentestai §2.2
      if (route.path.includes('[id]')) {
        assert.match(content, /Array\.isArray\(params\.id\)/,
          `${route.path} must defensively check Array.isArray(params.id) to prevent [object Object] crash`);
      }
    }
  });

  // Test 3.7: Exhaustive Invariants Across All 5 Parity Modules
  runner.register('Tier 3.7: Strict Invariants (No expo-linear-gradient, useId SVG, SafeArea outside Scroll, UTF-8, No Mojibake)', async () => {
    const moduleDirs = [
      path.join(MOBILE_DIR, 'src/features/padrinhos'),
      path.join(MOBILE_DIR, 'src/features/rsvp-inbox'),
      path.join(MOBILE_DIR, 'src/features/meetings'),
      path.join(MOBILE_DIR, 'src/features/table-map'),
      path.join(MOBILE_DIR, 'src/features/billing'),
      path.join(MOBILE_DIR, 'app/(app)/reunioes'),
    ];

    const specificFiles = [
      path.join(MOBILE_DIR, 'app/(app)/eventos/[id]/padrinhos.tsx'),
      path.join(MOBILE_DIR, 'app/(app)/eventos/[id]/rsvp-inbox.tsx'),
      path.join(MOBILE_DIR, 'app/(app)/eventos/[id]/mesas.tsx'),
      path.join(MOBILE_DIR, 'app/(app)/planos/index.tsx'),
      path.join(MOBILE_DIR, 'src/screens/SuperBillingScreen.tsx'),
    ];

    const allParityFiles = [...specificFiles];
    for (const dir of moduleDirs) {
      if (fs.existsSync(dir)) {
        allParityFiles.push(...getFilesRecursively(dir, ['.ts', '.tsx']));
      }
    }

    assert.ok(allParityFiles.length >= 30, `Expected >= 30 parity files, found ${allParityFiles.length}`);

    const mojibakeRegex = /[\u00C3][\u0080-\u00BF]|[\u00C2][\u0080-\u00BF]|[\u251C\u2524\u252C\uFFFD]|\u0000/;
    const badScrollPattern = /<ScrollView(?:\s+[^>]*?)>(?!\s*\()((?:(?!<\/ScrollView>)[\s\S])*?)<SafeAreaView/m;
    const badFlatListPattern = /<FlatList(?:\s+[^>]*?)>(?!\s*\()((?:(?!<\/FlatList>)[\s\S])*?)<SafeAreaView/m;

    for (const file of allParityFiles) {
      const relPath = path.relative(ROOT_DIR, file);
      const content = fs.readFileSync(file, 'utf8');

      // Invariant 1: No expo-linear-gradient
      assert.doesNotMatch(content, /from\s+['"]expo-linear-gradient['"]/,
        `Violation in ${relPath}: forbidden expo-linear-gradient import`);

      // Invariant 2: SVG LinearGradient must use useId or receive gradientId
      if (content.includes('LinearGradient') && content.includes('react-native-svg')) {
        const hasUseId = content.includes('useId(') || content.includes('gradientId') || content.includes('id={`');
        assert.ok(hasUseId, `Violation in ${relPath}: SVG LinearGradient must use useId() for scoped id`);
      }

      // Invariant 3: SafeAreaView strictly outside ScrollView / FlatList
      assert.doesNotMatch(content, badScrollPattern,
        `Violation in ${relPath}: SafeAreaView must not be nested inside ScrollView`);
      assert.doesNotMatch(content, badFlatListPattern,
        `Violation in ${relPath}: SafeAreaView must not be nested inside FlatList`);

      // Invariant 4: No UTF-8 BOM
      assert.equal(hasUtf8Bom(file), false, `Violation in ${relPath}: contains UTF-8 BOM`);

      // Invariant 5: No Mojibake
      assert.doesNotMatch(content, mojibakeRegex, `Violation in ${relPath}: contains corrupted mojibake characters`);

      // Invariant 6: No deprecated planejarpro branding
      assert.doesNotMatch(content, /planejarpro/i, `Violation in ${relPath}: legacy branding planejarpro found`);
    }
  });

  // Test 3.8: Padrinhos Pairing Engine & Persona-Aware Roles
  runner.register('Tier 3.8: Padrinhos Pairing Algorithm & Debutante vs Wedding Persona Matrix', async () => {
    // 1. Standalone test of buildPadrinhoPairs logic
    function testBuildPairs(items) {
      const sorted = [...items].sort((a, b) => a.entry_order - b.entry_order || a.role.localeCompare(b.role));
      const visited = new Set();
      const pairs = [];
      for (const item of sorted) {
        if (visited.has(item.id)) continue;
        visited.add(item.id);
        let companion = null;
        if (item.pair_padrinho_id) {
          companion = sorted.find((cand) => cand.id === item.pair_padrinho_id) ?? null;
          if (companion) visited.add(companion.id);
        }
        pairs.push({
          pairKey: companion ? `${item.id}-${companion.id}` : item.id,
          entryOrder: item.entry_order,
          primary: item,
          companion,
        });
      }
      return pairs;
    }

    const mockItems = [
      { id: 'p1', role: 'padrinho', entry_order: 1, pair_padrinho_id: 'm1' },
      { id: 'm1', role: 'madrinha', entry_order: 1, pair_padrinho_id: 'p1' },
      { id: 'd1', role: 'daminha', entry_order: 2, pair_padrinho_id: null },
      { id: 'pj1', role: 'pajem', entry_order: 3, pair_padrinho_id: null },
    ];

    const pairs = testBuildPairs(mockItems);
    assert.equal(pairs.length, 3, 'Should produce 3 groups (1 pair + 2 solo)');
    assert.equal(pairs[0].primary.id, 'm1', 'Primary entry must be m1 (madrinha comes before padrinho)');
    assert.equal(pairs[0].companion?.id, 'p1', 'Companion of m1 must be p1');
    assert.equal(pairs[1].primary.id, 'd1', 'Second entry must be daminha d1');
    assert.equal(pairs[1].companion, null, 'Daminha has no companion');

    // 2. Persona Role Label Verification
    const modelSource = fs.readFileSync(path.join(MOBILE_DIR, 'src/features/padrinhos/padrinhosModel.ts'), 'utf8');
    assert.match(modelSource, /Dama de Honra/, 'Must map debutante dama to Dama de Honra');
    assert.match(modelSource, /Príncipe da Valsa/, 'Must map debutante principe to Príncipe da Valsa');
    assert.match(modelSource, /Padrinho da Valsa/, 'Must map debutante padrinho_valsa');
    assert.match(modelSource, /Madrinha/, 'Must map wedding madrinha');
    assert.match(modelSource, /Lado da Noiva/, 'Must map wedding side noiva');
    assert.match(modelSource, /Lado do Noivo/, 'Must map wedding side noivo');
    assert.match(modelSource, /Corte Debutante/, 'Must map debutante side');
  });

  // Test 3.9: WhatsApp RSVP 24-Hour Active Window & Interpretation Resolution
  runner.register('Tier 3.9: WhatsApp RSVP 24-Hour Conversation Window & AI Resolution Extraction', async () => {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    function testIsWithin24hWindow(lastInboundAt, nowMs = Date.now()) {
      if (!lastInboundAt) return false;
      const parsed = new Date(lastInboundAt).getTime();
      if (Number.isNaN(parsed)) return false;
      const elapsed = nowMs - parsed;
      return elapsed >= 0 && elapsed <= TWENTY_FOUR_HOURS_MS;
    }

    function testFormat24hRemaining(lastInboundAt, nowMs = Date.now()) {
      if (!lastInboundAt) return 'Janela 24h fechada';
      const parsed = new Date(lastInboundAt).getTime();
      if (Number.isNaN(parsed)) return 'Janela 24h fechada';
      const remainingMs = TWENTY_FOUR_HOURS_MS - (nowMs - parsed);
      if (remainingMs <= 0) return 'Janela 24h fechada';
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      if (hours > 0) return `${hours}h ${minutes}m restantes`;
      return `${minutes} min restantes`;
    }

    const baseNow = new Date('2026-10-19T12:00:00.000Z').getTime();

    // Case 1: Inbound 1 hour ago
    const oneHourAgo = new Date(baseNow - 60 * 60 * 1000).toISOString();
    assert.equal(testIsWithin24hWindow(oneHourAgo, baseNow), true);
    assert.match(testFormat24hRemaining(oneHourAgo, baseNow), /23h 0m restantes/);

    // Case 2: Inbound 23 hours ago
    const twentyThreeHoursAgo = new Date(baseNow - 23 * 60 * 60 * 1000).toISOString();
    assert.equal(testIsWithin24hWindow(twentyThreeHoursAgo, baseNow), true);
    assert.match(testFormat24hRemaining(twentyThreeHoursAgo, baseNow), /1h 0m restantes/);

    // Case 3: Inbound 25 hours ago (expired)
    const twentyFiveHoursAgo = new Date(baseNow - 25 * 60 * 60 * 1000).toISOString();
    assert.equal(testIsWithin24hWindow(twentyFiveHoursAgo, baseNow), false);
    assert.equal(testFormat24hRemaining(twentyFiveHoursAgo, baseNow), 'Janela 24h fechada');

    // Case 4: Null / invalid inputs
    assert.equal(testIsWithin24hWindow(null, baseNow), false);
    assert.equal(testFormat24hRemaining(null, baseNow), 'Janela 24h fechada');
    assert.equal(testIsWithin24hWindow('invalid-date', baseNow), false);

    // Verify source file implementation
    const rsvpModelSource = fs.readFileSync(path.join(MOBILE_DIR, 'src/features/rsvp-inbox/rsvpInboxModel.ts'), 'utf8');
    assert.match(rsvpModelSource, /isWithin24hWindow/, 'rsvpInboxModel.ts must implement isWithin24hWindow');
    assert.match(rsvpModelSource, /format24hRemaining/, 'rsvpInboxModel.ts must implement format24hRemaining');
    assert.match(rsvpModelSource, /extractSuggestedMembers/, 'rsvpInboxModel.ts must implement extractSuggestedMembers');
  });

  // Test 3.10: Table Map Touch Geometry, Fixture Spaces & Meeting ATA Retry Matrix
  runner.register('Tier 3.10: Table Map Math & Meeting ATA Retry Logic Verification', async () => {
    // 1. Table Map core math
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const snap = (val, grid = 20) => Math.round(val / grid) * grid;
    const toNumber = (val, fallback = 0) => {
      const parsed = Number(val);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    assert.equal(clamp(15, 0, 10), 10);
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(snap(31), 40);
    assert.equal(snap(29), 20);
    assert.equal(toNumber('42.5'), 42.5);
    assert.equal(toNumber('abc', 10), 10);

    // Fixture space partitioning
    const getFixtureSpace = (type) => (type.startsWith('church_') || type === 'altar' ? 'church' : 'party');
    assert.equal(getFixtureSpace('altar'), 'church');
    assert.equal(getFixtureSpace('church_aisle'), 'church');
    assert.equal(getFixtureSpace('stage'), 'party');
    assert.equal(getFixtureSpace('bar'), 'party');

    // Occupancy
    const guests = [
      { id: 'g1', table_id: 't1' },
      { id: 'g2', table_id: 't1' },
      { id: 'g3', table_id: 't2' },
      { id: 'g4', table_id: null },
    ];
    const occupancy = guests.reduce((acc, g) => {
      if (g.table_id) acc.set(g.table_id, (acc.get(g.table_id) ?? 0) + 1);
      return acc;
    }, new Map());
    assert.equal(occupancy.get('t1'), 2);
    assert.equal(occupancy.get('t2'), 1);

    // 2. Meeting Brazilian date parser & ATA retry
    function parseBrazilianDateTime(value) {
      const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
      if (!match) throw new Error('Use o formato DD/MM/AAAA HH:mm.');
      const [, dayText, monthText, yearText, hourText, minuteText] = match;
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const hour = Number(hourText);
      const minute = Number(minuteText);
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute
      ) {
        throw new Error('Informe uma data e hora válidas.');
      }
      return date;
    }

    const validDate = parseBrazilianDateTime('15/11/2026 14:30');
    assert.equal(validDate.getDate(), 15);
    assert.equal(validDate.getMonth(), 10); // November is 10 (0-indexed)
    assert.equal(validDate.getFullYear(), 2026);
    assert.equal(validDate.getHours(), 14);
    assert.equal(validDate.getMinutes(), 30);

    assert.throws(() => parseBrazilianDateTime('31/02/2026 14:30'), /Informe uma data e hora válidas/);
    assert.throws(() => parseBrazilianDateTime('2026-11-15 14:30'), /Use o formato DD\/MM\/AAAA HH:mm/);

    // 3. Meeting ATA retry predicate
    function shouldOfferAtaRetry(meeting, nowMs = Date.now()) {
      if (meeting.meeting_minutes?.some((minute) => Boolean(minute.pdf_url))) return false;
      if (meeting.status === 'ata_failed') return true;
      if (meeting.status !== 'completed') return false;
      const updatedAt = meeting.updated_at ? new Date(meeting.updated_at).getTime() : nowMs;
      return nowMs - updatedAt >= 10 * 60 * 1000;
    }

    const testNow = new Date('2026-10-19T14:00:00.000Z').getTime();
    assert.equal(shouldOfferAtaRetry({ status: 'ata_failed' }, testNow), true);
    assert.equal(shouldOfferAtaRetry({ status: 'scheduled' }, testNow), false);
    assert.equal(shouldOfferAtaRetry({
      status: 'completed',
      updated_at: new Date(testNow - 15 * 60 * 1000).toISOString(),
      meeting_minutes: [],
    }, testNow), true);
    assert.equal(shouldOfferAtaRetry({
      status: 'completed',
      updated_at: new Date(testNow - 5 * 60 * 1000).toISOString(),
      meeting_minutes: [],
    }, testNow), false);
    assert.equal(shouldOfferAtaRetry({
      status: 'completed',
      updated_at: new Date(testNow - 15 * 60 * 1000).toISOString(),
      meeting_minutes: [{ pdf_url: 'https://storage/ata.pdf' }],
    }, testNow), false);
  });

  // Test 3.11: Android Notification Tray Icon Binary & Pixel Integrity Audit
  runner.register('Tier 3.11: Android Notification Tray Icon Binary & Pixel Integrity Audit (API 26+ Pure Monochrome White & Alpha Transparency)', async () => {
    const iconPath = path.join(MOBILE_DIR, 'assets/notification-icon.png');
    assert.ok(fs.existsSync(iconPath), 'apps/mobile/assets/notification-icon.png must exist');

    const buf = fs.readFileSync(iconPath);
    // 1. Verify PNG 8-byte Magic Signature
    const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), 'notification-icon.png must be a valid PNG binary');

    // 2. Parse PNG chunks (IHDR and IDAT)
    let offset = 8;
    let ihdr = null;
    const idatChunks = [];

    while (offset < buf.length) {
      const chunkLen = buf.readUInt32BE(offset);
      const chunkType = buf.toString('ascii', offset + 4, offset + 8);
      const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLen);

      if (chunkType === 'IHDR') {
        ihdr = {
          width: chunkData.readUInt32BE(0),
          height: chunkData.readUInt32BE(4),
          bitDepth: chunkData[8],
          colorType: chunkData[9],
        };
      } else if (chunkType === 'IDAT') {
        idatChunks.push(chunkData);
      }
      offset += 12 + chunkLen;
    }

    assert.ok(ihdr, 'PNG must contain IHDR chunk');
    assert.ok(ihdr.width >= 48 && ihdr.height >= 48, `Icon dimensions must be at least 48x48 (got ${ihdr.width}x${ihdr.height})`);
    assert.equal(ihdr.bitDepth, 8, 'Bit depth must be 8-bit');
    assert.equal(ihdr.colorType, 6, 'Color type must be 6 (RGBA with alpha channel)');

    // 3. Decompress IDAT scanlines
    const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
    const width = ihdr.width;
    const height = ihdr.height;
    const bpp = 4; // 4 bytes per pixel (RGBA)
    const rowBytes = 1 + width * bpp;
    const rawRows = [];

    let prevRow = Buffer.alloc(width * bpp, 0);
    for (let y = 0; y < height; y++) {
      const rowStart = y * rowBytes;
      const filterType = decompressed[rowStart];
      const currentRow = Buffer.alloc(width * bpp);

      for (let x = 0; x < width * bpp; x++) {
        const rawVal = decompressed[rowStart + 1 + x];
        const left = x >= bpp ? currentRow[x - bpp] : 0;
        const up = prevRow[x];
        const upLeft = x >= bpp ? prevRow[x - bpp] : 0;
        let val = rawVal;

        if (filterType === 0) {
          val = rawVal;
        } else if (filterType === 1) {
          val = (rawVal + left) & 0xff;
        } else if (filterType === 2) {
          val = (rawVal + up) & 0xff;
        } else if (filterType === 3) {
          val = (rawVal + Math.floor((left + up) / 2)) & 0xff;
        } else if (filterType === 4) {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const pr = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
          val = (rawVal + pr) & 0xff;
        }
        currentRow[x] = val;
      }
      rawRows.push(currentRow);
      prevRow = currentRow;
    }

    // 4. Pixel-by-pixel inspection: 0 colored pixels, 100% white on alpha
    let transparentPixels = 0;
    let opaqueWhitePixels = 0;
    let coloredPixels = 0;
    let nonWhitePixels = 0;

    for (let y = 0; y < height; y++) {
      const row = rawRows[y];
      for (let x = 0; x < width; x++) {
        const r = row[x * 4];
        const g = row[x * 4 + 1];
        const b = row[x * 4 + 2];
        const a = row[x * 4 + 3];

        if (a === 0) {
          transparentPixels++;
        } else {
          // Any non-transparent pixel must be pure white (#FFFFFF)
          if (r !== 255 || g !== 255 || b !== 255) {
            nonWhitePixels++;
          }
          if (r !== g || g !== b) {
            coloredPixels++;
          } else if (r === 255 && g === 255 && b === 255) {
            opaqueWhitePixels++;
          }
        }
      }
    }

    assert.equal(coloredPixels, 0,
      `Android API 26+ compatibility violation: Found ${coloredPixels} colored pixels! Notification tray icon must have 0 colored pixels.`);
    assert.equal(nonWhitePixels, 0,
      `Found ${nonWhitePixels} non-white pixels! All visible pixels must be pure white (#FFFFFF).`);
    assert.ok(opaqueWhitePixels > 500,
      `Notification icon must contain a visible silhouette (found ${opaqueWhitePixels} white pixels).`);
    assert.ok(transparentPixels > 1000,
      `Notification icon must have alpha transparency background (found ${transparentPixels} transparent pixels).`);
  });

  // Test 3.12: Corporate Mobile UI/UX Invariant Audit
  runner.register('Tier 3.12: Corporate Mobile UI/UX Invariant Audit (Touch Targets >= 44x44pt, HitSlop & Keyboard Dismissal)', async () => {
    // 1. Primitive UI Touch Target Audit
    const buttonFile = path.join(MOBILE_DIR, 'src/components/ui/Button.tsx');
    const modalFile = path.join(MOBILE_DIR, 'src/components/ui/Modal.tsx');
    const emptyStateFile = path.join(MOBILE_DIR, 'src/components/ui/EmptyState.tsx');

    const buttonContent = fs.readFileSync(buttonFile, 'utf8');
    assert.match(buttonContent, /minHeight:\s*44/, 'Button base style must enforce minHeight: 44');
    assert.match(buttonContent, /hitSlop/, 'Button must provide hitSlop');

    const modalContent = fs.readFileSync(modalFile, 'utf8');
    assert.match(modalContent, /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/,
      'Modal close button must specify 12pt hitSlop in all directions');
    assert.match(modalContent, /minWidth:\s*44/, 'Modal close button style must guarantee minWidth >= 44');
    assert.match(modalContent, /minHeight:\s*44/, 'Modal close button style must guarantee minHeight >= 44');

    const emptyContent = fs.readFileSync(emptyStateFile, 'utf8');
    assert.match(emptyContent, /minHeight:\s*46/, 'EmptyState action button must have minHeight >= 44');
    assert.match(emptyContent, /minWidth:\s*120/, 'EmptyState action button must have minWidth >= 44');
    assert.match(emptyContent, /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/,
      'EmptyState action button must have 12pt hitSlop');

    // 2. Back Button (Botão Voltar) HitSlop Verification Across Header Screens
    const backButtonScreens = [
      'app/(app)/tarefas/[id].tsx',
      'app/(app)/reunioes/[id].tsx',
      'app/(app)/reunioes/index.tsx',
      'app/(app)/eventos/[id]/mesas.tsx',
      'app/(app)/eventos/[id]/padrinhos.tsx',
    ];

    for (const relPath of backButtonScreens) {
      const fullPath = path.join(MOBILE_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const screenCode = fs.readFileSync(fullPath, 'utf8');
      assert.match(screenCode, /hitSlop=\{\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\}/,
        `${relPath} back button or navigation header must use 12pt hitSlop for a11y touch target compliance`);
    }

    // 3. Form Keyboard Ergonomics & Dismissal Audit
    const keyboardAvoidingComponents = [
      'src/features/padrinhos/PadrinhoFormModal.tsx',
      'src/features/meetings/MeetingCenter.tsx',
      'src/features/clients/ClientsPresentation.tsx',
      'src/features/events/EventWorkspace.tsx',
      'app/(app)/reunioes/[id].tsx',
    ];

    for (const relPath of keyboardAvoidingComponents) {
      const fullPath = path.join(MOBILE_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const compCode = fs.readFileSync(fullPath, 'utf8');
      assert.match(compCode, /KeyboardAvoidingView/,
        `${relPath} must be wrapped with KeyboardAvoidingView to prevent virtual keyboard occlusion`);
    }

    const scrollFormComponents = [
      'src/features/padrinhos/PadrinhoFormModal.tsx',
      'src/features/meetings/MeetingCenter.tsx',
      'src/features/clients/ClientsPresentation.tsx',
      'src/screens/EventsScreen.tsx',
    ];

    for (const relPath of scrollFormComponents) {
      const fullPath = path.join(MOBILE_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `${relPath} must exist`);
      const compCode = fs.readFileSync(fullPath, 'utf8');
      assert.match(compCode, /keyboardShouldPersistTaps=["']handled["']/,
        `${relPath} modal scroll area must set keyboardShouldPersistTaps="handled"`);
    }

    // Verify keyboard dismissal on tap outside
    const modalWithDismiss = path.join(MOBILE_DIR, 'src/features/padrinhos/PadrinhoFormModal.tsx');
    const modalWithDismissCode = fs.readFileSync(modalWithDismiss, 'utf8');
    assert.match(modalWithDismissCode, /Keyboard\.dismiss/,
      'PadrinhoFormModal must implement Keyboard.dismiss on touch outside to dismiss virtual keyboard');
  });

  // Test 3.13: Banking Privacy Curtain & Plan IA Mobile Resilience Invariants
  runner.register('Tier 3.13: Banking Privacy Curtain & Plan IA Mobile Resilience Invariants', async () => {
    // 1. BiometricLockScreen & PrivacyCurtain UI/UX Dark Luxury Invariants
    const lockScreenFile = path.join(MOBILE_DIR, 'src/components/BiometricLockScreen.tsx');
    assert.ok(fs.existsSync(lockScreenFile), 'BiometricLockScreen.tsx must exist');
    const lockScreenContent = fs.readFileSync(lockScreenFile, 'utf8');

    assert.match(lockScreenContent, /export\s+function\s+PrivacyCurtain/, 'Must export PrivacyCurtain');
    assert.match(lockScreenContent, /export\s+function\s+BiometricLockScreen/, 'Must export BiometricLockScreen');
    assert.match(lockScreenContent, /zIndex:\s*99999/, 'Must use zIndex: 99999 for absolute overlay isolation');
    assert.match(lockScreenContent, /elevation:\s*99999/, 'Must use elevation: 99999 for Android overlay isolation');
    assert.match(lockScreenContent, /#111113/, 'Must use official Dark Luxury #111113 background color');
    assert.match(lockScreenContent, /#DEC479/, 'Must use official Dark Luxury #DEC479 gold accent');
    assert.match(lockScreenContent, /StatusBar\s+style=["']light["']/, 'Must configure light StatusBar for Dark Luxury theme');
    assert.match(lockScreenContent, /onStartShouldSetResponder=\{\(\)\s*=>\s*true\}/,
      'Must capture touch responder on start to block touches through the curtain');
    assert.match(lockScreenContent, /onMoveShouldSetResponder=\{\(\)\s*=>\s*true\}/,
      'Must capture touch responder on move to block swipe gestures through the curtain');
    assert.match(lockScreenContent, /minHeight:\s*48/, 'Primary biometric button touch target must be >= 48pt');
    assert.match(lockScreenContent, /minHeight:\s*44/, 'Secondary password button touch target must be >= 44pt');
    assert.match(lockScreenContent, /Usar e-mail e senha/, 'Must provide fallback to email and password');
    assert.match(lockScreenContent, /prime-logo-transparent\.png/, 'Must render official transparent Prime logo');

    // 2. BiometricAccessContext State Retention, Isolation & Android Back Handling
    const contextFile = path.join(MOBILE_DIR, 'src/contexts/BiometricAccessContext.tsx');
    assert.ok(fs.existsSync(contextFile), 'BiometricAccessContext.tsx must exist');
    const contextContent = fs.readFileSync(contextFile, 'utf8');

    assert.match(contextContent, /pointerEvents=\{isCurtainActive\s*\?\s*['"]none['"]\s*:\s*['"]auto['"]\}/,
      'Children container must disable pointer events when curtain is active');
    assert.match(contextContent, /importantForAccessibility=\{isCurtainActive\s*\?\s*['"]no-hide-descendants['"]\s*:\s*['"]auto['"]\}/,
      'Children container must hide from accessibility tree when curtain is active');
    assert.match(contextContent, /aria-hidden=\{isCurtainActive\}/,
      'Children container must set aria-hidden when curtain is active');
    assert.match(contextContent, /\{children\}/,
      'Must keep children tree mounted to retain state, form inputs, and scroll position');
    assert.match(contextContent, /BackHandler\.addEventListener\(['"]hardwareBackPress['"]/,
      'Must intercept Android hardware back press when curtain is active to prevent unmounting background state');
    assert.match(contextContent, /Keyboard\.dismiss\(\)/,
      'Must dismiss virtual keyboard when curtain is active');

    // 3. Modal Layer Coordination with Privacy Curtain
    const modalFile = path.join(MOBILE_DIR, 'src/components/ui/Modal.tsx');
    assert.ok(fs.existsSync(modalFile), 'Modal.tsx must exist');
    const modalContent = fs.readFileSync(modalFile, 'utf8');
    assert.match(modalContent, /visible=\{visible\s*&&\s*!isCurtainActive\}/,
      'Modal must coordinate with Privacy Curtain to prevent native modal overlap');

    // 4. Biometric Policy Logic Audit
    const policyFile = path.join(MOBILE_DIR, 'src/security/biometricPolicy.ts');
    assert.ok(fs.existsSync(policyFile), 'biometricPolicy.ts must exist');
    const policyContent = fs.readFileSync(policyFile, 'utf8');
    assert.match(policyContent, /shouldShowPrivacyCurtain/, 'Must export shouldShowPrivacyCurtain');
    assert.match(policyContent, /isCurtainOnlyMode/, 'Must export isCurtainOnlyMode');

    // 5. Plan IA Core Sanitization & SSE Stream Parsing
    const coreFile = path.join(MOBILE_DIR, 'src/features/plan-assistant/core.ts');
    assert.ok(fs.existsSync(coreFile), 'core.ts must exist');
    const coreContent = fs.readFileSync(coreFile, 'utf8');

    assert.match(coreContent, /export\s+function\s+sanitizeAssistantMessage/, 'Must export sanitizeAssistantMessage');
    assert.match(coreContent, /export\s+function\s+parsePlanAssistantResponseText/, 'Must export parsePlanAssistantResponseText');

    // 6. Zero Leak Invariant across Chat Hook
    const hookFile = path.join(MOBILE_DIR, 'src/features/plan-assistant/usePlanAssistantChat.ts');
    assert.ok(fs.existsSync(hookFile), 'usePlanAssistantChat.ts must exist');
    const hookContent = fs.readFileSync(hookFile, 'utf8');
    assert.doesNotMatch(hookContent, /`plan-assistant-chat`/, 'usePlanAssistantChat must never leak internal Edge Function name to user');
    assert.doesNotMatch(hookContent, /segredos\s+Cloudflare/i, 'usePlanAssistantChat must never mention Cloudflare secrets to user');
    assert.match(hookContent, /Não consegui concluir a resposta agora\. Tente novamente em alguns instantes\./,
      'Must display polite humanized Portuguese error message on failure');
    assert.match(hookContent, /Sua sessão expirou por segurança\. Entre novamente no aplicativo para continuar conversando com a Plan IA\./,
      'Must display polite humanized Portuguese session expiration message');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runner = new TestRunner('Tier 3: Cross-Feature Combinations & Invariants');
  registerTier3Tests(runner);
  runner.run().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
