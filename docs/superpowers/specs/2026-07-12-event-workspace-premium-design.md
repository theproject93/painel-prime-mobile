# Workspace Premium de Eventos — Design

## Objetivo

Transformar as áreas internas de um evento em uma experiência de consulta e ação rápida para assessoras. A tela deixa de apresentar formulários permanentes e passa a seguir a hierarquia já validada em **Meu caixa**: contexto, números úteis, uma ação principal e uma lista legível.

## Princípios

1. **Ver antes de editar:** a superfície padrão mostra situação e próximos passos; campos aparecem somente após ação explícita.
2. **Uma ação principal por área:** “Nova tarefa”, “Adicionar convidado”, “Vincular fornecedor” etc.
3. **Linguagem de assessoria:** esconder IDs, enums e termos técnicos; preservar internamente todas as relações com Supabase, Papermark, Documenso e R2.
4. **Ações em contexto:** confirmar, concluir, pagar ou abrir ficam no item correspondente. Exclusão continua protegida por confirmação.
5. **Consistência premium:** fundo quente, cards claros, dourado como ênfase, ícones semânticos, espaços generosos e estados vazios orientados.
6. **Acessibilidade:** área de toque mínima, rótulos explícitos e glifos de ícone fora da árvore do TalkBack.

## Arquitetura visual

Cada módulo usa um shell comum:

- cabeçalho com ícone, nome e explicação curta;
- faixa de métricas compactas;
- CTA primário escuro/dourado;
- busca e filtros em chips quando necessários;
- cards de lista com título, metadados humanos, status e ações;
- modal rolável e protegido pelo teclado para criação/edição.

Os módulos prioritários desta rodada são Tarefas, Convidados, Fornecedores, Orçamento, Cronograma, Documentos, Notas, Equipe e Mesas. Reuniões permanece como está por já atender ao padrão. Catálogo, Portal e Relatório final continuam como integrações/telas especializadas.

## Sprints

### Sprint 1 — Fundação e achados do Test Lab

- centralizar corretamente `PrimeLogoLoader` nas variantes de tela;
- proteger `ScrollView` com safe area fixa;
- fragmentar a sessão do SecureStore com migração legada;
- corrigir rótulos de acessibilidade dos ícones-base.

### Sprint 2 — Componentes do workspace

- criar `EventModuleShell`, métricas, chips, item de lista e `EventFormSheet`;
- manter componentes independentes de Supabase e testáveis por props;
- criar helpers puros para labels/status/resumos.

### Sprint 3 — Pessoas e execução

- redesenhar Tarefas e Convidados;
- mover formulários para sheets;
- expor progresso, pendências e ações frequentes sem batch actions destrutivas na frente.

### Sprint 4 — Operação do evento

- redesenhar Fornecedores, Cronograma, Equipe, Notas e Mesas;
- preservar mapa visual de mesas e uploads/links existentes;
- apresentar horários, contatos e ocupação em linguagem humana.

### Sprint 5 — Dinheiro e documentos

- redesenhar Orçamento e Documentos;
- manter vínculos com fornecedores, recibos e R2;
- esconder IDs técnicos atrás de seletores e ações contextuais.

### Sprint 6 — Qualidade e release

- validar encoding, typecheck, Expo config e testes;
- smoke físico das áreas alteradas com Metro/Expo Go e logcat limpo;
- espelhar blobs no monorepo;
- gerar apenas um APK após todos os PRs estarem aprovados.

## Estados e erros

- carregamento bloqueante usa `PrimeLogoLoader`; `ActivityIndicator` fica apenas em ação inline;
- estado vazio explica o benefício e oferece a ação apropriada;
- erros permanecem visíveis, em linguagem direta, sem ocultar falhas do Supabase;
- toda operação destrutiva exige confirmação e nunca é CTA principal.

## Critérios de aceite

- nenhum formulário de criação fica permanentemente aberto nas nove áreas priorizadas;
- nenhuma tela expõe `vendor_id`, enum cru ou placeholder técnico como ação principal;
- loader de tela fica centralizado horizontal e verticalmente;
- conteúdo rolado não invade a status bar;
- login persistido não gera warning de valor maior que 2048 bytes;
- telas prioritárias abrem, navegam e executam ações sem RedBox no Android conectado;
- um único APK é criado ao final.
