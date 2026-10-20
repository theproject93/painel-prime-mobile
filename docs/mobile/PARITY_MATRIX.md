# Matriz de Paridade Web vs. Android (Painel Prime)

**Versão:** 1.0.0 — Outubro de 2026  
**Status:** Documento Oficial de Arquitetura e Engenharia de Produto  
**Alvo Mobile:** `theproject93/painel-prime-mobile` (`apps/mobile`)  
**Package Android:** `br.com.painelprime.app`  
**Referência Web:** `apps/web` (Next.js 15 App Router)  

---

## 1. Sumário Executivo & Estatísticas Globais

Uma auditoria exaustiva entre a base de código Web (`apps/web/src/app`) e a base de código Mobile (`apps/mobile/app`) identificou um total de **88 rotas Web** e **35 rotas/telas no Mobile** (expandindo a contagem inicial de 27 rotas/telas após a incorporação da Onda 1 de paridade com 8 novas telas).

A plataforma Web recebeu nos últimos ciclos implementações de ponta em inteligência artificial conversacional (Plan IA), mensageria empresarial multi-tenant via WhatsApp (Meta Cloud API Graph v20.0), automação de cortejo nupcial/debutantes, geração executiva de atas com Amazon Bedrock e faturamento pré-pago via InfinitePay. Com a conclusão da Onda 1 de paridade móvel, o aplicativo consolidou a camada de navegação e incorporou com sucesso os 5 motores de missão crítica (Padrinhos, RSVP Inbox, MeetingCenter & Atas, Mapa de Mesas Touch e SuperBilling com InfinitePay), elevando o total de telas móveis operacionais de 27 para 35.

### 1.1 Resumo Quantitativo por Classificação

| Classificação de Paridade | Quantidade de Rotas Web | % do Total Web | Ação Requerida no Mobile |
| :--- | :---: | :---: | :--- |
| **Implemented** (Paridade Ativa) | 26 | 29.5% | Manter, refinar e monitorar componentes nativos |
| **Dedicated / Native Difference** | 7 | 8.0% | Adaptado para affordances nativas (Tabs, Modais, PanResponder) |
| **Missing / Planned (P0 — Crítico)** | 6 | 6.8% | Operação em campo: Recepção/Check-in e Torre do Dia |
| **Missing / Planned (P1 — Alto)** | 14 | 15.9% | Implementação subsequente (Milestone 4 / Onda 2) |
| **Missing / Planned (P2 — Médio)** | 6 | 6.8% | Backlog de conveniência móvel |
| **Intentionally Web-Only (SEO / Mkt)** | 15 | 17.0% | Nenhuma ação (exclusivo Web/Landing pages) |
| **Intentionally Web-Only (Portal / Sites)** | 12 | 13.6% | Manter via Web; mobile oferece geração de links/deep links |
| **Internal / Redirect / Test** | 2 | 2.3% | Nenhuma ação (rotas técnicas da Web) |
| **TOTAL** | **88** | **100.0%** | **47 rotas elegíveis para ecossistema móvel** |

---

## 2. Matriz Exaustiva das 88 Rotas Web vs. Mobile

Abaixo está o mapeamento detalhado de cada rota da Web, seu caminho físico em `apps/web/src/app`, status no Mobile, categoria funcional, nível de prioridade e estratégia de migração técnica.

### Legenda de Prioridades:
- **P0 (Crítico)**: Funcionalidade central de operação do cerimonialista que bloqueia o uso exclusivo do app em campo.
- **P1 (Alto)**: Funcionalidade analítica ou de gestão avançada que enriquece a experiência móvel.
- **P2 (Médio)**: Fluxo secundário ou de conveniência (ex: recuperação nativa de senha, central de ajuda).
- **Web-Only**: Rota mantida deliberadamente apenas no ambiente web por razões de SEO, marketing ou público final de convidados.

