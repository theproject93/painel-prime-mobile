# Guia Oficial e Checklist de Submissão — Google Play Console

**Versão:** 1.0.0  
**Alvo Mobile:** Android API 33+ (Google Pixel 7 / Universal)  
**Package Android:** `br.com.painelprime.app`  
**Esquema de Deep Linking:** `painelprime://`  
**Status:** Aprovado para Submissão — Pronto para Produção  
**Data:** 21 de outubro de 2026  

---

## 1. Visão Geral e Objetivo

Este documento é o guia definitivo e autoritativo para o envio, revisão e aprovação do aplicativo **Painel Prime** (`br.com.painelprime.app`) no **Google Play Console**. 

Ele consolida todos os textos prontos para cópia e colagem nos formulários do console, garantindo 100% de conformidade com as políticas obrigatórias de:
1. **Acesso ao App (App Access)** com conta de demonstração irrestrita e bilíngue (Português e Inglês) para os revisores internacionais do Google Play (EUA e Índia);
2. **Segurança dos Dados (Data Safety)** mapeando exaustivamente cada categoria de dado coletado, finalidade, criptografia e descarte;
3. **Exclusão de Conta e Dados (User Data: Account Deletion)** comprovando o fluxo in-app nativo e a rota web pública canônica;
4. **URLs Oficiais e Contatos Regulatórios**.

---

## 2. Acesso ao App (App Access) — Instruções para o Revisor

No Google Play Console, acesse: **Conteúdo do app > Acesso ao app** (*App access*).

### 2.1 Configuração do Acesso
- **Opção a marcar:** *"Todas as funcionalidades ou algumas estão restritas"* (*All or some functionality is restricted*).
- **Nome da Credencial:** `Conta de Revisão do Google Play / Google Play Reviewer Demo Account`
- **Nome de Usuário / E-mail:** `google-teste-elite@painelprime.com.br`
- **Senha:** `PainelPrime!2026Elite`
- **Telefone de Teste (opcional):** `+5511999999999`

---

### 2.2 Instruções em Português do Brasil (PT-BR)

*Copie e cole o texto abaixo no campo "Instruções" (Instructions) do console:*

```text
INSTRUÇÕES DE ACESSO PARA REVISÃO DO GOOGLE PLAY:

1. Abra o aplicativo Painel Prime no dispositivo Android.
2. Na tela inicial (Landing), toque em "Entrar" no topo da tela ou aguarde o redirecionamento para a tela de Login.
3. Insira as credenciais de teste:
   - E-mail: google-teste-elite@painelprime.com.br
   - Senha: PainelPrime!2026Elite
4. Toque no botão "Entrar na Plataforma".
5. O acesso é imediato e concede permissão de Plano Elite com assinatura vitalícia ativa.
6. A conta já está populada com eventos reais de demonstração (Casamentos, Debutantes, Corporativo), permitindo navegar por:
   - Dashboard: métricas gerais e contadores de eventos.
   - Eventos: lista de eventos, detalhe do evento, tarefas e cronograma.
   - Padrinhos & Corte de Honra: gestão de duplas e trajes.
   - WhatsApp RSVP Inbox: mensagens de confirmação e fila de revisão.
   - Mapa de Mesas Touch: layout visual de mesas com gestos de toque.
   - Reuniões & Atas IA: visualização de atas executivas.
   - Mais > Perfil / Configurações: dados cadastrais e fluxo de "Exclusão de Conta e Dados".

OBSERVAÇÕES CRÍTICAS DE SEGURANÇA E ACESSO:
- SEM 2FA / MFA / SMS: A conta de teste NÃO exige autenticação de dois fatores, código SMS ou verificação via WhatsApp. A autenticação é 100% direta via e-mail e senha.
- SEM BLOQUEIO GEOGRÁFICO (NO GEOBLOCKING): Os servidores de API e autenticação (Supabase Cluster) estão liberados globalmente para qualquer região de teste do Google Play (incluindo Estados Unidos, Índia e Europa).
- CONEXÃO COM A INTERNET: O app requer conexão HTTPS padrão (porta 443). Não há restrição de DNS corporativo.
- VERIFICAÇÃO DE EXCLUSÃO DE CONTA: Para testar a exclusão de conta em conformidade com a política User Data do Google Play, acesse no app "Mais > Perfil" ou "Mais > Configurações" e toque em "Excluir minha conta e dados", ou consulte nossa página pública em https://painelprime.com.br/privacidade/exclusao-de-dados.
```

---

### 2.3 English Version (for International Reviewers — US/India)

*Copy and paste the text below into the "Instructions" field of the Google Play Console:*

