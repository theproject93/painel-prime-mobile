# Painel Prime Mobile 1.0 — Design aprovado

## Objetivo

Transformar o aplicativo Android em uma experiência premium e direta para assessoras de eventos. O mobile deve priorizar a próxima ação da usuária, sem reproduzir dashboards administrativos da aplicação WEB.

## Princípios

- Linguagem humana: nenhuma mensagem de banco, enum ou termo técnico pode chegar à interface.
- Ação antes de análise: cada tela deve ter uma ação principal clara e esconder recursos avançados em detalhes.
- Uma tarefa por vez: formulários extensos aparecem em modal ou folha, nunca empilhados.
- Honestidade: estados sem dados não exibem gráficos, rankings ou previsões artificiais.
- Backend compartilhado: Papermark, Documenso, WEB, webhooks, tabelas e migrations permanecem canônicos.
- Android primeiro: safe area, fonte ampliada, teclado, listas longas e telas estreitas fazem parte do aceite.
- Visual premium com contenção: base quente, contraste escuro, dourado para ações e um único gesto visual memorável por tela.

## Arquitetura de produto

### Conta e Mais

`Mais` contém somente Perfil, Configurações úteis e Sair. Métricas internas, limpeza em massa, Planejamento e ferramentas administrativas não aparecem para assessoras. Checkouts de teste e telas operacionais ficam restritos a super administradores.

### Clientes

A tela principal apresenta uma lista vertical e agrupa as etapas internas em uma jornada compreensível:

1. Novo contato
2. Preparar ou acompanhar orçamento
3. Preparar ou acompanhar contrato
4. Cliente fechado ou perdido

Forecast, prioridade, execução do CRM, histórico e LGPD deixam a superfície principal. Orçamentos usam `crm-send-budget`/Papermark e contratos usam Documenso através das Edge Functions existentes. O mobile não reimplementa integrações externas.

### Meu caixa

O módulo passa a se chamar `Meu caixa` e explicita que representa as finanças da assessoria. Saldo, entradas e despesas formam um resumo compacto. Um controle `Entrada | Despesa` abre somente o formulário escolhido. Analytics sem dados são substituídos por orientação e uma chamada para ação.

### Eventos

O seletor privilegia Resumo, Tarefas, Convidados, Reuniões, Fornecedores e Documentos. Áreas menos frequentes ficam em `Mais áreas`. A Torre de Comando autenticada é removida apenas do mobile; portais públicos, WEB e estruturas de banco permanecem intactos.

### Mesas, fornecedores e eventos

Mesas ganha loading com timeout, erro recuperável e orientação de primeiro uso. Fornecedores suporta fonte ampliada e ações que quebram linha. Eventos traduz estados, reduz cards e afasta operações destrutivas da navegação principal.

### Loading e biometria

Loadings de tela usam o logotipo do Painel Prime com brilho diagonal implementado com `Animated`, sem `expo-linear-gradient`. Spinners de ações curtas permanecem locais.

Biometria protege uma sessão Supabase já persistida; nenhuma senha é armazenada. A ativação é explícita em Configurações, requer autenticação biométrica válida e oferece retorno seguro ao login por senha.

## Entrega e release

- Uma branch e um PR mobile acumulam commits independentes por sprint.
- Cada sprint passa por tipagem, config, encoding e smoke no Android via Expo Go.
- Nenhum merge intermediário em `main`, evitando builds de APK repetidos.
- No final, os blobs mobile são espelhados no monorepo conforme `AI_RULES.md`.
- O único merge mobile dispara um único APK.
- Release final: `versionName 1.0.0`, `versionCode` superior ao APK anterior e notas de lançamento de produto final.
- Releases antigas do Firebase só são removidas depois de instalar e validar o APK final.

## Não objetivos

- Remover recursos da aplicação WEB.
- Apagar migrations, tabelas ou webhooks de Papermark, Documenso ou Torre pública.
- Armazenar credenciais de login para simular biometria.
- Introduzir bibliotecas visuais incompatíveis com Expo SDK 54/Fabric.

## Critérios globais de aceite

- `pnpm --filter @painel-prime/mobile run validate` passa.
- Testes de comportamento e governança passam.
- Zero mojibake, BOM ou NUL nos arquivos alterados.
- `git diff --check` limpo.
- Nenhuma mensagem técnica de Postgres aparece nas jornadas auditadas.
- Smoke real comprova Início, Eventos, Clientes, Meu caixa, Fornecedores, Mais e áreas essenciais do evento.
