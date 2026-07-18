# Sprint 6 — extração do `useEventDetailsData`

## Objetivo

Retirar de `EventDetailsScreen` apenas o estado e a orquestração de leitura paginada das dez coleções internas do evento. O hook deve preservar literalmente tabelas, `select('*')`, filtro por `event_id`, ordenação, tamanho de página, deduplicação e carregamento por aba.

## Fronteira

O hook será responsável por:

- `data`, `loaded`, `paging`, `loadingTab`, `loadingMore` e erro compartilhado;
- leitura de uma página, reset/append, carga das dependências da aba e “carregar mais”;
- disparo da carga da aba quando o evento inicial terminar;
- expor `setData`, `setError`, `loadTab` e `loadMoreKey` aos fluxos existentes.

Permanecem na tela:

- leitura e edição do registro principal `events`;
- mutações, uploads e ações de domínio;
- catálogos, diretório de equipe e torre de comando;
- filtros, paginação visual e renderização.

## Contratos invariáveis

- página de 50 registros;
- pagamentos ordenados por `paid_at`; demais coleções por `created_at`;
- ordenação descendente e `.range(from, to)` inclusivo;
- append preserva a linha já carregada quando o mesmo `id` reaparece;
- `force=false` não recarrega chaves já marcadas como carregadas;
- nenhuma mudança de coluna, tabela, aba, egress ou tratamento de erro.

## TDD e validação

1. testes puros falham pela ausência de `eventDetailsData.ts`;
2. teste estrutural falha enquanto estado/funções permanecem na tela;
3. implementar contratos puros e depois o hook mínimo;
4. integrar por desestruturação, mantendo os nomes usados por toda a tela;
5. executar suíte Deno, `check:local`, bundle Android e auditoria de encoding;
6. publicar PR independente e registrar a ausência de smoke físico caso o ADB continue vazio.
