# 🤖 DIRETRIZES OBRIGATÓRIAS DE DESENVOLVIMENTO (PAINEL PRIME)

⚠️ **REPOSITÓRIO PRINCIPAL PARA ANDROID:** Toda modificação, build, deploy ou debugging do app mobile (`apps/mobile`) deve ser feita contra o repositório **`theproject93/painel-prime-mobile`** (remote `mobile`). O repositório `theproject93/painel-prime` (remote `origin`) é o monorepo geral focado em WEB. Quando a tarefa mencionar "Android", "APK", "celular", "app mobile", "Expo", "React Native" ou "Fabric", o alvo é **sempre** `painel-prime-mobile`.

Você é um Engenheiro de Software Sênior atuando neste monorepo (`pnpm`). Este documento é a LEI ABSOLUTA do projeto. Qualquer alteração de código que viole as regras abaixo quebrará o ecossistema e será rejeitada. Leia atentamente antes de modificar qualquer arquivo.

---

## 1. CONTEXTO TECNOLÓGICO (BLEEDING EDGE)
- **Monorepo Workspace:** Dependências gerenciadas globalmente via `pnpm`.
- **Shared Packages:** Dependemos de `@painel-prime/app` (regras de negócio, tipos) e `@painel-prime/ui` (componentes universais). Mudanças aqui afetam Web e Mobile simultaneamente.
- **Mobile Environment (`apps/mobile`):** React 19.1.0, React Native 0.81.5, Expo SDK 54, e **Nova Arquitetura Ativada (`newArchEnabled: true`)**.
- **Roteamento Mobile:** `expo-router` baseado em arquivos dentro da pasta `app/`.
- **Ecossistema Multi-Repositório:** O projeto opera com dois repositórios GitHub sincronizados, mas com históricos Git distintos:
  - `origin` → `theproject93/painel-prime` (monorepo completo: web + mobile + packages)
  - `mobile` → `theproject93/painel-prime-mobile` (repositório dedicado ao app Expo/React Native)
- Toda modificação no escopo `apps/mobile/` precisa ser enviada para **ambos** os remotes. O push cego de commits do monorepo para o repositório mobile sem validação de alinhamento é PROIBIDO.
- Ambos os repositórios possuem workflows de CI/CD independentes. O repositório `mobile` (`painel-prime-mobile`) é o **ÚNICO** detentor e executor dos workflows de geração de APK (`eas-build.yml` e `preview-build.yml`). É **EXPRESSAMENTE PROIBIDO** comitar ou manter esses arquivos de workflow no repositório `origin` (`painel-prime`), garantindo um histórico de commits limpo e focado em WEB.

---

## 2. VARIÁVEIS DE AMBIENTE E SUPABASE
- **Prefixo Obrigatório:** No ambiente mobile, TODA variável de ambiente exposta ao bundle precisa, obrigatoriamente, começar com `EXPO_PUBLIC_`.
- **Core Secrets:** As chaves principais são `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Validação Crítica:** A função `requireEnv()` em `packages/app/src/supabase/client.ts` lança erro fatal se essas variáveis estiverem vazias ou ausentes. O app **não abre** sem elas.
- **Persistência de Sessão:** O Supabase Mobile utiliza o adaptador `expo-secure-store` para guardar os tokens de forma criptografada no sistema operacional. Nunca altere essa implementação em `src/lib/supabase.ts`.
- **Consumo:** As env vars são lidas via `process.env.EXPO_PUBLIC_SUPABASE_URL` (NUNCA via `Constants.expoConfig.extra`).
- **CI/CD:** As variáveis são injetadas como secrets do GitHub Actions no step do `eas build --local`. Também estão salvas no Doppler (`dev_personal`, projeto `painel-prime`).

---

## 3. REGRAS CRÍTICAS ANTI-CRASH (ATENÇÃO MÁXIMA)
- **Nova Arquitetura (Fabric):** Com `newArchEnabled: true`, todo módulo nativo precisa ter suporte a Fabric. Módulos sem Fabric ViewManagerAdapter **crasham em runtime** quando o componente é renderizado.
- **`expo-linear-gradient` (REMOVIDO):** Este módulo foi completamente removido do projeto por incompatibilidade com o Fabric (Nova Arquitetura). NUNCA reinstale esta dependência nem a adicione ao array `"plugins"` do `app.json`. Todo código que antes usava `LinearGradient` foi migrado para `react-native-svg`.
- **`react-native-svg`:** É o substituto oficial para gradientes no projeto. O módulo tem suporte completo a Fabric e funciona corretamente em produção. Veja a Seção 3-A para as regras de uso obrigatórias de gradientes SVG.
- **OAuth / Deep Linking Scheme:** O único Deep Link válido para o aplicativo é baseado no scheme `painelprime://`. O bundle ID correto é `br.com.painelprime.app`. O `AuthContext.tsx:78` já utiliza `painelprime://auth/callback` como `redirectTo` no fluxo OAuth.
- **Fontes:** O arquivo `SFMono-Regular.ttf` NÃO existe em `assets/fonts/`. Não referencie fontes inexistentes em plugins do `app.json`.

