# Sprint 6 — contrato do filtro de tarefas

## Objetivo

Concluir a fronteira `useEventFilters` movendo `taskView` e `filteredTasks` para o hook sem mover ou reinterpretar as regras de calendário usadas pelo restante da tela.

## Contrato

O helper puro `filterEventTasks` recebe as tarefas, a visão selecionada e um predicado `isOverdue`. As regras permanecem:

- `completed`: somente tarefas concluídas;
- `urgent`: não concluídas e com prioridade `urgent`;
- `overdue`: não concluídas para as quais o predicado retorna verdadeiro;
- `pending`: não concluídas, não urgentes e não atrasadas.

O predicado é injetado para que os testes não dependam do relógio e para que `EventDetailsScreen` continue usando sua regra temporal atual. Paginação visual e agrupamentos de resumo permanecem fora do hook.

## Validação

1. observar RED para o helper ausente e o estado ainda local;
2. implementar o helper e conectá-lo ao hook;
3. remover apenas o estado e o `useMemo` equivalentes da tela;
4. executar testes Deno completos, `check:local`, bundle Android e gates de encoding;
5. entregar em PR independente, sem UI, I/O, banco ou configuração.
