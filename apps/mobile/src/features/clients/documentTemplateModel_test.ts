import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  createDefaultMobileDocumentTemplate,
  normalizeMobileDocumentTemplate,
  serializeMobileDocumentTemplate,
} from './documentTemplateModel.ts';

Deno.test('creates editable defaults compatible with budget and contract templates', () => {
  const budget = createDefaultMobileDocumentTemplate('quote');
  const contract = createDefaultMobileDocumentTemplate('contract');
  assertEquals(budget.format, 'visual_blocks');
  assertEquals(contract.format, 'visual_blocks');
  assert(budget.blocks.some((block) => block.type === 'investment'));
  assert(contract.blocks.some((block) => block.type === 'signatures'));
});

Deno.test('normalizes stored web templates and serializes a stable mobile version', () => {
  const normalized = normalizeMobileDocumentTemplate(JSON.stringify({
    format: 'visual_blocks',
    version: 1,
    kind: 'quote',
    style: { accentColor: '#123456', headerAlign: 'center' },
    blocks: [{ id: 'intro', type: 'intro', title: 'Boas-vindas', content: 'Olá {{nome_cliente}}', enabled: true }],
  }), 'quote');

  assertEquals(normalized.style.accentColor, '#123456');
  assertEquals(normalized.style.headerAlign, 'center');
  assertEquals(normalized.blocks[0]?.content, 'Olá {{nome_cliente}}');
  assertEquals(JSON.parse(serializeMobileDocumentTemplate(normalized)).format, 'visual_blocks');
});
