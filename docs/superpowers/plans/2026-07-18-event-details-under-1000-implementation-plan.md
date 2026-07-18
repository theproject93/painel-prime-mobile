# Plano de implementação — EventDetailsScreen abaixo de 1.000 linhas

## Regras globais

1. Trabalhar sempre a partir de `origin/main` atualizado.
2. Um PR por fase; não empilhar branches não mergeadas.
3. Começar cada nova função/componente com RED observável.
4. Não alterar valores JSX, copy, query, payload ou estilo durante a movimentação.
5. Não tocar Portal público, recepção offline, migrations ou configuração Expo.
6. Preservar `artifacts/`, `resultados_test_lab/`, `testlab-apk/` e `testlab-matrix.json` não versionados.
7. Não criar tag ou APK.

## PR 1 — governança e código estático

### Testes primeiro

- criar `eventDetailsSizeGovernance_test.ts`;
- caracterizar limite intermediário de 2.800 linhas;
- exigir que tipos/helpers/estilos não permaneçam inline depois da extração;
- observar RED.

### Implementação

- criar `eventDetailsTypes.ts` para tipos compartilhados;
- criar ou ampliar `eventDetailsUtils.ts` para helpers puros;
- criar `eventDetailsStyles.ts` copiando o `StyleSheet` literalmente;
- integrar imports e remover definições antigas;
- não mover componentes/tabs neste PR.

### Saída

- tela `<= 2.800` linhas;
- testes completos e `check:local` verdes;
- bundle Android no SHA do PR.

## PR 2 — hooks de ações

### Testes primeiro

- contrato estrutural proíbe funções de upload, timeline e command center na tela;
- testes puros caracterizam normalização e payloads onde aplicável.

### Implementação

- `useEventUploads.ts`: documento, foto principal, imagem de convite e foto de equipe;
- `useEventTimeline.ts`: criar item, aplicar sugestão e gerar sugestões híbridas;
- `useEventCommandCenter.ts`: carga, regras, status, incidente e resolução;
- callbacks recebem `eventId`, setters e recargas necessárias explicitamente.

### Saída

- tela `<= 2.200` linhas;
- mesmos estados de loading e mensagens de erro;
- nenhuma mudança em storage ou Supabase.

## PR 3 — tabs simples

### Componentes

- `NotesTab.tsx`;
- `TeamTab.tsx`;
- `TablesTab.tsx`;
- `InvitesTab.tsx`;
- `ReceptionTab.tsx`;
- `ClientPortalTab.tsx` apenas para o launcher autenticado existente;
- `PresentsTab.tsx`;
- `AnalyticsTab.tsx`;
- manter `MeetingCenter` existente.

### Regras

- cada tab recebe props tipadas;
- nenhum import de Supabase nas tabs;
- callbacks continuam definidos no container/hook;
- limite individual de 300 linhas.

### Saída

- tela `<= 1.650` linhas.

## PR 4 — tabs operacionais

### Componentes

- `TasksTab.tsx`;
- `BudgetTab.tsx`;
- `GuestsTab.tsx`;
- `TimelineTab.tsx`;
- `VendorsTab.tsx`;
- `DocumentsTab.tsx`.

### Regras

- extrair uma tab por vez dentro do PR, rodando teste focal e TypeScript após cada uma;
- manter formulários e handlers equivalentes;
- nenhum componente acessa Supabase diretamente;
- IDs técnicos continuam ocultos.

### Saída

- tela `<= 1.150` linhas.

## PR 5 — tabs complexas e meta final

### Componentes

- `OverviewTab.tsx`;
- `CommandTab.tsx`;
- `HistoryTab.tsx`;
- `EventDetailsShell.tsx` se a composição restante justificar.

### Governança final

- alterar orçamento da tela para `<= 1.000` linhas;
- manter cada tab `<= 300` linhas;
- impedir Supabase nas tabs;
- impedir regressão de helpers/estilos para o container.

### Validação final

- suíte Deno completa;
- `check:local`;
- bundle Android no SHA exato do PR;
- smoke físico completo antes de tag/release;
- registrar contagem antes/depois e inventário dos arquivos resultantes.

## Critério de conclusão

A Sprint 6 só estará concluída quando `EventDetailsScreen.tsx` tiver no máximo 1.000 linhas, for predominantemente orquestrador e todos os contratos protegidos passarem sem alteração observável da experiência.