| # | Rota Web (`webRoute`) | Arquivo Web (`webFile`) | Categoria | Rota Mobile Correspondente | Status de Paridade | Prioridade | Estratégia de Migração / Arquitetura Mobile |
| :-: | :--- | :--- | :--- | :--- | :--- | :-: | :--- |
| 1 | `/` | `page.tsx` | Marketing / Institucional | `index.tsx` | Dedicated / Native Difference | N/A | No mobile, a raiz avalia autenticação (`useAuth`) e despacha para `(app)/(tabs)/dashboard` ou `(public)/login`. |
| 2 | `/login` | `(auth)/login/page.tsx` | Autenticação | `(public)/login.tsx` | Implemented | Concluído | Tela nativa com campos de e-mail/senha, validação, logo animado e transição suave. |
| 3 | `/cadastro` | `(auth)/cadastro/page.tsx` | Autenticação | `(public)/cadastro.tsx` | Implemented | Concluído | Cadastro de assessoria com seleção de perfil e integração Supabase Auth. |
| 4 | `/recuperar-senha` | `(auth)/recuperar-senha/page.tsx` | Autenticação | *Nenhum* | Missing / Planned | P2 | Criar `(public)/recuperar-senha.tsx` com `supabase.auth.resetPasswordForEmail()`. |
| 5 | `/atualizar-senha` | `(auth)/atualizar-senha/page.tsx` | Autenticação | *Nenhum* | Missing / Planned | P2 | Criar `(public)/atualizar-senha.tsx` capturando token de recuperação via deep link `painelprime://auth/callback`. |
| 6 | `/auth/callback` | `auth/callback/page.tsx` | Autenticação | `(public)/auth/callback.tsx` | Implemented | Concluído | Trata troca de tokens OAuth/Magic Links via deep linking Expo. |
| 7 | `/dashboard` | `(dashboard)/dashboard/page.tsx` | Operacional Core | `(app)/(tabs)/dashboard.tsx` | Implemented | Concluído | Painel principal com métricas de eventos, contadores e ações rápidas. |
| 8 | `/dashboard/eventos` | `(dashboard)/dashboard/eventos/page.tsx` | Operacional Core | `(app)/(tabs)/eventos/index.tsx` | Implemented | Concluído | Listagem de eventos com filtros por status, busca por nome e ordenação cronológica. |
| 9 | `/dashboard/eventos/[id]` | `(dashboard)/dashboard/eventos/[id]/page.tsx` | Operacional Core | `(app)/(tabs)/eventos/[id].tsx` | Dedicated / Native Difference | Concluído | Hub central do evento delegando para `EventDetailsScreen` com seletor de módulos `EVENT_MODULES`. |
| 10 | `/dashboard/eventos/novo` | `(dashboard)/dashboard/eventos/novo/page.tsx` | Operacional Core | *Modal interno em eventos/index* | Dedicated / Native Difference | P1 | Web usa rota dedicada; mobile usa modal fluído. Recomendado criar rota dedicada `(app)/(tabs)/eventos/novo.tsx` para fluxos complexos de onboarding de evento. |
| 11 | `/dashboard/eventos/[id]/padrinhos` *(aba web)* | Integrado em `tabs/PadrinhosTab.tsx` | Cerimônia & Cortejo | `(app)/eventos/[id]/padrinhos.tsx` e `PadrinhosTab.tsx` | Implemented | Concluído | **Concluído na Onda 1**: Integrado em `EVENT_MODULES` e rota nativa dedicada. Gestão de cortejo/duplas, status de trajes, cópias contextuais (Casamento vs Debutante) e disparo WhatsApp via Edge Function `whatsapp-padrinhos-dispatch`. |
| 12 | `/dashboard/eventos/[id]/rsvp-inbox` *(aba web)* | Integrado em `tabs/invites/RsvpInboxChatPanel.tsx` | Comunicação & RSVP | `(app)/eventos/[id]/rsvp-inbox.tsx` e `RsvpInboxTab.tsx` | Implemented | Concluído | **Concluído na Onda 1**: Rota dedicada e aba nativa consumindo RPC `get_whatsapp_rsvp_review_queue`, histórico estilo WhatsApp, badge de janela 24h e reenvio de QR Code (`resend_qr`). |
| 13 | `/dashboard/eventos/[id]/reunioes` | `(dashboard)/dashboard/eventos/[id]/reunioes/page.tsx` | Reuniões & Vídeo | `(app)/reunioes/[id].tsx` e `MeetingCenter.tsx` | Implemented | Concluído | **Concluído na Onda 1**: Sala Daily.co aberta via navegador nativo, visualizador de atas executivas geradas por IA, seções colapsáveis e compartilhamento direto via WhatsApp. |
| 14 | `/dashboard/reunioes` | `(dashboard)/dashboard/reunioes/page.tsx` | Reuniões & Vídeo | `(app)/reunioes/index.tsx` | Implemented | Concluído | **Concluído na Onda 1**: Rota executiva global agregando reuniões de todos os eventos com filtros, status, agendamento de chamadas e visualização de atas. |
| 15 | `/dashboard/eventos/[id]/mesas` *(aba web)* | Integrado em `tabs/VisualMapTab.tsx` | Espacial & Mesas | `(app)/eventos/[id]/mesas.tsx` e `TableMapSurface.tsx` | Implemented | Concluído | **Concluído na Onda 1**: Superfície de layout tátil com trava de rolagem (`scrollEnabled={!isDragging}`), alternância Festa/Igreja (`party`/`church`) e gaveta inferior de convidados (`TableGuestDrawer`). |
| 16 | `/dashboard/assinaturas` | `(dashboard)/dashboard/assinaturas/page.tsx` | Faturamento & Planos | `(app)/planos/index.tsx` e `(app)/(tabs)/mais/assinaturas.tsx` | Implemented | Concluído | **Concluído na Onda 1**: Visão do cliente (`CustomerBillingView`) com catálogo Equilíbrio Prime (Essencial, Profissional, Elite), pacotes WhatsApp e checkout InfinitePay via `billing-create-checkout`. |
| 17 | `/dashboard/clientes` | `(dashboard)/dashboard/clientes/page.tsx` | CRM & Clientes | `(app)/(tabs)/clientes/index.tsx` | Implemented | Concluído | Listagem de clientes da assessoria com contatos e atalhos de ligação/WhatsApp. |
| 18 | `/dashboard/clientes/[clientId]` | `(dashboard)/dashboard/clientes/[clientId]/page.tsx` | CRM & Clientes | `(app)/(tabs)/clientes/[clientId].tsx` | Implemented | Concluído | Perfil do cliente, histórico de interações, eventos associados e anotações. |
| 19 | `/dashboard/clientes/modelos` | `(dashboard)/dashboard/clientes/modelos/page.tsx` | CRM & Modelos | `(app)/(tabs)/clientes/modelos.tsx` | Implemented | Concluído | Modelos de documentos e mensagens para clientes. |
| 20 | `/dashboard/clientes/analises` | `(dashboard)/dashboard/clientes/analises/page.tsx` | CRM & Analytics | *Nenhum* | Missing / Planned | P1 | Criar `(app)/(tabs)/clientes/analises.tsx` com funil comercial e conversão de leads. |
| 21 | `/dashboard/financeiro` | `(dashboard)/dashboard/financeiro/page.tsx` | Financeiro | `(app)/(tabs)/financeiro.tsx` | Implemented | Concluído | Visão financeira global da assessoria com contas a pagar/receber e fluxo de caixa. |
| 22 | `/dashboard/fornecedores` | `(dashboard)/dashboard/fornecedores/page.tsx` | Fornecedores | `(app)/(tabs)/fornecedores.tsx` | Implemented | Concluído | Catálogo de fornecedores parceiros com contato, categoria e avaliação. |
| 23 | `/dashboard/equipe` | `(dashboard)/dashboard/equipe/page.tsx` | Gestão de Equipe | `(app)/(tabs)/mais/equipe.tsx` | Implemented | Concluído | Membros da equipe da assessoria, papéis de acesso e permissões. |
| 24 | `/dashboard/configuracoes` | `(dashboard)/dashboard/configuracoes/page.tsx` | Configurações | `(app)/(tabs)/mais/configuracoes.tsx` | Implemented | Concluído | Preferências da assessoria, logotipo, dados cadastrais e integrações. |
| 25 | `/dashboard/perfil` | `(dashboard)/dashboard/perfil/page.tsx` | Perfil do Usuário | `(app)/(tabs)/mais/perfil.tsx` | Implemented | Concluído | Dados da conta do usuário logado, alteração de nome e logout. |
| 26 | `/dashboard/saude` | `(dashboard)/dashboard/saude/page.tsx` | Diagnóstico | `(app)/(tabs)/mais/saude-operacional.tsx` | Implemented | Concluído | Verificação da saúde operacional, integridade das conexões e serviços externos. |
| 27 | `/dashboard/relatorios` | `(dashboard)/dashboard/relatorios/page.tsx` | Relatórios | *Nenhum* | Missing / Planned | P1 | Criar `(app)/(tabs)/mais/relatorios.tsx` com geração e exportação de PDFs consolidados de eventos. |
| 28 | `/dashboard/ferramentas/pdf` | `(dashboard)/dashboard/ferramentas/pdf/page.tsx` | Utilitários | *Nenhum* | Missing / Planned | P1 | Criar `(app)/(tabs)/mais/ferramentas-pdf.tsx` para junção, compressão e geração de documentos. |
| 29 | `/dashboard/eventos/[id]/torre` | `(dashboard)/dashboard/eventos/[id]/torre/page.tsx` | Torre de Controle | *Nenhum* | Missing / Planned | P1 | Adicionar módulo `torre` no menu do evento para monitoramento em tempo real no dia da festa. |
| 30 | `/help-center` | `(dashboard)/help-center/page.tsx` | Suporte | *Nenhum* | Missing / Planned | P2 | Criar `(app)/(tabs)/mais/ajuda.tsx` com tutoriais, vídeos e FAQs de uso. |
| 31 | `/help-center/[slug]` | `(dashboard)/help-center/[slug]/page.tsx` | Suporte | *Nenhum* | Missing / Planned | P2 | Detalhes do artigo com busca e categorização. |
| 32 | `/checkout` | `checkout/page.tsx` | Faturamento | `(app)/planos/index.tsx` (via InfinitePay) | Implemented | Concluído | No mobile, o checkout é despachado via Edge Function `billing-create-checkout` e aberto nativamente via `WebBrowser.openBrowserAsync`. |
| 33 | `/onboarding` | `onboarding/page.tsx` | Onboarding | *Nenhum* | Missing / Planned | P1 | Criar `(app)/onboarding.tsx` guiando a assessoria no cadastro do primeiro evento e configuração de WhatsApp. |
| 34 | `/assinatura-expirada` | `assinatura-expirada/page.tsx` | Faturamento | *Nenhum* | Missing / Planned | P1 | Tela de bloqueio suave `(app)/assinatura-expirada.tsx` redirecionando para regularização via InfinitePay. |
| 35 | `/convite-equipe` | `convite-equipe/page.tsx` | Equipe | *Nenhum* | Missing / Planned | P1 | Rota para aceite de convite de novos membros de equipe no app móvel. |
| 36 | `/gravacao/[id]` | `gravacao/[id]/page.tsx` | Mídia / Gravações | *Nenhum* | Missing / Planned | P1 | Player móvel de reprodução de gravações de reuniões armazenadas no R2. |
| 37 | `/atendimento-ia` | `atendimento-ia/page.tsx` | Plan IA | `(public)/atendimento-ia.tsx` | Implemented | Concluído | Interface de atendimento cognitivo e simulação da Plan IA. |
| 38 | `/politica-de-privacidade` | `politica-de-privacidade/page.tsx` | Legal | `(public)/politica-de-privacidade.tsx` | Implemented | Concluído | Termos de privacidade exibidos nativamente dentro do app. |
| 39 | `/assinatura/[token]` | `assinatura/[token]/page.tsx` | Assinatura Digital | `(public)/assinatura/[token].tsx` | Implemented | Concluído | Assinatura pública de contratos por clientes via token seguro. |
| 40 | `/convite/[token]` | `convite/[token]/page.tsx` | Convite Interativo | `(public)/convite/[token].tsx` | Implemented | Concluído | Abertura do convite do convidado via deep link móvel. |
| 41 | `/noivos/[token]` | `noivos/[token]/page.tsx` | Portal dos Noivos | `(public)/noivos/[token].tsx` | Implemented | Concluído | Painel simplificado para noivos acompanharem confirmações. |
| 42 | `/portfolio/[token]` | `portfolio/[token]/page.tsx` | Portfólio Público | `(public)/portfolio/[token].tsx` | Implemented | Concluído | Vitrine e apresentação de assessoria para novos clientes. |
| 43 | `/torre/[token]` | `torre/[token]/page.tsx` | Operação em Campo | `(public)/torre/[token].tsx` | Implemented | Concluído | Visão pública simplificada para equipe de apoio e fornecedores no dia do evento. |
| 44 | `/briefing/[token]` | `briefing/[token]/page.tsx` | Coleta de Dados | *Nenhum* | Missing / Planned | P2 | Criar `(public)/briefing/[token].tsx` para preenchimento de formulário inicial de noivos/debutantes. |
| 45 | `/orcamento/[token]` | `orcamento/[token]/page.tsx` | Proposta Comercial | *Nenhum* | Missing / Planned | P2 | Criar `(public)/orcamento/[token].tsx` para visualização e aprovação de propostas comerciais. |
| 46 | `/lista-convidados/[token]` | `lista-convidados/[token]/page.tsx` | Convidados | *Nenhum* | Missing / Planned | P2 | Visão pública apenas-leitura da lista de convidados para fornecedores credenciados. |
| 47 | `/mesas/[token]` | `mesas/[token]/page.tsx` | Mesas | *Nenhum* | Missing / Planned | P2 | Consulta de alocação de mesas pública via token/QR Code no foyer do evento. |
| 48 | `/meus-eventos` | `meus-eventos/page.tsx` | Área do Cliente | *Nenhum* | Missing / Planned | P2 | Painel do cliente final consolidando múltiplos eventos contratados. |
| 49 | `/meus-eventos/[eventId]` | `meus-eventos/[eventId]/page.tsx` | Área do Cliente | *Nenhum* | Missing / Planned | P2 | Detalhe do evento sob a perspectiva do cliente contratante. |
| 50 | `/noivos/[token]/mesas` | `noivos/[token]/mesas/page.tsx` | Mesas Noivos | *Nenhum* | Missing / Planned | P2 | Visualizador de mesas liberado para os noivos conferirem a disposição. |
| 51 | `/noivos/[token]/mural` | `noivos/[token]/mural/page.tsx` | Mural Noivos | *Nenhum* | Missing / Planned | P2 | Mural de fotos e recados para os noivos moderarem ou visualizarem. |
| 52 | `/noivos/[token]/presentes` | `noivos/[token]/presentes/page.tsx` | Presentes Noivos | *Nenhum* | Missing / Planned | P2 | Extrato de presentes recebidos e cotas em dinheiro resgatadas. |
| 53 | `/recepcao` | `recepcao/page.tsx` | Recepção & Check-in | *Parcial no app* | Missing / Planned | **P0** | Criar rota dedicada de recepção no app `(app)/(tabs)/mais/recepcao.tsx` para hostess em portaria. |
| 54 | `/recepcao/scan` | `recepcao/scan/page.tsx` | Scanner QR Code | *Aba interna de recepção* | Dedicated / Native Difference | **P0** | No mobile, utilizar leitor de câmera nativo (`expo-camera`) para leitura ultra-rápida offline-first. |
| 55 | `/recepcao/auth` | `recepcao/auth/page.tsx` | Autenticação Hostess | *Nenhum* | Missing / Planned | P1 | Login via PIN de 4 dígitos ou token temporário para equipes terceirizadas de recepção. |
| 56 | `/recepcao/[eventId]` | `recepcao/[eventId]/page.tsx` | Recepção do Evento | *Nenhum* | Missing / Planned | **P0** | Dashboard de entrada em tempo real (total de convidados, presentes, faltantes, grupos). |
| 57 | `/recepcao/[eventId]/scan` | `recepcao/[eventId]/scan/page.tsx` | Scanner Dedicado | *Nenhum* | Dedicated / Native Difference | **P0** | Câmera de alta taxa de quadros com bipe sonoro nativo e feedback tátil de validação. |
| 58 | `/recepcao/[eventId]/lista` | `recepcao/[eventId]/lista/page.tsx` | Lista Alfabética | *Nenhum* | Missing / Planned | **P0** | Busca rápida por nome, conferência de documento e check-in manual de acompanhantes. |
| 59 | `/recepcao/[eventId]/mapa` | `recepcao/[eventId]/mapa/page.tsx` | Mapa da Portaria | *Nenhum* | Missing / Planned | P1 | Visualização tátil do layout de mesas para orientar convidados no momento da chegada. |
| 60 | `/portal` | `portal/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Portal web responsivo acessado pelos clientes dos cerimonialistas. |
| 61 | `/portal/auth` | `portal/auth/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Autenticação por código OTP via WhatsApp ou e-mail dos noivos. |
| 62 | `/portal/[eventId]` | `portal/[eventId]/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Hub do cliente para visualização de cronograma e contratos. |
| 63 | `/portal/[eventId]/convidados` | `portal/[eventId]/convidados/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Interface onde os próprios noivos cadastram e gerenciam sua lista. |
| 64 | `/portal/[eventId]/convite-interativo` | `portal/[eventId]/convite-interativo/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Personalizador e gerador de convites digitais dos noivos. |
| 65 | `/portal/[eventId]/mural` | `portal/[eventId]/mural/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Galeria de fotos e recados enviada pelos convidados. |
| 66 | `/portal/[eventId]/presentes` | `portal/[eventId]/presentes/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Lista de presentes virtuais com chave Pix e cartão. |
| 67 | `/portal/[eventId]/site` | `portal/[eventId]/site/page.tsx` | Portal do Cliente | *Nenhum* | Intentionally Web-Only | Web-Only | Construtor do site do casamento / debutante. |
| 68 | `/site/[slug]` | `site/[slug]/page.tsx` | Site do Evento | *Nenhum* | Intentionally Web-Only | Web-Only | Site público do evento para visualização dos convidados. |
| 69 | `/site/[slug]/convite` | `site/[slug]/convite/page.tsx` | Convite Público | *Nenhum* | Intentionally Web-Only | Web-Only | Abertura do convite no domínio do evento. |
| 70 | `/site/[slug]/mural` | `site/[slug]/mural/page.tsx` | Mural de Fotos | *Nenhum* | Intentionally Web-Only | Web-Only | Upload de fotos e mensagens pelos convidados durante a festa. |
| 71 | `/site/[slug]/moderar` | `site/[slug]/moderar/page.tsx` | Moderação | *Nenhum* | Missing / Planned | P1 | Rota para moderação rápida de fotos antes de projetar no telão. |
| 72 | `/site/[slug]/presente` | `site/[slug]/presente/page.tsx` | Presentes | *Nenhum* | Intentionally Web-Only | Web-Only | Checkout de presente pelos convidados via InfinitePay/Pix. |
| 73 | `/site/[slug]/selo` | `site/[slug]/selo/page.tsx` | Selo de Qualidade | *Nenhum* | Intentionally Web-Only | Web-Only | Certificado de autenticidade da assessoria. |
| 74 | `/vitrine/[slug]` | `vitrine/[slug]/page.tsx` | Vitrine Fornecedor | *Nenhum* | Intentionally Web-Only | Web-Only | Página pública de apresentação de fornecedores parceiros. |
| 75 | `/vitrine/[slug]/convite` | `vitrine/[slug]/convite/page.tsx` | Convite Vitrine | *Nenhum* | Intentionally Web-Only | Web-Only | Landing page de credenciamento de novos fornecedores. |
| 76 | `/retrospectiva/[slug]` | `retrospectiva/[slug]/page.tsx` | Mídia / Linha do Tempo | *Nenhum* | Intentionally Web-Only | Web-Only | Apresentação em tela cheia com trilha sonora e fotos. |
| 77 | `/landingpage2` | `landingpage2/page.tsx` | Marketing / Conversão | *Nenhum* | Intentionally Web-Only | Web-Only | Variação de teste A/B da landing page comercial da plataforma. |
| 78 | `/crm-para-cerimonialistas` | `crm-para-cerimonialistas/page.tsx` | Marketing / SEO | *Nenhum* | Intentionally Web-Only | Web-Only | Artigo e landing page indexada no Google para busca orgânica. |
| 79 | `/gestao-de-convidados-rsvp` | `gestao-de-convidados-rsvp/page.tsx` | Marketing / SEO | *Nenhum* | Intentionally Web-Only | Web-Only | Landing page de captação focada no motor de RSVP por WhatsApp. |
| 80 | `/painel-prime-software` | `painel-prime-software/page.tsx` | Marketing / SEO | *Nenhum* | Intentionally Web-Only | Web-Only | Página institucional de autoridade de marca. |
| 81 | `/sistema-para-assessoria-de-eventos` | `sistema-para-assessoria-de-eventos/page.tsx` | Marketing / SEO | *Nenhum* | Intentionally Web-Only | Web-Only | Página de SEO otimizada para palavras-chave de cerimonialistas. |
| 82 | `/software-para-cerimonialistas` | `software-para-cerimonialistas/page.tsx` | Marketing / SEO | *Nenhum* | Intentionally Web-Only | Web-Only | Página de conversão orgânica para planos pagos. |
| 83 | `/checklist-cronograma-eventos` | `checklist-cronograma-eventos/page.tsx` | Marketing / SEO | *Nenhum* | Intentionally Web-Only | Web-Only | Isca digital de checklist gratuito para captação de cadastros. |
| 84 | `/marketplace` | `marketplace/page.tsx` | Marketing / Catálogo | *Nenhum* | Intentionally Web-Only | Web-Only | Diretório público de assessorias e fornecedores credenciados. |
| 85 | `/br/privacidade` | `br/privacidade/page.tsx` | Legal | *Nenhum* | Intentionally Web-Only | Web-Only | Documento de termos legais sob o padrão brasileiro de compliance. |
| 86 | `/br/termos` | `br/termos/page.tsx` | Legal | *Nenhum* | Intentionally Web-Only | Web-Only | Termos de uso de serviços da plataforma no Brasil. |
| 87 | `/exclusao-de-dados` | `exclusao-de-dados/page.tsx` | Legal / LGPD | *Nenhum* | Intentionally Web-Only | Web-Only | Formulário público de solicitação de exclusão de dados (LGPD/Google Play). |
| 88 | `/glitchtip-example-page` | `glitchtip-example-page/page.tsx` | Teste Interno | *Nenhum* | Intentionally Web-Only | Web-Only | Rota técnica interna de teste de telemetria do Sentry/GlitchTip. |

---

## 3. Inventário Detalhado das 35 Rotas Mobile Existentes

O aplicativo Android é construído sobre o **Expo Router** com arquitetura de diretórios em `apps/mobile/app/`. Com a conclusão da Onda 1 de Paridade e o Sistema de Alertas & Deep Linking, o catálogo móvel expandiu-se da contagem inicial de 27 rotas para um total consolidado de **35 rotas/telas ativas** (além de 7 arquivos `_layout.tsx`), divididas em grupos semânticos:
1. `(public)`: Rotas abertas ou públicas que não exigem sessão de assessoria ativa (incluindo `landing.tsx`, formulários públicos e visualizadores).
2. `(app)/(tabs)`: Navegação inferior principal com abas operacionais contínuas (Dashboard, Eventos, Clientes, Financeiro, Fornecedores, Mais).
3. `(app)/(tabs)/mais`: Telas e utilitários secundários agregados no menu "Mais" (Perfil, Equipe, Configurações, Assinaturas, Saúde Operacional).
4. `(app)/eventos/[id]/*`: Rotas operacionais de imersão no evento (Padrinhos & Cortejo, RSVP Native Inbox, Mapa de Mesas Touch).
5. `(app)/reunioes/*`: Central de Reuniões global e detalhada com salas Daily.co e visualização de atas executivas.
6. `(app)/planos/*`: Central de assinaturas Equilíbrio Prime com checkout InfinitePay.
7. `(app)/tarefas/*`: Detalhamento e gestão de tarefas com suporte a deep linking a partir de notificações na barra de status.

| # | Rota no Expo Router | Arquivo Físico | Papel Arquitetural & Funcionalidade | Correspondente na Web |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `/` | `app/index.tsx` | Splash/Redirect condicional baseado no token do `useAuth()` | `/` |
| 2 | `/(public)` | `app/(public)/index.tsx` | Rota base do grupo público | N/A |
| 3 | `/(public)/landing` | `app/(public)/landing.tsx` | Landing page pública mobile com apresentação da plataforma e CTAs de login/cadastro | `/` (Mobile Native) |
| 4 | `/(public)/login` | `app/(public)/login.tsx` | Autenticação por e-mail e senha com suporte a biometria futura | `/login` |
| 5 | `/(public)/cadastro` | `app/(public)/cadastro.tsx` | Criação de conta da assessoria de eventos | `/cadastro` |
| 6 | `/(public)/auth/callback` | `app/(public)/auth/callback.tsx` | Handler de deep link para login social / magic links | `/auth/callback` |
| 7 | `/(public)/politica-de-privacidade` | `app/(public)/politica-de-privacidade.tsx` | Visualizador nativo de políticas de privacidade para Google Play Store | `/politica-de-privacidade` |
| 8 | `/(public)/atendimento-ia` | `app/(public)/atendimento-ia.tsx` | Interface móvel para teste da Plan IA e triagem cognitiva | `/atendimento-ia` |
| 9 | `/(public)/assinatura/[token]` | `app/(public)/assinatura/[token].tsx` | Tela de assinatura digital de contratos com canvas touch | `/assinatura/[token]` |
| 10 | `/(public)/convite/[token]` | `app/(public)/convite/[token].tsx` | Visualização pública do convite do evento com QR Code | `/convite/[token]` |
| 11 | `/(public)/noivos/[token]` | `app/(public)/noivos/[token].tsx` | Visão simplificada para os noivos visualizarem confirmações | `/noivos/[token]` |
| 12 | `/(public)/portfolio/[token]` | `app/(public)/portfolio/[token].tsx` | Portfólio público da assessoria com fotos e contato | `/portfolio/[token]` |
| 13 | `/(public)/torre/[token]` | `app/(public)/torre/[token].tsx` | Torre de controle móvel para staff e fornecedores no dia do evento | `/torre/[token]` |
| 14 | `/(app)` | `app/(app)/index.tsx` | Redirecionamento da raiz autenticada para o dashboard | `/dashboard` |
| 15 | `/(app)/(tabs)/dashboard` | `app/(app)/(tabs)/dashboard.tsx` | Painel de controle da assessoria com cards de estatísticas | `/dashboard` |
| 16 | `/(app)/(tabs)/eventos` | `app/(app)/(tabs)/eventos/index.tsx` | Listagem principal de eventos com filtros ativos | `/dashboard/eventos` |
| 17 | `/(app)/(tabs)/eventos/[id]` | `app/(app)/(tabs)/eventos/[id].tsx` | Hub operacional do evento com alternância de abas dinâmicas | `/dashboard/eventos/[id]` |
| 18 | `/(app)/(tabs)/clientes` | `app/(app)/(tabs)/clientes/index.tsx` | CRM de clientes contratantes da assessoria | `/dashboard/clientes` |
| 19 | `/(app)/(tabs)/clientes/[clientId]` | `app/(app)/(tabs)/clientes/[clientId].tsx` | Ficha completa do cliente e histórico | `/dashboard/clientes/[clientId]` |
| 20 | `/(app)/(tabs)/clientes/modelos` | `app/(app)/(tabs)/clientes/modelos.tsx` | Modelos de e-mails, contratos e checklists | `/dashboard/clientes/modelos` |
| 21 | `/(app)/(tabs)/financeiro` | `app/(app)/(tabs)/financeiro.tsx` | Painel financeiro global de receitas e despesas | `/dashboard/financeiro` |
| 22 | `/(app)/(tabs)/fornecedores` | `app/(app)/(tabs)/fornecedores.tsx` | Catálogo de fornecedores e prestadores cadastrados | `/dashboard/fornecedores` |
| 23 | `/(app)/(tabs)/mais` | `app/(app)/(tabs)/mais/index.tsx` | Menu secundário com configurações e ferramentas adicionais | `/dashboard` (menu lateral) |
| 24 | `/(app)/(tabs)/mais/perfil` | `app/(app)/(tabs)/mais/perfil.tsx` | Configuração de perfil do usuário logado | `/dashboard/perfil` |
| 25 | `/(app)/(tabs)/mais/equipe` | `app/(app)/(tabs)/mais/equipe.tsx` | Gerenciamento de cerimonialistas da equipe | `/dashboard/equipe` |
| 26 | `/(app)/(tabs)/mais/configuracoes` | `app/(app)/(tabs)/mais/configuracoes.tsx` | Configurações gerais da assessoria e logotipo | `/dashboard/configuracoes` |
| 27 | `/(app)/(tabs)/mais/assinaturas` | `app/(app)/(tabs)/mais/assinaturas.tsx` | Tela de gerenciamento de assinaturas e métricas de Super Admin | `/dashboard/assinaturas` |
| 28 | `/(app)/(tabs)/mais/saude-operacional` | `app/(app)/(tabs)/mais/saude-operacional.tsx` | Telemetria de conectividade e status dos serviços | `/dashboard/saude` |
| 29 | `/(app)/eventos/[id]/padrinhos` | `app/(app)/eventos/[id]/padrinhos.tsx` | Gestão de cortejo nupcial e debutante, duplas, trajes e disparos Plan IA | `/dashboard/eventos/[id]` (aba padrinhos) |
| 30 | `/(app)/eventos/[id]/rsvp-inbox` | `app/(app)/eventos/[id]/rsvp-inbox.tsx` | Caixa de entrada de WhatsApp RSVP, badge de janela 24h e reenvio de QR | `/dashboard/eventos/[id]` (aba rsvp-inbox) |
| 31 | `/(app)/eventos/[id]/mesas` | `app/(app)/eventos/[id]/mesas.tsx` | Mapa de mesas touch com trava de rolagem, áreas festa/igreja e gaveta de convidados | `/dashboard/eventos/[id]` (aba mesas) |
| 32 | `/(app)/reunioes` | `app/(app)/reunioes/index.tsx` | Central global de reuniões com filtros por status e agendamento | `/dashboard/reunioes` |
| 33 | `/(app)/reunioes/[id]` | `app/(app)/reunioes/[id].tsx` | Detalhes da reunião, sala Daily.co e atas executivas com IA | `/dashboard/eventos/[id]/reunioes` |
| 34 | `/(app)/planos` | `app/(app)/planos/index.tsx` | Catálogo de planos Equilíbrio Prime, pacotes WhatsApp e checkout InfinitePay | `/dashboard/assinaturas` |
| 35 | `/(app)/tarefas/[id]` | `app/(app)/tarefas/[id].tsx` | Detalhes da tarefa, checklist, prazos e destino de deep linking de notificações | `/dashboard/eventos/[id]` (tarefas) |

---

## 4. Análise dos 5 Módulos Críticos de Paridade (Concluídos na Onda 1)

### 4.1 Módulo 1: Padrinhos e Corte de Honra com Plan IA [IMPLEMENTADO & CONCLUÍDO]
- **Situação de Entrega**: Implementado com sucesso em `(app)/eventos/[id]/padrinhos.tsx` e `PadrinhosTab.tsx`. Opera com subscrição Realtime na tabela `event_padrinhos`, pareamento de casais/duplas (`pair_padrinho_id`), ordenação de cortejo (`entry_order`), acompanhamento de trajes (`attire_status`) e cópias contextuais via `getEventPersonaCopy()` (Casamento vs Debutante).
- **Disparo de Mensagens via IA**: Integração completa com a Edge Function `whatsapp-padrinhos-dispatch` para os 3 tipos de disparo:
  1. `manual`: Guia de Padrinhos ou Manual da Corte de Honra.
  2. `concentration`: Horário calculado de concentração (45 min antes) e localização.
  3. `attire`: Alinhamento e confirmação de paleta de cores e trajes.
- **Validação**: Testado via `F16` no Tier 1 e `Tier 3.8` no Tier 3.

### 4.2 Módulo 2: WhatsApp RSVP Native Inbox Multi-tenant [IMPLEMENTADO & CONCLUÍDO]
- **Situação de Entrega**: Implementado em `(app)/eventos/[id]/rsvp-inbox.tsx` e `RsvpInboxTab.tsx`. Consome a RPC `get_whatsapp_rsvp_review_queue`, exibindo conversas pendentes de triagem com prioridade (`handoff` > `clarify` > `awaiting_reply`), balões nativos estilo WhatsApp e indicador visual de janela de 24h aberta (grátis) vs fechada.
- **Ações Rápidas & QR Code**: Resolução de presença por convidado com submissão em lote e botão **`Reenviar QR Code`** via Edge Function `whatsapp-rsvp-review-action` com `action: 'resend_qr'`.
- **Validação**: Testado via `F17` no Tier 1 e `Tier 3.9` no Tier 3 com cálculo resiliente a clock skew.

### 4.3 Módulo 3: MeetingCenter & Salas Daily.co com Atas Executivas [IMPLEMENTADO & CONCLUÍDO]
- **Situação de Entrega**: Implementado na rota global `(app)/reunioes/index.tsx`, na rota de detalhes `(app)/reunioes/[id].tsx` e no componente `MeetingCenter.tsx`. Oferece criação e agendamento de chamadas por vídeo com Daily.co abertas nativamente via `WebBrowser.openBrowserAsync`.
- **Atas Executivas por IA**: Visualizador `AtaViewModal.tsx` com seções colapsáveis (Resumo Executivo, Pautas, Decisões e Próximos Passos) e disparo direto para o WhatsApp do cliente via `meeting-management` (`send-ata-whatsapp`).
- **Validação**: Testado via `F18` no Tier 1 e `Tier 3.10` no Tier 3.

### 4.4 Módulo 4: Mapa de Mesas (`table-map`) Touch & Drag-and-Drop [IMPLEMENTADO & CONCLUÍDO]
- **Situação de Entrega**: Implementado em `(app)/eventos/[id]/mesas.tsx` e `TableMapSurface.tsx`. Superfície interativa fluída com `PanResponder` e `requestAnimationFrame` a 60fps.
- **Trava de Rolagem & Particionamento**: Controle dinâmico `scrollEnabled={!isDragging}` eliminando conflito de gestos, alternância de ambiente Festa/Igreja (`party`/`church`) e gaveta tátil de convidados (`TableGuestDrawer.tsx`) para alocação direta.
- **Validação**: Testado via `F19` no Tier 1 e `Tier 3.10` no Tier 3.

### 4.5 Módulo 5: SuperBilling com Planos e InfinitePay [IMPLEMENTADO & CONCLUÍDO]
- **Situação de Entrega**: Implementado em `(app)/planos/index.tsx` e `SuperBillingScreen.tsx`. Visão do cliente (`CustomerBillingView`) com catálogo Equilíbrio Prime: **Essencial** (R$ 49/mês), **Profissional** (R$ 89/mês) e **Elite Equilíbrio Prime** (R$ 149/mês), toggle Mensal / Anual (20% OFF) e pacotes de créditos WhatsApp (200, 500, 1.500 mensagens).
- **Checkout Instantâneo**: Integração com a Edge Function `billing-create-checkout` gerando link InfinitePay aberto via `WebBrowser.openBrowserAsync`.
- **Validação**: Testado via `F20` no Tier 1.

---

## 5. Roteiro de Paridade em Fases (Roadmap Atualizado)

```
[ Milestone 1 ]  Matriz de Paridade & Especificações Técnicas (Concluído)
       │
[ Milestone 2 ]  Sanidade de Código: Correção TS5097, Limpeza UTF-8 BOM, Script Validate (Concluído)
       │
[ Milestone 3 ]  Auditoria de Segurança, Isolamento de Chaves EXPO_PUBLIC_ & Doppler (Concluído)
       │
[ Milestone 4 ]  Validação de Build APK no Repo Mobile & Android Device Streaming (Concluído)
       │
[ Milestone 5 ]  Implementação dos 5 Módulos Críticos no Mobile & Testes E2E (Concluído)
       │
[ Milestone 6 ]  Sistema de Alertas Android: Ícone na Bandeja, 4 Canais & Agendamento (Concluído)
       │
[ Milestone 7 ]  Pacote Corporativo de UI/UX: Touch Targets 44x44pt, Haptics, Skeletons (Concluído)
       │
[ Milestone 8 ]  Sincronização de Docs de Paridade, Auditoria & Expansão da Suíte E2E (Concluído)
```

---

## 6. Sistema de Alertas no Celular & Pacote Corporativo de UI/UX Mobile

### 6.1 Ícone Monocromático na Bandeja e Barra de Status do Android
- **Diretriz Android API 26+**: A barra de status e a bandeja de notificações do sistema Android exigem ícones estritamente monocromáticos (canal alfa com silhueta branca pura `#FFFFFF` e fundo transparente). Ícones coloridos causam o erro visual clássico de "quadrado cinza ou opaco".
- **Ativo Oficial**: Criado em `apps/mobile/assets/notification-icon.png` (96x96px), inspecionado binariamente pixel a pixel com **0 pixels coloridos** e 100% dos pixels visíveis em branco puro (`#FFFFFF`) com canal alfa limpo.
- **Configuração no `app.json`**:
  ```json
  "notification": {
    "icon": "./assets/notification-icon.png",
    "color": "#023c69"
  }
  ```
  O Android preenche dinamicamente o ícone com a cor de acento institucional do Painel Prime (`#023c69`) na bandeja de alertas e em branco puro na barra superior.

### 6.2 Canais Nativos de Notificação (`Notification Channels`)
O serviço central `apps/mobile/src/services/notificationService.ts` registra no ciclo inicial do app (via `MobileRootProviders.tsx`) os 4 canais obrigatórios do Android:
1. `reunioes_alertas`: Prioridade MÁXIMA (`AndroidImportance.MAX`), com alarme sonoro, padrão de vibração `[0, 250, 250, 250]`, luz de destaque `#023c69` e banner heads-up flutuante para avisos de reuniões.
2. `tarefas_prazos`: Prioridade ALTA (`AndroidImportance.HIGH`), com som e vibração `[0, 150, 150, 150]` para lembretes de tarefas pendentes e prazos do dia.
3. `rsvp_atividade`: Prioridade PADRÃO (`AndroidImportance.DEFAULT`), com som para confirmações e interações no WhatsApp RSVP.
4. `financeiro_avisos`: Prioridade BAIXA (`AndroidImportance.LOW`), silencioso para informes de faturas, recibos e recargas de créditos.

### 6.3 Agendamento Inteligente Offline-First e Deep Linking
- **Reuniões**: Lembretes agendados no hardware do aparelho para 15 minutos antes (`meeting-15m-${id}`) e na hora de início (`meeting-start-${id}`), garantindo entrega mesmo sem cobertura de dados no local do evento.
- **Tarefas**: Agendamento local matinal para tarefas com vencimento no dia (`task-${id}`).
- **Deep Linking**: Ao tocar na notificação, o listener nativo `setupNotificationResponseListener()` interpreta payloads `painelprime://reunioes/[id]` e `painelprime://tarefas/[id]`, redirecionando imediatamente para a tela correta sem RedBox ou desvio de autenticação.

### 6.4 Pacote Corporativo de UI/UX Mobile
- **Alvos de Toque (Touch Targets >= 44x44pt)**:
  - Botões (`Button.tsx`), cabeçalhos, ações rápidas e modais (`Modal.tsx`) possuem dimensões mínimas de 44x44pt ou utilizam `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` (ou `hitSlop={8}` em botões expandidos), eliminando toques falsos em telas sensíveis ao toque.
- **Feedback Háptico Tátil Integrado (`AppHaptics` / `expo-haptics`)**:
  - `AppHaptics.selection()`: Ao alternar filtros de status, abas de módulos e ciclos de faturamento.
  - `AppHaptics.light()`: Ao tocar em cards de reuniões, botões secundários e acordeões.
  - `AppHaptics.medium()`: Ao arrastar mesas no salão (`TableMapSurface`) ou reordenar cortejo.
  - `AppHaptics.success()`: Ao salvar tarefas, confirmar presença no RSVP ou concluir disparos via Plan IA.
  - `AppHaptics.error()`: Em tentativas de ação com campos obrigatórios ausentes ou falha de rede.
- **Skeletons Shimmer Loaders & Empty States**:
  - Substituição total de spinners genéricos pelo componente `Skeleton.tsx` com animação pulsante no formato real do conteúdo.
  - Empty states padronizados (`EmptyState.tsx`) contendo ilustrações temáticas, mensagens claras em PT-BR e botão de ação primária (CTA) orientado a onboarding.
- **Ergonomia de Teclado**:
  - Telas de formulário e modais protegidos com `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`), rolagem contínua com `keyboardShouldPersistTaps="handled"` e fechamento automático do teclado ao tocar fora via `Keyboard.dismiss`.

---

## 7. Assinatura e Distribuição do Aplicativo Android (Keystore & Certificado)

- **Repositório Dedicado Mobile**: `theproject93/painel-prime-mobile`
- **Pipeline de CI/CD**: Workflow `preview-build.yml` acionado em tags `android-v*`
- **Fingerprint SHA-256 do Certificado de Release**: `bf524e07f7cb2457aa8cd183aa38b8454f2addd6a6e229ecf858778965bec82b`
- **Perfil EAS Build**: Perfil `release-apk` configurado em `eas.json` gerando artefato APK (`buildType: "apk"`) para testes no Firebase App Distribution e Android Device Streaming.

