# Linguagem contextual por modalidade de evento

## Objetivo

Eliminar referências incorretas a casal, noivos, noiva ou noivo nas áreas autenticadas do Painel Prime quando o evento for de debutante, aniversário ou corporativo. Android e Web devem derivar a mesma linguagem a partir de `event_type`, com fallback neutro quando o tipo estiver ausente ou for desconhecido.

## Fronteira de segurança

Esta entrega altera somente interfaces autenticadas de operação e CRM. Não altera Portal do Cliente, convites públicos, sites publicados, rotas `/noivos`, landing pages ou conteúdo de marketing. Categorias reais de fornecedores, como `Beleza/Dia da noiva`, também não são renomeadas.

## Fonte única

O pacote `@painel-prime/app` receberá um módulo puro de domínio para:

1. normalizar aliases históricos de modalidade;
2. resolver a persona correspondente;
3. fornecer frases operacionais completas, evitando que cada tela concatene artigos e substantivos por conta própria.

O helper não consulta banco, não depende de React e pode ser testado com Deno. Android e Web devem consumir esse módulo; não haverá duas tabelas de textos independentes.

## Modalidades e linguagem

| Tipo normalizado | Aliases aceitos | Persona | Exemplos operacionais |
| --- | --- | --- | --- |
| `wedding` | `wedding`, `casamento` | casal / noivos | Nome do casal; Quanto o casal pode investir; Entrada dos noivos |
| `debutante` | `debutante`, `15_anos`, `15 anos`, `quinze_anos`, `quinze anos` | debutante | Nome da debutante; Quanto foi reservado para a debutante; Entrada da debutante |
| `birthday` | `birthday`, `aniversario`, `aniversário`, `aniversario_infantil`, `aniversário infantil` | aniversariante | Nome do aniversariante; Orçamento disponível para o aniversário; Entrada do aniversariante |
| `corporate` | `corporate`, `corporativo`, `empresa`, `empresarial` | cliente / empresa | Nome do cliente ou empresa; Quanto o cliente pode investir; Chegada dos representantes |
| `generic` | vazio ou desconhecido | cliente / evento | Nome do cliente; Orçamento disponível para o evento; Entrada principal |

O fallback é deliberadamente `generic`; um valor desconhecido nunca deve assumir casamento.

## API proposta

O módulo exportará:

- `InternalEventKind`, incluindo `generic`;
- `normalizeInternalEventKind(value)`;
- `getEventPersonaCopy(value)`.

O retorno de `getEventPersonaCopy` será um objeto imutável com frases completas usadas na interface, incluindo:

- rótulo da modalidade;
- nome singular e coletivo da persona;
- placeholder do responsável principal;
- título e descrição de orçamento;
- exemplo de atividade do cronograma;
- rótulos adequados para cliente, responsáveis e participantes.

Frases completas são preferidas a propriedades gramaticais soltas. Isso evita construções incorretas como `do debutante`, artigos inadequados e divergência entre plataformas.

## Integração Android

`EventDetailsScreen` usará `event.event_type` para resolver a persona uma vez por renderização. A edição básica, o resumo financeiro, orçamento e exemplos operacionais substituirão os textos matrimoniais pela cópia resolvida.

O tipo carregado do evento precisa incluir `event_type` na tipagem e na consulta existente. Telas de CRM usarão `crm_clients.event_type` quando houver modalidade definida; na ausência dela, usarão a linguagem genérica.

Não haverá alteração de schema, migration ou dependência nativa.

## Integração Web

Componentes autenticados de detalhes do evento receberão a persona ou o `event_type` já disponível no agregado do evento. Serão corrigidos os textos operacionais com pressuposto matrimonial onde o contexto é conhecido.

Fluxos globais sem evento selecionado permanecerão com linguagem neutra. O cadastro comercial não criará automaticamente semântica de noiva/noivo para modalidades não matrimoniais. Estruturas históricas do banco não serão removidas nesta entrega.

## Compatibilidade

- Registros novos já usam `wedding`, `birthday`, `debutante` e `corporate`.
- Registros antigos em português serão normalizados no cliente.
- Valores desconhecidos ou `null` produzirão `generic`.
- Nenhum dado existente será reescrito.
- O módulo público existente de labels do Portal não será modificado.

## Testes

O ciclo TDD começa com testes falhando para:

1. os quatro tipos canônicos;
2. aliases em português, com e sem acento;
3. `null`, string vazia e tipo desconhecido retornando `generic`;
4. frases financeiras e placeholders específicos;
5. garantia explícita de que fallback não contém `casal`, `noivo` ou `noiva`.

Depois da implementação serão executados os testes do helper, suites Web relacionadas, validação TypeScript, Expo introspect, `git diff --check`, BOM/NUL e varredura de mojibake.

## Smoke e release

Haverá um único smoke físico no Expo Go, no SHA final do PR mobile. O roteiro verificará:

1. um casamento, que deve manter linguagem de casal/noivos;
2. um evento não matrimonial disponível na conta de teste, que deve exibir a persona correta;
3. ausência de RedBox, crash ou erro React Native no logcat.

Após PRs mobile e monorepo aprovados, será criada uma única tag `android-v1.4.1-build9`. Somente ela poderá disparar o único APK, com assinatura, checksum, notas de release e distribuição pelo Firebase.

## Fora de escopo

- Alterar Portal do Cliente ou experiências públicas.
- Migrar ou renomear colunas históricas como `couple_name`.
- Inferir gênero do aniversariante.
- Criar novas modalidades.
- Refatorar conteúdo de marketing.
