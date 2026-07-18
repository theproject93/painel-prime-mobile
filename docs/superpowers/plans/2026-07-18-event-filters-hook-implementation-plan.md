# Sprint 6 — extração do `useEventFilters`

## Objetivo

Transformar o módulo puro de filtros já integrado em uma fronteira React explícita. O novo hook deve ser o único proprietário dos estados usados para filtrar convidados, fornecedores, orçamento e documentos, além de produzir as cinco listas derivadas e as categorias documentais.

## Dentro do hook

- `guestFilter`, `guestSearch` e `guestSort`;
- `vendorSearch` e `vendorSort`;
- `budgetVendorFilter` e `budgetStatusFilter`;
- `documentSearch`, `documentVendorFilter`, `documentCategoryFilter` e `documentReceiptFilterId`;
- `filteredGuests`, `filteredVendors`, `filteredExpenses`, `filteredPayments` e `filteredDocuments`;
- `documentCategories`;
- setters correspondentes, mantendo a mesma semântica de `useState`.

## Fora do hook

- entradas temporárias de formulários (`budgetVendorInput` e `documentVendorInput`);
- paginação visual (`visible`);
- filtro de tarefas (`taskView`), que depende da regra temporal de atraso e terá contrato próprio;
- carregamento Supabase, uploads, mutações, navegação e UI.

## Sequência TDD

1. Adicionar um teste de governança que exija `useEventFilters` na tela e impeça que os estados extraídos permaneçam declarados no monólito.
2. Observar RED antes da criação do hook.
3. Implementar o hook com tipos estruturais genéricos e reutilizar exclusivamente os helpers testados.
4. Integrar por desestruturação, preservando os nomes locais consumidos pela UI.
5. Confirmar GREEN e rodar a suíte mobile completa.

## Critérios de aceite

- `EventDetailsScreen` não declara os 11 estados de filtro extraídos;
- o hook não importa Supabase, Expo ou React Native;
- os helpers puros continuam sendo a única implementação das regras;
- nenhum nome usado pelos controles e callbacks da tela muda;
- `check:local`, bundle Android, encoding e diff passam;
- nenhuma dependência, configuração, consulta ou rota é alterada.
