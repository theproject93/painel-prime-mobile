# Sprint 6 — plano de implementação dos filtros do detalhe de evento

## Resultado esperado

`EventDetailsScreen` delega cinco transformações de listas a um módulo puro e testado. O comportamento visível permanece idêntico e não há mudança de I/O.

## Passo 1 — caracterizar o comportamento atual

1. Criar `eventDetailsFilters_test.ts` antes do módulo de produção.
2. Usar registros com campos extras para provar preservação dos objetos.
3. Cobrir filtros individualmente e em combinação.
4. Confirmar RED porque o módulo ainda não existe.

## Passo 2 — implementar o menor módulo puro

1. Declarar tipos exportados somente para os valores dos filtros e ordenações.
2. Usar tipos estruturais genéricos para não duplicar o schema completo das tabelas.
3. Reproduzir literalmente as regras atuais de normalização, fallback e ordenação.
4. Não importar React, Supabase, Expo ou React Native.
5. Confirmar GREEN no teste focal.

## Passo 3 — integrar sem ampliar escopo

1. Importar os cinco helpers em `EventDetailsScreen.tsx`.
2. Manter os mesmos `useMemo` e suas dependências.
3. Substituir apenas o corpo das transformações inline.
4. Não renomear estado, alterar controles, consultas ou componentes.
5. Rodar novamente o teste focal e TypeScript.

## Passo 4 — gates locais

Executar, nesta ordem:

1. `deno test apps/mobile/src/features/events/eventDetailsFilters_test.ts`;
2. `pnpm --filter @painel-prime/mobile run check:local`;
3. `git diff --check`;
4. varredura anti-mojibake definida em `AI_RULES.md`;
5. inspeção de BOM e bytes NUL nos arquivos alterados.

Como a integração muda código executado em runtime, também deve haver bundle e smoke Android no SHA publicado do PR. Caso não exista dispositivo conectado, registrar claramente que somente os gates por código foram executados e não promover a entrega como smoke físico aprovado.

## Passo 5 — entrega GitOps

1. Revisar o diff e confirmar que somente arquivos mobile internos e documentação entraram.
2. Commitar na branch `codex/sprint6-event-details-filters`.
3. Fazer push e abrir PR no repositório `painel-prime-mobile`.
4. Confirmar que o `headRefOid` do PR é o SHA testado.
5. Acompanhar o CI antes de qualquer merge.

## Critérios de aceite

- testes caracterizam todas as regras extraídas;
- o array de entrada não é mutado;
- TypeScript e Expo introspect passam;
- nenhuma dependência ou lockfile muda;
- nenhuma consulta ou payload Supabase muda;
- nenhum arquivo público, de recepção ou de release muda;
- PR contém evidências dos gates e a situação real do smoke físico.
