# Sprint 6 — contratos de filtros do detalhe de evento

## Objetivo

Iniciar a decomposição de `EventDetailsScreen.tsx` por uma fronteira de baixo risco: retirar da tela somente a transformação pura de listas usada por convidados, fornecedores, despesas, pagamentos e documentos. A entrega deve reduzir responsabilidades do monólito sem mudar consultas Supabase, paginação, estado React, navegação, aparência ou ações de escrita.

## Inventário do monólito

`EventDetailsScreen` concentra atualmente:

- seleção e renderização de 17 módulos públicos da área autenticada mais o módulo interno `command`;
- carregamento paginado de 10 conjuntos de dados (`tasks`, `expenses`, `payments`, `guests`, `timeline`, `vendors`, `documents`, `notes`, `team` e `tables`);
- filtros, ordenação, métricas, alertas e projeções derivadas;
- mutações CRUD, uploads privados, compartilhamento, WhatsApp e integrações da recepção;
- formulários, modais e renderização de todas as abas.

Esse acoplamento torna qualquer alteração difícil de testar isoladamente. A primeira fronteira escolhida não executa I/O e pode ser caracterizada com entradas e saídas determinísticas.

## Escopo desta entrega

Criar `src/features/events/eventDetailsFilters.ts` com cinco operações puras:

1. filtrar convidados por RSVP e busca em nome/telefone, ordenando por nome;
2. buscar fornecedores por nome/categoria e ordenar por nome ou status;
3. filtrar despesas por fornecedor e status;
4. manter somente pagamentos pertencentes às despesas visíveis;
5. filtrar documentos por recibo, fornecedor, categoria e busca em nome/categoria.

Cada função será genérica sobre um contrato estrutural mínimo. Ela devolverá os próprios objetos recebidos, preservando campos adicionais e sem modificar o array de origem.

## Contratos de compatibilidade

- Espaços externos dos termos e IDs de filtro continuam ignorados com `trim()`.
- Busca continua sem distinguir maiúsculas de minúsculas.
- RSVP ausente continua equivalente a `pending`.
- Status ausente de despesa continua equivalente a `pending`.
- Categoria documental continua com comparação exata, sem distinguir caixa.
- Ordenações por nome continuam usando `localeCompare` sobre a forma em minúsculas.
- Ordenação de fornecedor por status continua comparando a string original ou vazia.
- Pagamentos sem `expense_id` visível continuam ocultos.
- Nenhuma função altera a ordem do array de entrada; somente as ordenações criam cópia.

## Fronteiras protegidas

Esta sprint é exclusiva do aplicativo autenticado no repositório `painel-prime-mobile`. Não altera:

- Portal do Cliente, sites ou convites públicos;
- scanner/PWA de recepção e seus contratos offline;
- banco, migrations, RLS ou Edge Functions;
- formato de dados, seleção de colunas ou quantidade de egress;
- configuração Expo, dependências nativas ou processo de release.

## Estratégia de testes

Os helpers serão cobertos por Deno, seguindo o padrão `*_test.ts` já usado no aplicativo. Os testes caracterizam:

- normalização de busca e fallbacks de status;
- as três ordenações de fornecedores e as duas de convidados;
- combinação dos filtros financeiros e vínculo despesa/pagamento;
- combinação dos filtros documentais;
- preservação da entrada e de campos que o helper não conhece.

O ciclo deve observar RED antes da implementação e GREEN após a integração. A validação final inclui teste focal, TypeScript, Expo introspect, `check:local`, `git diff --check`, BOM/NUL e varredura anti-mojibake.

## Próximos recortes

Esta entrega não cria um hook abrangente. Depois que os contratos puros estiverem protegidos, recortes separados podem extrair filtros de tarefas, paginação/carregamento, comandos de mutação e renderizadores de módulos. Consultas de egress devem ser tratadas em sprint própria, com medição e contratos de payload, para não misturar otimização de dados com refatoração estrutural.