```text
APP ACCESS INSTRUCTIONS FOR GOOGLE PLAY REVIEWERS:

1. Launch the Painel Prime application on your Android test device or emulator.
2. On the landing screen, tap "Entrar" (Sign In) in the upper right header or wait for the login screen.
3. Enter the demo credentials provided below:
   - Email: google-teste-elite@painelprime.com.br
   - Password: PainelPrime!2026Elite
4. Tap the "Entrar na Plataforma" (Sign In) button.
5. You will immediately access the app dashboard with an active "Elite Plan" demo account.
6. The test account is fully pre-populated with realistic event management data, allowing you to review all core modules:
   - Dashboard: event metrics and analytics overview.
   - Events (Eventos): event lists, tasks, timelines, and checklists.
   - Wedding Party & Court of Honor (Padrinhos): couples and attire management.
   - WhatsApp RSVP Inbox: inbound guest confirmations and review queue.
   - Interactive Table Map (Mapa de Mesas): touch and gesture table layout.
   - Meetings & AI Minutes (Reuniões): executive meeting minutes viewer.
   - More > Profile / Settings (Mais > Perfil / Configurações): account details, biometric toggle, and the "Account & Data Deletion" (Excluir Conta e Dados) feature.

CRITICAL REVIEWER NOTES:
- NO 2FA / MFA / SMS REQUIRED: This reviewer demo account has two-factor authentication, phone OTP, and SMS verification disabled. Login is strictly direct via email and password.
- NO GEOBLOCKING / NO IP RESTRICTIONS: Backend API and authentication gateways are globally accessible with zero IP or regional geoblocking, fully reachable from Google review centers in the United States, India, and worldwide.
- ACCOUNT DELETION VERIFICATION: To test account deletion compliant with Google Play's User Data policy, navigate in-app to "Mais > Perfil" or "Mais > Configurações" and tap "Excluir Conta e Dados", or visit our dedicated web deletion page at https://painelprime.com.br/privacidade/exclusao-de-dados.
```

---

## 3. Mapeamento da Seção Segurança dos Dados (Data Safety)

No Google Play Console, acesse: **Conteúdo do app > Segurança dos dados** (*Data safety*).

### 3.1 Perguntas Globais de Abertura

| Pergunta no Console | Resposta | Justificativa Técnica |
|---|:---:|---|
| **O app coleta ou compartilha algum dos tipos de dados de usuários necessários?** | **Sim (Yes)** | O app coleta dados para gestão de contas, eventos e suporte. |
| **Todos os dados de usuários coletados pelo app são criptografados em trânsito?** | **Sim (Yes)** | Todas as conexões utilizam TLS 1.3 / HTTPS com certificados emitidos por autoridades reconhecidas. |
| **Você oferece uma forma de os usuários solicitarem a exclusão dos dados?** | **Sim (Yes)** | Disponível in-app em Perfil/Configurações e via página web pública. |
| **URL de exclusão de dados informada no Console:** | `https://painelprime.com.br/privacidade/exclusao-de-dados` | Rota canônica ativa e responsiva. |

---

### 3.2 Tabela Detalhada de Tipos de Dados Coletados

| Categoria do Play Console | Dado Específico | Coletado? | Compartilhado? | Finalidades Declaradas no Console | Efêmero? | Obrigatório ou Opcional? |
|---|---|:---:|:---:|---|:---:|:---:|
| **Informações Pessoais** | **Nome** | Sim | Não | • Funcionalidade do app<br>• Gestão de contas | Não | Obrigatório |
| **Informações Pessoais** | **Endereço de e-mail** | Sim | Não | • Funcionalidade do app<br>• Gestão de contas<br>• Comunicações | Não | Obrigatório |
| **Informações Pessoais** | **Número de telefone** | Sim | Não | • Funcionalidade do app<br>• Comunicações (disparo RSVP) | Não | Opcional |
| **Informações Pessoais** | **IDs de usuário (User IDs)** | Sim | Não | • Funcionalidade do app<br>• Gestão de contas (UUID Supabase) | Não | Obrigatório |
| **Informações Financeiras** | **Histórico de compras** | Sim | Não | • Funcionalidade do app<br>• Gestão de assinaturas (Plano Elite) | Não | Obrigatório (assinantes) |
| **Informações Financeiras** | **Cartão de Crédito / Dados Bancários** | **Não** | **Não** | Processado externamente via Web Checkout seguro; nenhum dado de cartão trafega no app nativo. | N/A | N/A |
| **Mensagens** | **Mensagens de RSVP / Confirmações** | Sim | Não | • Funcionalidade do app (confirmações e respostas de convidados) | Não | Opcional |
| **Fotos e Vídeos** | **Fotos** | Sim | Não | • Funcionalidade do app (foto de perfil, anexos de mesas) | Não | Opcional |
| **Áudio** | **Gravações de voz** | Sim | Não | • Funcionalidade do app (transcrição de atas de reunião por IA) | **Sim** (descartado após ata) | Opcional |
| **Informações e Desempenho do App** | **Registros de falhas (Crash logs)** | Sim | Sim (Sentry) | • Análise (Analytics)<br>• Prevenção contra fraudes e segurança | Não | Obrigatório |
| **Informações e Desempenho do App** | **Diagnóstico de desempenho** | Sim | Sim (Sentry) | • Análise (Analytics)<br>• Gestão de performance | Não | Obrigatório |
| **IDs de Dispositivo** | **Tokens de Notificação (Expo/FCM)** | Sim | Não | • Funcionalidade do app (entrega de alertas e lembretes) | Não | Opcional |
| **Biometria** | **Dados biométricos** | **Não** | **Não** | **Apenas autenticação local** via Android BiometricPrompt (`expo-local-authentication`). Nenhum dado biométrico é lido, gravado ou transmitido para servidores. | N/A | N/A |