---

## 3-A. GRADIENTES SVG COM REACT 19 (PADRÃO OFICIAL)

Todo componente visual que utilize gradientes DEVE seguir este padrão com `react-native-svg` + `useId()`:

```tsx
import { useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

function MeuComponente() {
  const id = useId();

  return (
    <View style={styles.container}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`prefix-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={startColor} />
            <Stop offset="1" stopColor={endColor} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#prefix-${id})`} />
      </Svg>
      {/* children aqui */}
    </View>
  );
}
```

**Regras críticas:**
1. `useId()` é **obrigatório** — gera IDs únicos por instância do componente, isolando escopos de gradiente no Android. Sem isso, múltiplos SVG na mesma tela competem pelo mesmo `id` global e causam renderização incorreta.
2. Use um prefixo descritivo no `id` (ex: `gc-bg-`, `scp-icn-`, `qa-`) para facilitar debugging.
3. Para gradientes de fundo, use `StyleSheet.absoluteFill` e coloque o `<Svg>` **antes** dos children.
4. Para gradientes em elementos de tamanho fixo (ícones, badges), defina `width` e `height` explícitos no `<Svg>`.
5. Para bordas arredondadas no `<Rect>`, use `rx` e `ry` iguais ao `borderRadius` do container.
6. **NUNCA** adicione `expo-linear-gradient` ao array de plugins do `app.json` — isso quebra o comando `expo config --json` no build.

---

## 4. PLUGINS NATIVOS DO `app.json` (LISTA OFICIAL)
Os seguintes plugins estão ativos e validados em `apps/mobile/app.json`:

```json
"plugins": [
  "expo-video",
  "expo-font",
  "expo-asset",
  "expo-router",
  "expo-web-browser",
  "@react-native-community/datetimepicker",
  ["expo-local-authentication", {
    "faceIDPermission": "Permita que o Painel Prime use o Face ID para proteger seu acesso."
  }],
  ["@sentry/react-native/expo", {
    "url": "https://sentry.io/",
    "project": "painel-prime-mobile",
    "organization": "painel-prime"
  }]
]
```

**Regra:** Só adicione um plugin se:
1. O módulo nativo correspondente estiver em `dependencies` do `package.json`
2. O plugin NÃO causar crash no `expo config` (teste em CI antes de mergear)
3. O módulo tiver suporte comprovado a Fabric (Native ViewManagerAdapter)

### Sentry CLI — Build Allowlist

O `@sentry/react-native` depende de `@sentry/cli` para upload de source maps. O pnpm pode ignorar os build scripts do `@sentry/cli` com o warning:

```
The following dependencies have build scripts that were ignored: @sentry/cli
```

Para garantir que o upload de source maps funcione durante o build EAS, o repo mobile deve incluir `@sentry/cli` na allowlist de build scripts — `pnpm.onlyBuiltDependencies` no `package.json` raiz ou `onlyBuiltDependencies` top-level no `pnpm-workspace.yaml`:

```json
"pnpm": {
  "onlyBuiltDependencies": ["@sentry/cli", "esbuild", "workerd"]
}
```

---

## 5. ESTREIRA DE DEPLOY & CI/CD
- **Proibido EAS Cloud:** Nunca execute builds nos servidores de nuvem da Expo (`eas build`). A cota gratuita é estritamente limitada a 15 builds.
- **GitHub Actions Mobile:** O empacotamento do APK é feito localmente pelo workflow `.github/workflows/preview-build.yml`, exclusivamente no repositório `painel-prime-mobile`.
- **Gatilho de release:** Merge ou push em `main` **não pode** gerar APK. O único gatilho permitido é uma tag `android-v*`, criada somente após todas as validações da versão.
- **Versão Android:** `expo.version` é a versão pública; `android.versionCode` deve ser sempre maior que o maior código já publicado, mesmo se releases antigas forem apagadas do Firebase.
- **Perfil de Build:** O perfil oficial é `release-apk`, com `distribution: internal`, `android.buildType: apk` e `appVersionSource: local`.
- **Instalação reproduzível:** O workflow usa `pnpm install --frozen-lockfile`; `--force` é proibido na esteira oficial.
- **Publicação:** O workflow valida assinatura e SHA-256, salva o artefato e só então distribui no Firebase App Distribution ao grupo `testers`.
- **APK versus Play Store:** O APK é o artefato oficial para Firebase/instalação direta. Uma futura publicação inicial na Google Play exigirá AAB e `versionCode` superior.
- **Limpeza Firebase:** Só depois do smoke do APK oficial, preserve o resource name exato da nova release e apague em lote as anteriores. Nunca selecione apenas “a mais recente” sem conferir versão, código e hash.
- **Único Runner de Mobile:** O workflow `Build Android Release` deve existir e rodar exclusivamente no repositório dedicado `painel-prime-mobile`.

---

## 5-A. ESTREIRA WEB (GITOPS CLOUDFLARE WORKER)
- **Fluxo de Produção Assíncrono:** O deploy da aplicação Web (`apps/web`) não utiliza comandos de deploy direto (como Wrangler) de dentro do GitHub Actions. O ecossistema opera em modelo GitOps.
- **Gatilho de Validação:** O desenvolvedor faz push para a branch `main`. O GitHub Actions intercepta e roda obrigatoriamente o job `bouncer` (testes, typecheck, lints).
- **Aperto de Mão (Promovendo Branch):** Se, e somente se, o `bouncer` passar com sucesso, o GitHub Actions realiza um force-push automatizado da `main` para a branch `production`.
- **Compilação Nativa:** O Worker do `painel-prime` na Cloudflare está configurado para escutar exclusivamente a branch `production`. É expressamente proibido alterar o `ci.yml` para realizar deploys manuais via CLI ou adicionar fallbacks de build na raiz do projeto.
- **Configurações do Painel Cloudflare:** O diretório raiz no painel está fixado como `apps/web`, o comando de build nativo é `pnpm run build:cloudflare` e o comando de implantação é `pnpm run cf-deploy`.

---

## 6. AUTOMAÇÃO DE COMMIT (SELF-HEALING LOCKFILE)
- O repositório possui um Git Hook de pre-commit configurado em `.git/hooks/pre-commit`.
- **⚠️ Bloqueio de mobile:** O hook bloqueia commits de arquivos em `apps/mobile/` e `scripts/mobile-` por padrão. Para commits intencionais no mobile, use `git commit --no-verify`.
- Se você adicionar, remover ou modificar qualquer dependência em algum `package.json` do workspace, o hook irá rodar automaticamente o `pnpm install` para atualizar o `pnpm-lock.yaml` da raiz e incluí-lo no commit de forma transparente.
- Se o commit falhar, significa que você introduziu alguma inconsistência de pacotes. Execute `pnpm install` localmente para debugar.
- **🚫 Lockfile entre repositórios:** É EXPRESSAMENTE PROIBIDO fazer cherry-pick, merge automático ou cópia manual do `pnpm-lock.yaml` entre o monorepo (`painel-prime`) e o repositório mobile dedicado (`painel-prime-mobile`). Os dois ambientes possuem árvores de dependências com escopos diferentes. Se houver alteração de pacotes no `package.json` do escopo mobile, o lockfile DEVE ser regenerado nativamente com `pnpm install` dentro do diretório correto antes de qualquer push.
- **`.gitignore` bloqueia `apps/mobile`:** Arquivos dentro de `apps/mobile/app/`, `apps/mobile/src/` e `apps/mobile/assets/` são ignorados pelo `.gitignore`. Para adicioná-los ao commit, use `git add -f`. Isso é intencional — o repositório mobile dedicado tem seu próprio `.gitignore`.

---

## 7. ESTRUTURA DE ROTAS (EXPO ROUTER)

### Rotas Públicas (`(public)/`)
| URL | Tela |
|-----|------|
| `/landing` | LandingScreen (vídeo hero + planos) |
| `/login` | LoginScreen (email/senha + OAuth Google/Azure) |
| `/cadastro` | SignupScreen (criação de conta com trial 30d) |
| `/auth/callback` | AuthCallbackScreen (troca código OAuth por sessão) |
| `/noivos/:token` | PublicCouplePortalScreen |
| `/assinatura/:token` | PublicClientSignatureScreen |
| `/convite/:token` | PublicGuestInviteScreen |
| `/torre/:token` | PublicVendorCommandCenterScreen |

### Rotas Autenticadas (`(app)/(tabs)/`)
| Tab | URL | Tela |
|-----|-----|------|
| Início | `/dashboard` | DashboardScreen |
| Eventos | `/eventos` | EventsScreen + Stack (`:id`, `:id/torre`) |
| Clientes | `/clientes` | ClientsScreen + Stack |
| Financeiro | `/financeiro` | FinanceScreen |
| Fornecedores | `/fornecedores` | VendorsCatalogScreen |
| Mais | `/mais` | MoreScreen + Stack (perfil, saúde, planejamento, config, assinaturas) |

### Guards de Autenticação
- `app/(public)/_layout.tsx`: Se `user` existe → redirect para `/(app)`
- `app/(app)/_layout.tsx`: Se `user` é null → redirect para `/login`
- `app/index.tsx`: Se loading → spinner; se user → `/dashboard`; senão → `/landing`

### Pacote compartilhado de rotas
- `packages/app/src/routes/index.ts`: Constantes `ROUTES` (33 rotas)
- `packages/app/src/navigation.ts`: Funções `routeHrefs` (22 helpers com query params)

---

## 8. ARQUIVOS PROIBIDOS DE ALTERAÇÃO (SEM SUPERVISÃO)
| Arquivo | Motivo |
|---------|--------|
| `src/lib/supabase.ts` | Configuração crítica do cliente Supabase + SecureStore |
| `src/contexts/AuthContext.tsx` | Estado global de autenticação |
| `packages/app/src/supabase/client.ts` | Fábrica de clientes (web + native) com `requireEnv()` |
| `app.json` | Plugins, scheme, slug, projectId, newArchEnabled — NUNCA faça cherry-pick ou auto-merge deste arquivo entre repositórios. O `slug` e `extra.eas.projectId` são específicos do projeto Expo. O array `"plugins"` deve conter apenas os módulos listados na Seção 4. |
| `eas.json` | Perfil de build preview |
| `.github/workflows/preview-build.yml` | Pipeline CI/CD |
| `pnpm-lock.yaml` | Lockfile gerenciado automaticamente |

---

## 9. DOPPLER (GERENCIADOR DE SECRETS)
- **Projeto:** `painel-prime`
- **Config principal:** `dev_personal` (ambiente `dev`)
- **Comando de referência:** `doppler secrets --config dev_personal`
- **Secrets salvos:** Todos os valores reais estão no Doppler. Use `doppler secrets set KEY="value" --config dev_personal` para adicionar novos.

### Secrets Sentry Mobile
- `EXPO_PUBLIC_SENTRY_DSN` — DSN público usado pelo bundle mobile (presente em `dev_personal` e `prd`)
- `SENTRY_AUTH_TOKEN` — token usado no build para upload de source maps (presente em `dev_personal` e `prd`)

Ambos também existem como GitHub Actions secrets no repo `theproject93/painel-prime-mobile` para o workflow de build.

### Secrets Daily/Supabase Edge
- `DAILY_API_KEY` — credencial privada da API Daily; deve existir somente no Doppler e nos Edge Function Secrets do Supabase.
- `DAILY_WEBHOOK_HMAC` — segredo HMAC em Base64 usado para validar `X-Webhook-Signature` e `X-Webhook-Timestamp` antes de processar webhooks Daily.

Esses valores **nunca** podem usar prefixo `EXPO_PUBLIC_`, aparecer em GitHub Actions do mobile, ser persistidos em tabelas expostas pela Data API ou ser gravados em código. Tokens de anfitrião Daily devem ser efêmeros, emitidos pela Edge Function somente após autorização de tenant.

Ordem obrigatória para mudanças no fluxo Daily:
1. Rotacionar a chave exposta e cadastrar `DAILY_API_KEY` e `DAILY_WEBHOOK_HMAC` no Supabase/Doppler.
2. Configurar o webhook Daily com o mesmo HMAC.
3. Implantar `meeting-management`, `daily-webhook` e helpers compartilhados.
4. Aplicar a migration que remove tokens persistentes.
5. Somente então liberar os clientes WEB/mobile que consomem o link efêmero.

---

## 10. PROTOCOLO DE FLUXO DE TRABALHO
Quando o usuário solicitar uma correção (Ex: *"O botão X está quebrando"*, *"O login falhou"*):
1. **Audite os Imports:** Garanta que componentes de UI venham de `@painel-prime/ui` quando aplicável.
2. **Verifique o Crash no Dispositivo:** Se um Android estiver conectado via `adb`, desinstale a versão atual, baixe o APK do artifact do GitHub Actions ou do Firebase, instale e capture logs com `adb logcat`.
3. **Não Adivinhe Erros de Build:** Se a pipeline do GitHub falhar, utilize a CLI do GitHub (`gh run view <id> --log`) para ler o log real. Não faça novos commits baseados em suposições.
4. **Push Limpo:** Commite as alterações na branch `fix/*`, crie PR via `gh pr create`, mergeie. O GitHub Actions cuidará do build e do envio para o Firebase de forma 100% autônoma.
5. **Sempre Verifique:** `newArchEnabled`, plugins do `app.json`, env vars no Doppler, e o lockfile do pnpm antes de considerar uma tarefa concluída.
6. **Sincronização Multi-Repo:** Após modificar `apps/mobile/`, faça push para AMBOS os remotes (`origin` e `mobile`).

   **Sincronização segura Mobile → Monorepo:** Quando uma correção for feita no repo `mobile`, sincronize os arquivos equivalentes para o monorepo usando árvore Git, não redirecionamento de texto.

   Preferir:
   ```bash
   git fetch mobile
   git restore --source=mobile/<branch> -- apps/mobile/<path>
   ```

   Antes de usar `git add -f`, verificar se o arquivo é realmente ignorado:
   ```bash
   git check-ignore -v -- apps/mobile/<path>
   ```
   Se for ignorado e precisar ser versionado no monorepo:
   ```bash
   git add -f apps/mobile/<path>
   ```

   **EVITAR:**
   ```bash
   git show mobile/<branch>:apps/mobile/<path> > apps/mobile/<path>
   ```
   No Windows/PowerShell isso pode corromper encoding (BOM, null bytes, quebras de linha).

   Use `git show mobile/main:apps/mobile/app.json` para verificar o estado do repositório mobile antes de empurrar. Se os históricos divergirem, faça um branch limpo a partir de `mobile/main`, aplique apenas os arquivos de código alterados (nunca o lockfile), e rode `pnpm install` localmente para regenerar o lockfile específico daquele repositório.
7. **🚫 Validação Mobile em Duas Camadas (Fail-Fast + Smoke):**

   **Camada 1 — `check:local` (obrigatória para qualquer alteração em `apps/mobile/`):**
   ```bash
   pnpm --filter @painel-prime/mobile run check:local
   ```
   Executa `pnpm install --frozen-lockfile` seguido de `pnpm run validate` (`tsc --noEmit` + `npx expo config --type introspect --json`).

   **Camada 2 — `check:smoke` (obrigatória para alterações de runtime/native/UI):**
   ```bash
   pnpm --filter @painel-prime/mobile run check:smoke
   ```
   Exigida quando a alteração envolve: navegação, UI, dependências nativas, Expo plugins, `app.json`, `metro.config.js`, `app/_layout.tsx`, autenticação, bootstrap, gradientes SVG, ou qualquer fluxo visível ao usuário.

   O `check:smoke` sobe o Metro Bundler e envia o bundle para o dispositivo Android conectado via ADB (`npx expo start --android`). O bundle JavaScript DEVE compilar até 100% sem erros no console.

   `validate` e CI **não substituem** `check:smoke` nesses casos. Se qualquer camada falhar, o fluxo DEVE ser interrompido e corrigido localmente. NUNCA delegue a descoberta de erros de runtime para a esteira do GitHub Actions.

### Evidência obrigatória para smoke test mobile

Para mudanças de UI/runtime, `Metro bundle 100%` NÃO é smoke test suficiente.

O smoke só pode ser marcado como aprovado quando:

1. O app abrir sem RedBox, `Uncaught Error` ou tela fatal.
2. O teste rodar o código correto da branch/commit em validação, não um APK antigo da `main`.
3. O agente confirmar uma evidência visual ou textual exclusiva da branch, por exemplo:
   - novo label;
   - nova tela;
   - mudança visível de layout;
   - commit, versão ou comportamento só presente naquele PR.
4. As telas afetadas forem navegadas no dispositivo Android.
5. `adb logcat` não mostrar `FATAL EXCEPTION`, `RedBox`, `Uncaught`, `Invariant Violation`, `TypeError`, `ReferenceError` ou erro crítico de `ReactNativeJS`.
6. Para mudanças visuais, capturar screenshot ou registrar evidência observável de cada tela validada.
7. **Identidade obrigatória do smoke mobile:** O SHA testado no Android (ou Metro) deve ser exatamente o `headRefOid` do PR mobile (`gh pr view <PR> --json headRefOid`). Patches locais não publicados invalidam o smoke do PR. Nesse caso, remova o patch e repita o teste ou entregue-o em PR separado. Para o espelho no monorepo, confirme que os blobs dos arquivos mobile são idênticos.
8. **Completude operacional:** abrir uma tela, modal ou editor não prova que a funcionalidade passou. Execute ao menos a ação principal do fluxo (por exemplo: adicionar e mover um item, salvar uma alteração, aplicar um filtro ou concluir uma tarefa) e confirme o feedback de sucesso. Controles necessários devem permanecer visíveis no contexto em que a ação acontece.

Quando o dispositivo Android estiver explicitamente indisponível e o responsável autorizar validação somente por código, registre a exceção: rode testes, typecheck, `expo config --type introspect --json`, bundle e checks de encoding, mas não chame isso de smoke físico. O smoke no APK real permanece obrigatório antes da promoção para loja.

### Carregamento e biometria

- `PrimeLogoLoader` é o padrão para carregamentos bloqueantes de inicialização, tela e troca de área. `ActivityIndicator` fica restrito a ações inline curtas, como salvar, enviar, upload ou carregar mais.
- O loader bloqueante deve ocupar toda a área disponível (`flex: 1`) e centralizar marca e texto nos dois eixos. É proibido posicioná-lo com margem fixa ou deixá-lo como filho direto de um `ScrollView`, pois isso o empurra para o topo em telas altas.
- A biometria é uma trava local sobre uma sessão Supabase válida já persistida pelo SecureStore. É proibido salvar, criptografar, repetir ou reconstruir a senha do usuário.
- Sessão expirada sempre volta ao login normal. Cancelar biometria mantém o conteúdo sensível coberto e oferece “Usar e-mail e senha”.
- A inicialização biométrica deve ser vinculada ao valor estável de `user.id`, nunca à identidade do objeto `user`. Renovação de JWT/token para o mesmo usuário não pode bloquear a tela nem abrir novo prompt biométrico.
- Apenas a transição real para `background` inicia o prazo de bloqueio. O estado transitório `inactive` (incluindo diálogos do sistema) não equivale a saída do aplicativo.
- Conversas e rascunhos da Plan IA podem ser persistidos localmente por `user.id` para sobreviver a remount/background, limitados ao histórico necessário e sem JWTs, senhas ou outros secrets.
- Preferências biométricas são isoladas por `user.id`; outro usuário nunca herda a configuração do aparelho.

### Primeiro acesso humano no mobile

- Usuário autenticado sem foto de perfil deve concluir o `ProfileWelcomeGate` antes de acessar as abas: nome preferido, foto e confirmação final. Não criar botão de pular que deixe a Home impessoal.
- Nome e foto pertencem a `user_onboarding_state`; a imagem privada usa `storage-r2` com `entityType=user_avatar`. É proibido guardar imagem em base64, bucket público ou metadado local do aparelho.
- O gate deve aparecer somente na área autenticada. Falha de rede deve oferecer nova tentativa sem deslogar, perder o nome digitado ou liberar silenciosamente uma experiência incompleta.
- A Home deve consumir os mesmos `display_name` e `avatar_file_id`; não duplique perfil em tabela ou armazenamento paralelo.

### Workspace premium dos eventos

- Áreas internas de evento devem seguir divulgação progressiva: resumo e métricas úteis, uma ação principal, filtros curtos e cards de leitura; formulários ficam em `EventFormSheet` e só aparecem quando solicitados.
- Não exibir IDs técnicos (`vendor_id`, UUID, chave de documento) para a assessora. Seletores devem mostrar nomes humanos e persistir o ID apenas internamente.
- `SafeAreaView` deve ficar fora do `ScrollView`. Não some `insets.top` manualmente ao conteúdo rolável quando a safe area já protege a tela.
- Ações destrutivas devem ter tom visual de perigo e confirmação. Ações secundárias não competem com o CTA principal.
- Persistência de sessão no `expo-secure-store` deve usar o adaptador fragmentado e versionado. É proibido gravar diretamente valores grandes de sessão, porque alguns keystores Android rejeitam payloads acima de aproximadamente 2 KB.
- A lista global de fornecedores é a fonte reutilizável da assessoria. Dentro do evento, a ação canônica é vincular um fornecedor global a `event_vendors`; é proibido criar um dashboard concorrente de "Catálogo" que não alimente a operação real.
- Tarefas e Cronograma do dia devem oferecer responsáveis humanos por nome (Cliente, Você/assessoria, Fornecedor ou Equipe) e manter texto livre como alternativa. IDs técnicos nunca aparecem na interface.
- O scanner canônico de recepção é a PWA offline `/recepcao`, com token individual por membro, fila local e sincronização posterior. Web e Android devem abrir/liberar esse fluxo; não duplique a lógica offline dentro do bundle nativo.
- O Portal do Cliente e as rotas públicas existentes são contratos protegidos. Melhorias de operação interna não podem alterar rotas, tokens, payloads ou políticas do portal sem tarefa e regressão específicas.
- Quando uma entrega integrada for explicitamente autorizada a agrupar várias sprints, `check:local` continua obrigatório durante o desenvolvimento, mas o smoke físico pode ser executado uma única vez no SHA final que será promovido. Essa exceção precisa estar registrada no relatório e não permite chamar validação por código de smoke físico.

Exemplos de smoke inválido:

- "Bundle compilou 100%", mas o app abriu RedBox.
- "APK abriu", mas o APK instalado era de build antigo e não continha as mudanças do PR.
- "App abriu na landing page", mas a sprint alterava telas autenticadas que não foram navegadas.

---

## 11. COMPATIBILIDADE NODE 22 (WORKAROUNDS CONHECIDOS)
- **Bug do `undici` (Body already read):** O Node 22 possui um bug no `undici` que faz `expo start` falhar com `TypeError: Body is unusable`. Dois workarounds possíveis:
  - `NODE_OPTIONS=--no-experimental-fetch`: **desabilita** o `fetch` experimental do Node (`typeof fetch === "undefined"`).
  - `CI=1`: **não desabilita** o fetch, mas muda o modo de execução do Expo (silencia avisos, suprime UI interativa), o que frequentemente contorna o erro sem desabilitar o fetch.
- **check:smoke NÃO injeta `CI=1` implicitamente.** Para rodar `expo start` manualmente no Node 22, sempre prefixe com `$env:CI="1"` (Windows) ou `CI=1` (Unix).

---

## 12. ENCODING DE ARQUIVOS (WINDOWS)
- **PowerShell 5.1 (`Out-File -Encoding utf8`)** adiciona BOM (`U+FEFF`). Isso corrompe JSON (`package.json`, `app.json`) causando `JsonFileError: Unexpected token`.
- **PowerShell 7** grava UTF-8 sem BOM por padrão e é a versão recomendada para scripts de manipulação de arquivos.
- **Bytes NUL (0x00) e mistura UTF-16LE** são problemas distintos do BOM:
  - NUL no final do arquivo indica mistura de encoding ou contaminação binária (ex: trecho UTF-16LE anexado).
  - UTF-16LE causa aparecimento de NUL a cada 2 bytes — o arquivo fica ilegível como texto.
  - Ambos podem ser detectados com: `[System.IO.File]::ReadAllBytes($path) | Where-Object { $_ -eq 0 }`.
- **JSON (package.json, app.json, eas.json, tsconfig.json)** DEVE ser gravado em UTF-8 sem BOM. Use:
  - `[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))`
  - Verifique antes de commitar: `$bytes = [System.IO.File]::ReadAllBytes($path); $bytes[0] -eq 0xEF` retorna `$true` se BOM presente.

### Anti-mojibake obrigatório após sync mobile

Após sincronizar `apps/mobile` entre `mobile` e `origin`, é obrigatório rodar:

```bash
rg -n --pcre2 "\x{00C3}[\x{0080}-\x{00BF}]|\x{00C2}[\x{0080}-\x{00BF}]|\x{251C}|\x{2524}|\x{252C}|\x{FFFD}" apps/mobile/app apps/mobile/src --no-ignore
```

O resultado esperado é zero ocorrências, salvo falso positivo explicitamente justificado.

Também verificar BOM e null bytes nos arquivos alterados antes do commit.

Se aparecerem sequências visualmente corrompidas, como `or[mojibake]amento` no lugar de `orçamento`, `N[mojibake]o` no lugar de `Não`, `vis[mojibake]veis` no lugar de `visíveis`, `cat[mojibake]logo` no lugar de `catálogo` ou `op[mojibake]es` no lugar de `opções`, interrompa o fluxo e corrija o encoding antes de push/PR.

---

## 13. METRO BUNDLER — REPARSE POINTS (WINDOWS)
- **Diretórios `.ignored_*`:** O pnpm cria diretórios especiais como `.ignored_tailwindcss` dentro de `node_modules/`. No Windows, esses diretórios podem virar Reparse Points (junctions) que o Metro File Watcher não consegue acessar (`EACCES: permission denied, lstat`). Se o `expo start` falhar com esse erro:
  - Rode `cmd /c rmdir "packages\config\node_modules\.ignored_tailwindcss"` para remover o junction quebrado.
  - Pode haver outros diretórios `.ignored_*` em `node_modules/` de diferentes packages — remova qualquer um que cause o erro.

---

## 14. TESTES EDGE (CONVENÇÕES E GOVERNANÇA)

Todo teste de Edge Function DEVE seguir as convenções abaixo. O desrespeito a estas regras quebra a descoberta de testes e faz o CI passar sem executar as suítes corretas.

### Convenções de arquivo

| Tipo | Extensão | Runner | Mecanismo de descoberta |
|------|----------|--------|--------------------------|
| Vitest | `*.test.ts` | Vitest (`turbo run test`) | Glob no `vitest.config.ts` |
| Deno | `*_test.ts` | Deno (`deno test`) | diretório explícito + `--ignore` para excluir `*.test.ts` |

### Regras obrigatórias

1. **Nunca** use `--no-check` com Deno (nem `deno test --no-check`, nem em scripts, nem em CI). Typecheck é parte da execução dos testes.
2. O comando canônico é `pnpm test`. Ele executa nesta ordem:
   - `pnpm run check:supabase-config` (verifica paths literais no `config.toml`)
   - `turbo run test` (Vitest: testes Web + Edge compatíveis)
   - `pnpm run test:edge:deno` (Deno: testes Edge nativos)
3. Se **qualquer** etapa falhar, `pnpm test` falha. O CI depende disso.
4. Os dois runners são **obrigatórios** no CI. Nenhum deploy deve prosseguir sem ambos passarem.
5. Arquivos Vitest (`*.test.ts`) **não podem** conter APIs Deno (`Deno.test`, imports `jsr:` ou `npm:`). Arquivos Deno (`*_test.ts`) **não podem** conter APIs Vitest (`describe`, `it`, `expect`).
6. Testes Deno devem usar imports relativos com extensão `.ts` explícita (`import { x } from './modulo.ts'`), não `jsr:` ou `npm:` exceto quando inevitável.
7. Um comando Deno que termina com exit code 0 sem listar arquivos/testes executados é inválido. `pnpm run test:edge:deno` deve mostrar explicitamente as suítes e o total esperado; atualmente, `20 passed`.

### CI

O workflow `ci.yml` já instala Deno antes de executar `pnpm test`. O script `test:edge:deno` passa `supabase/functions/_shared` explicitamente e usa `--ignore=supabase/functions/_shared/*.test.ts`; isso impede um falso verde com zero testes e separa as suítes Vitest das suítes Deno.

---

## 15. LINGUAGEM CONTEXTUAL POR MODALIDADE

- Textos de áreas autenticadas que mencionem casal, noivos, debutante, aniversariante ou cliente devem ser derivados de `event_type` com `getEventPersonaCopy()` de `@painel-prime/app/eventPersona`.
- É proibido gravar linguagem matrimonial diretamente em componentes compartilhados ou telas que atendam mais de uma modalidade.
- Valores `null`, vazios ou desconhecidos devem usar o fallback neutro `generic`; nunca assumir casamento.
- Android e Web devem consumir a mesma fonte de copy no pacote compartilhado. Não criar tabelas locais concorrentes.
- Portal do Cliente, convites e sites públicos têm domínio próprio e não podem ser alterados junto com ajustes de copy interna sem autorização explícita.

---

**Última atualização:** 2026-07-14 — linguagem contextual por modalidade em áreas autenticadas Web/Android.
