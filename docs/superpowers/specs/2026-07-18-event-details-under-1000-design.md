# EventDetailsScreen abaixo de 1.000 linhas

## Status

Aprovado pelo responsável em 18/07/2026.

## Problema

`apps/mobile/src/screens/EventDetailsScreen.tsx` possui 3.177 linhas mesmo após a extração dos contratos de filtros e carregamento paginado. A tela ainda concentra aproximadamente mil linhas de JSX das abas, centenas de linhas de projeções e métricas, ações remotas, uploads, helpers e estilos. Reduções de poucas dezenas de linhas melhoram algumas fronteiras, mas não tornam o arquivo compreensível por uma pessoa ou IA em um único contexto.

## Resultado obrigatório

- `EventDetailsScreen.tsx` terá no máximo 1.000 linhas; a faixa desejada é 700–900.
- Nenhum novo componente de aba ultrapassará 300 linhas.
- O arquivo principal será um orquestrador de rota, evento, aba ativa, hooks e composição.
- A decomposição não alterará UI, textos, consultas, payloads, navegação ou regras de negócio.
- O total de linhas do projeto pode aumentar por tipos e interfaces explícitas; o indicador principal é responsabilidade e tamanho por unidade.

## Fronteiras protegidas

Esta refatoração é exclusiva da área autenticada de detalhes do evento no aplicativo Android. Não alterar:

- `ClientPortalScreen`, contratos do Portal do Cliente ou links públicos;
- PWA/scanner de recepção, fila offline, token ou payload de recepção;
- banco, migrations, RLS, Edge Functions ou schemas;
- configuração Expo, dependências nativas, tags ou processo de APK;
- consultas ou colunas para otimizar egress; isso exige medição e PR separado.

## Arquitetura escolhida

Será aplicado um strangler interno: a tela existente continua como entrada e entrega uma aba de cada vez a componentes e hooks tipados. Não haverá reescrita simultânea.

```text
EventDetailsScreen.tsx
├── hooks de dados e ações
├── EventDetailsShell
└── registro de tabs
    ├── OverviewTab
    ├── CommandTab
    ├── HistoryTab
    ├── TasksTab
    ├── BudgetTab
    └── demais tabs
```

### Direção de dependência

- A tela pode importar hooks, tabs, tipos e componentes compartilhados.
- Tabs recebem dados e callbacks por props; não importam Supabase.
- Hooks podem importar clientes de dados e storage, mas não renderizam UI.
- Helpers puros não importam React, Expo, React Native ou Supabase.
- Componentes compartilhados não importam a tela.

## Alternativas rejeitadas

### Um único PR grande

Reduziria o arquivo rapidamente, mas produziria um diff difícil de revisar, smoke e reverter. Rejeitado pelo risco operacional.

### Apenas micro-hooks

Tem baixo risco local, mas demora excessivamente e deixa o JSX monolítico. Rejeitado como estratégia principal; hooks continuam sendo usados dentro de recortes verticais.

### Componentes com um único objeto gigante de props

Moveria linhas sem criar contratos legíveis e manteria acoplamento oculto. Rejeitado; props serão agrupadas apenas por responsabilidade (`data`, `actions`, `state`) e tipadas nominalmente.

## Sequência de migração

### PR 1 — governança, tipos, helpers e estilos

- criar teste de orçamento de linhas;
- mover tipos e helpers puros que não dependem do componente;
- mover o `StyleSheet` sem alterar chaves ou valores;
- meta intermediária: no máximo 2.800 linhas.

### PR 2 — ações e hooks coesos

- `useEventUploads`;
- `useEventTimeline`;
- `useEventCommandCenter`;
- manter mensagens, estados e queries literais;
- meta intermediária: no máximo 2.200 linhas.

### PR 3 — abas simples

- notas, equipe, mesas, convites, recepção, portal, reuniões, presentes e analytics;
- componentes somente de apresentação/orquestração local;
- meta intermediária: no máximo 1.650 linhas.

### PR 4 — abas operacionais

- tarefas, orçamento, convidados, cronograma, fornecedores e documentos;
- formulários e callbacks explícitos;
- meta intermediária: no máximo 1.150 linhas.

### PR 5 — abas complexas e container final

- Overview, Command e History;
- registro tipado de tabs e shell final;
- remover resíduos e impor limite final de 1.000 linhas;
- faixa desejada: 700–900 linhas.

## Estratégia de compatibilidade

Cada extração seguirá Parallel Change:

1. caracterizar o contrato atual com teste falhando;
2. criar componente/hook com a interface desejada;
3. conectar a tela mantendo nomes e valores existentes;
4. confirmar que o bloco antigo não permanece;
5. executar testes, TypeScript, Expo introspect e bundle Android;
6. fazer PR e merge isolados.

Não haverá abstração genérica para tabs antes de existirem pelo menos dois consumidores reais. Não haverá alteração de copy ou “limpeza” oportunista.

## Governança automatizada

Durante a migração, um orçamento intermediário por PR impedirá crescimento do monólito. No PR final, o teste exigirá:

- `EventDetailsScreen.tsx <= 1.000` linhas;
- cada arquivo `*Tab.tsx <= 300` linhas;
- tabs sem import direto de `supabase`;
- tela sem implementações inline de upload e consultas paginadas;
- imports protegidos do Portal e recepção ausentes do diff.

## Validação e promoção

- testes Deno completos;
- `pnpm --filter @painel-prime/mobile run check:local`;
- `git diff --check`, anti-mojibake, BOM e NUL;
- bundle Android no `headRefOid` publicado de cada PR;
- nenhum build/tag de APK durante a refatoração;
- smoke físico obrigatório no SHA final antes de qualquer nova tag Android.

Sem dispositivo ADB, os PRs podem ser integrados ao `main` porque `main` não publica APK automaticamente, mas serão descritos somente como validação por código/bundle. O aplicativo de produção permanece no artefato já publicado.

## Rollback

Cada PR representa uma fronteira independente e pode ser revertido por um único merge commit. Se uma extração produzir diferença visual, runtime ou de dados, o PR não avança para a próxima fase.