---

## 4. Política de Exclusão de Conta e Dados (User Data: Account Deletion)

A política de dados do usuário da Google Play Store exige que todo aplicativo que permite a criação de conta ofereça:
1. **Exclusão de Conta Dentro do App (In-App)**;
2. **Exclusão de Conta via URL Pública na Web** que não exija manter o app instalado.

### 4.1 Evidência do Fluxo In-App (`apps/mobile`)
- **Telas:** `apps/mobile/src/screens/ProfileScreen.tsx` e `apps/mobile/src/screens/SettingsScreen.tsx`.
- **Componente:** `apps/mobile/src/components/DeleteAccountModal.tsx`.
- **Procedimento:**
  1. O usuário toca em "Excluir minha conta e dados" na seção "Zona de Perigo".
  2. O modal Dark Luxury exige a digitação exata da frase de segurança: `"EXCLUIR MINHA CONTA"`.
  3. O app executa requisição HTTP `POST` autenticada com Bearer Token para `${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`.
  4. A Edge Function remove o usuário via `auth.admin.deleteUser()`, disparando regras relacionais de cascata (`ON DELETE CASCADE`) no banco de dados Supabase PostgreSQL.
  5. A sessão local é destruída (`supabase.auth.signOut()`) e o usuário é redirecionado para a tela de login com alerta informativo.

### 4.2 Evidência da Página Pública Web (`apps/web`)
- **URL Canônica:** `https://painelprime.com.br/privacidade/exclusao-de-dados`
- **Espelhos Regionais:** `https://painelprime.com.br/br/privacidade/exclusao-de-dados` e `https://painelprime.com.br/exclusao-de-dados`
- **Conteúdo da Página:**
  1. Passo a passo para exclusão via App Android (`br.com.painelprime.app`).
  2. Passo a passo para exclusão via Plataforma Web (`app.painelprime.com.br`).
  3. Canal direto para usuários sem o app instalado (via e-mail oficial `lgpd@painelprime.com.br` com link `mailto:` pré-formatado e SLA de 15 dias corridos).
  4. Tabela discriminando dados excluídos imediatamente (cadastro, eventos, listas) versus dados retidos por exigência legal (6 meses para logs do Marco Civil da Internet conforme Art. 15 da Lei 12.965/2014; 5 anos para notas fiscais conforme Art. 173 do Código Tributário Nacional).

---

## 5. URLs Oficiais e Metadados do App

| Campo no Google Play Console | Valor Oficial | Rota Web / Arquivo Correspondente |
|---|---|---|
| **Política de Privacidade** | `https://painelprime.com.br/privacidade` | `apps/web/src/app/privacidade/page.tsx` |
| **Exclusão de Conta e Dados** | `https://painelprime.com.br/privacidade/exclusao-de-dados` | `apps/web/src/app/privacidade/exclusao-de-dados/page.tsx` |
| **Site Oficial** | `https://painelprime.com.br` | `apps/web/src/app/page.tsx` |
| **E-mail de Suporte ao Usuário** | `suporte@painelprime.com.br` | Monitorado pela equipe de atendimento |
| **E-mail do Encarregado (DPO/LGPD)** | `lgpd@painelprime.com.br` | Monitorado pela equipe jurídica de privacidade |
| **Categoria do App** | `Negócios / Eventos` (Business) | Setor de assessorias cerimoniais |
| **Classificação de Conteúdo** | `Livre / Everyone` (IARC) | Sem conteúdo sensível, jogos de azar ou violência |

---

## 6. Checklist Pré-Submissão (Engenharia e QA)

Antes de promover o pacote de produção no Google Play Console:

- [x] O comando `pnpm --filter @painel-prime/mobile run validate` executa com código de saída `0` (TypeScript e Expo introspect íntegros).
- [x] O comando `pnpm --filter @painel-prime/web run typecheck` executa com código de saída `0`.
- [x] O runner `node tests/e2e/run_all_e2e_tests.mjs` passa com 100% dos testes aprovados.
- [x] O app mobile possui o fallback defensivo de 4000ms na hidratação de sessão (`AuthContext.tsx`), garantindo ausência de telas pretas ou loops para revisores internacionais.
- [x] Todos os botões interativos das telas de Perfil, Configurações e Privacidade possuem altura mínima de 44pt, `hitSlop: 12` e atributos de acessibilidade (`accessibilityRole="button"`, `accessibilityLabel`).
- [x] Todo texto visível na interface do usuário está em Português do Brasil com acentuação correta conforme `AGENTS.md`.
- [x] A Edge Function `delete-account` está ativa com `verify_jwt = true` em `supabase/config.toml` e sem chamadas inválidas de `account-delete`.
- [x] O usuário de demonstração `google-teste-elite@painelprime.com.br` está ativo com assinatura vitalícia do Plano Elite e sem bloqueios de MFA/SMS.
