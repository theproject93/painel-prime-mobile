# ­ƒñû DIRETRIZES OBRIGAT├ôRIAS DE DESENVOLVIMENTO (PAINEL PRIME)

ÔÜá´©Å **REPOSIT├ôRIO PRINCIPAL PARA ANDROID:** Toda modifica├º├úo, build, deploy ou debugging do app mobile (`apps/mobile`) deve ser feita contra o reposit├│rio **`theproject93/painel-prime-mobile`** (remote `mobile`). O reposit├│rio `theproject93/painel-prime` (remote `origin`) ├® o monorepo geral focado em WEB. Quando a tarefa mencionar "Android", "APK", "celular", "app mobile", "Expo", "React Native" ou "Fabric", o alvo ├® **sempre** `painel-prime-mobile`.

Voc├¬ ├® um Engenheiro de Software S├¬nior atuando neste monorepo (`pnpm`). Este documento ├® a LEI ABSOLUTA do projeto. Qualquer altera├º├úo de c├│digo que viole as regras abaixo quebrar├í o ecossistema e ser├í rejeitada. Leia atentamente antes de modificar qualquer arquivo.

---

## 1. CONTEXTO TECNOL├ôGICO (BLEEDING EDGE)
- **Monorepo Workspace:** Depend├¬ncias gerenciadas globalmente via `pnpm`.
- **Shared Packages:** Dependemos de `@painel-prime/app` (regras de neg├│cio, tipos) e `@painel-prime/ui` (componentes universais). Mudan├ºas aqui afetam Web e Mobile simultaneamente.
- **Mobile Environment (`apps/mobile`):** React 19.1.0, React Native 0.81.5, Expo SDK 54, e **Nova Arquitetura Ativada (`newArchEnabled: true`)**.
- **Roteamento Mobile:** `expo-router` baseado em arquivos dentro da pasta `app/`.
- **Ecossistema Multi-Reposit├│rio:** O projeto opera com dois reposit├│rios GitHub sincronizados, mas com hist├│ricos Git distintos:
  - `origin` ÔåÆ `theproject93/painel-prime` (monorepo completo: web + mobile + packages)
  - `mobile` ÔåÆ `theproject93/painel-prime-mobile` (reposit├│rio dedicado ao app Expo/React Native)
- Toda modifica├º├úo no escopo `apps/mobile/` precisa ser enviada para **ambos** os remotes. O push cego de commits do monorepo para o reposit├│rio mobile sem valida├º├úo de alinhamento ├® PROIBIDO.
- Ambos os reposit├│rios possuem workflows de CI/CD independentes (`Build Android Preview (EAS Local)`) que disparam em push para `main`.

---

## 2. VARI├üVEIS DE AMBIENTE E SUPABASE
- **Prefixo Obrigat├│rio:** No ambiente mobile, TODA vari├ível de ambiente exposta ao bundle precisa, obrigatoriamente, come├ºar com `EXPO_PUBLIC_`.
- **Core Secrets:** As chaves principais s├úo `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Valida├º├úo Cr├¡tica:** A fun├º├úo `requireEnv()` em `packages/app/src/supabase/client.ts` lan├ºa erro fatal se essas vari├íveis estiverem vazias ou ausentes. O app **n├úo abre** sem elas.
- **Persist├¬ncia de Sess├úo:** O Supabase Mobile utiliza o adaptador `expo-secure-store` para guardar os tokens de forma criptografada no sistema operacional. Nunca altere essa implementa├º├úo em `src/lib/supabase.ts`.
- **Consumo:** As env vars s├úo lidas via `process.env.EXPO_PUBLIC_SUPABASE_URL` (NUNCA via `Constants.expoConfig.extra`).
- **CI/CD:** As vari├íveis s├úo injetadas como secrets do GitHub Actions no step do `eas build --local`. Tamb├®m est├úo salvas no Doppler (`dev_personal`, projeto `painel-prime`).

---

## 3. REGRAS CR├ìTICAS ANTI-CRASH (ATEN├ç├âO M├üXIMA)
- **Nova Arquitetura (Fabric):** Com `newArchEnabled: true`, todo m├│dulo nativo precisa ter suporte a Fabric. M├│dulos sem Fabric ViewManagerAdapter **crasham em runtime** quando o componente ├® renderizado.
- **`expo-linear-gradient` (REMOVIDO):** Este m├│dulo foi completamente removido do projeto por incompatibilidade com o Fabric (Nova Arquitetura). NUNCA reinstale esta depend├¬ncia nem a adicione ao array `"plugins"` do `app.json`. Todo c├│digo que antes usava `LinearGradient` foi migrado para `react-native-svg`.
- **`react-native-svg`:** ├ë o substituto oficial para gradientes no projeto. O m├│dulo tem suporte completo a Fabric e funciona corretamente em produ├º├úo. Veja a Se├º├úo 3-A para as regras de uso obrigat├│rias de gradientes SVG.
- **OAuth / Deep Linking Scheme:** O ├║nico Deep Link v├ílido para o aplicativo ├® baseado no scheme `painelprime://`. O bundle ID correto ├® `br.com.painelprime.app`. ÔÜá´©Å **BUG CONHECIDO:** `AuthContext.tsx:78` usa `br.com.planejarpro.app://auth/callback` (herdado de projeto antigo). Corrija para `painelprime://auth/callback` ao implementar OAuth.
- **Fontes:** O arquivo `SFMono-Regular.ttf` N├âO existe em `assets/fonts/`. N├úo referencie fontes inexistentes em plugins do `app.json`.

---

## 3-A. GRADIENTES SVG COM REACT 19 (PADR├âO OFICIAL)

Todo componente visual que utilize gradientes DEVE seguir este padr├úo com `react-native-svg` + `useId()`:

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

**Regras cr├¡ticas:**
1. `useId()` ├® **obrigat├│rio** ÔÇö gera IDs ├║nicos por inst├óncia do componente, isolando escopos de gradiente no Android. Sem isso, m├║ltiplos SVG na mesma tela competem pelo mesmo `id` global e causam renderiza├º├úo incorreta.
2. Use um prefixo descritivo no `id` (ex: `gc-bg-`, `scp-icn-`, `qa-`) para facilitar debugging.
3. Para gradientes de fundo, use `StyleSheet.absoluteFill` e coloque o `<Svg>` **antes** dos children.
4. Para gradientes em elementos de tamanho fixo (├¡cones, badges), defina `width` e `height` expl├¡citos no `<Svg>`.
5. Para bordas arredondadas no `<Rect>`, use `rx` e `ry` iguais ao `borderRadius` do container.
6. **NUNCA** adicione `expo-linear-gradient` ao array de plugins do `app.json` ÔÇö isso quebra o comando `expo config --json` no build.

---

## 4. PLUGINS NATIVOS DO `app.json` (LISTA OFICIAL)
Os seguintes plugins est├úo ativos e validados em `apps/mobile/app.json`:

```json
"plugins": [
  "expo-video",
  "expo-font",
  "expo-asset",
  "expo-router",
  "expo-web-browser"
]
```

**Regra:** S├│ adicione um plugin se:
1. O m├│dulo nativo correspondente estiver em `dependencies` do `package.json`
2. O plugin N├âO causar crash no `expo config` (teste em CI antes de mergear)
3. O m├│dulo tiver suporte comprovado a Fabric (Native ViewManagerAdapter)

---

## 5. ESTREIRA DE DEPLOY & CI/CD
- **Proibido EAS Cloud:** Nunca execute builds nos servidores de nuvem da Expo (`eas build`). A cota gratuita ├® estritamente limitada a 15 builds.
- **GitHub Actions Ativo:** O empacotamento do APK ├® feito localmente e de forma infinita atrav├®s do workflow `.github/workflows/preview-build.yml`.
- **Pipeline (9 steps):** Checkout ÔåÆ Java 17 ÔåÆ pnpm ÔåÆ Node 20 ÔåÆ Install deps ÔåÆ EAS CLI ÔåÆ Build APK local ÔåÆ Upload Artifact ÔåÆ Firebase App Distribution.
- **Distribui├º├úo Automatizada:** Ao realizar o push para a branch `main`, a pipeline compila o APK e faz o upload autom├ítico para o **Firebase App Distribution** (grupo de testadores: `"testers"`, tester: `lucasfer.mail@gmail.com`).
- **Perfil de Build:** `eas.json` cont├®m apenas o perfil `preview` com `android.buildType: "apk"`.
- **Cache pnpm:** O workflow usa `pnpm/action-setup@v4` com cache autom├ítico. Se suspeitar de cache corrompido, use `pnpm install --force` no step 5.
- **Dois Runners Independentes:** O workflow `Build Android Preview (EAS Local)` existe em AMBOS os reposit├│rios (`painel-prime` e `painel-prime-mobile`). O push para `main` em qualquer um deles dispara sua respectiva pipeline. Certifique-se de que o `pnpm-lock.yaml` de cada reposit├│rio est├í consistente com seu pr├│prio `package.json` antes de empurrar.

---

## 6. AUTOMA├ç├âO DE COMMIT (SELF-HEALING LOCKFILE)
- O reposit├│rio possui um Git Hook de pre-commit configurado em `.git/hooks/pre-commit`.
- **ÔÜá´©Å Bloqueio de mobile:** O hook bloqueia commits de arquivos em `apps/mobile/` e `scripts/mobile-` por padr├úo. Para commits intencionais no mobile, use `git commit --no-verify`.
- Se voc├¬ adicionar, remover ou modificar qualquer depend├¬ncia em algum `package.json` do workspace, o hook ir├í rodar automaticamente o `pnpm install` para atualizar o `pnpm-lock.yaml` da raiz e inclu├¡-lo no commit de forma transparente.
- Se o commit falhar, significa que voc├¬ introduziu alguma inconsist├¬ncia de pacotes. Execute `pnpm install` localmente para debugar.
- **­ƒÜ½ Lockfile entre reposit├│rios:** ├ë EXPRESSAMENTE PROIBIDO fazer cherry-pick, merge autom├ítico ou c├│pia manual do `pnpm-lock.yaml` entre o monorepo (`painel-prime`) e o reposit├│rio mobile dedicado (`painel-prime-mobile`). Os dois ambientes possuem ├írvores de depend├¬ncias com escopos diferentes. Se houver altera├º├úo de pacotes no `package.json` do escopo mobile, o lockfile DEVE ser regenerado nativamente com `pnpm install` dentro do diret├│rio correto antes de qualquer push.
- **`.gitignore` bloqueia `apps/mobile`:** Arquivos dentro de `apps/mobile/app/`, `apps/mobile/src/` e `apps/mobile/assets/` s├úo ignorados pelo `.gitignore`. Para adicion├í-los ao commit, use `git add -f`. Isso ├® intencional ÔÇö o reposit├│rio mobile dedicado tem seu pr├│prio `.gitignore`.

---

## 7. ESTRUTURA DE ROTAS (EXPO ROUTER)

### Rotas P├║blicas (`(public)/`)
| URL | Tela |
|-----|------|
| `/landing` | LandingScreen (v├¡deo hero + planos) |
| `/login` | LoginScreen (email/senha + OAuth Google/Azure) |
| `/cadastro` | SignupScreen (cria├º├úo de conta com trial 30d) |
| `/auth/callback` | AuthCallbackScreen (troca c├│digo OAuth por sess├úo) |
| `/noivos/:token` | PublicCouplePortalScreen |
| `/assinatura/:token` | PublicClientSignatureScreen |
| `/convite/:token` | PublicGuestInviteScreen |
| `/torre/:token` | PublicVendorCommandCenterScreen |

### Rotas Autenticadas (`(app)/(tabs)/`)
| Tab | URL | Tela |
|-----|-----|------|
| In├¡cio | `/dashboard` | DashboardScreen |
| Eventos | `/eventos` | EventsScreen + Stack (`:id`, `:id/torre`) |
| Clientes | `/clientes` | ClientsScreen + Stack |
| Financeiro | `/financeiro` | FinanceScreen |
| Fornecedores | `/fornecedores` | VendorsCatalogScreen |
| Mais | `/mais` | MoreScreen + Stack (perfil, sa├║de, planejamento, config, assinaturas) |

### Guards de Autentica├º├úo
- `app/(public)/_layout.tsx`: Se `user` existe ÔåÆ redirect para `/(app)`
- `app/(app)/_layout.tsx`: Se `user` ├® null ÔåÆ redirect para `/login`
- `app/index.tsx`: Se loading ÔåÆ spinner; se user ÔåÆ `/dashboard`; sen├úo ÔåÆ `/landing`

### Pacote compartilhado de rotas
- `packages/app/src/routes/index.ts`: Constantes `ROUTES` (33 rotas)
- `packages/app/src/navigation.ts`: Fun├º├Áes `routeHrefs` (22 helpers com query params)

---

## 8. ARQUIVOS PROIBIDOS DE ALTERA├ç├âO (SEM SUPERVIS├âO)
| Arquivo | Motivo |
|---------|--------|
| `src/lib/supabase.ts` | Configura├º├úo cr├¡tica do cliente Supabase + SecureStore |
| `src/contexts/AuthContext.tsx` | Estado global de autentica├º├úo |
| `packages/app/src/supabase/client.ts` | F├íbrica de clientes (web + native) com `requireEnv()` |
| `app.json` | Plugins, scheme, slug, projectId, newArchEnabled ÔÇö NUNCA fa├ºa cherry-pick ou auto-merge deste arquivo entre reposit├│rios. O `slug` e `extra.eas.projectId` s├úo espec├¡ficos do projeto Expo. O array `"plugins"` deve conter apenas os m├│dulos listados na Se├º├úo 4. |
| `eas.json` | Perfil de build preview |
| `.github/workflows/preview-build.yml` | Pipeline CI/CD |
| `pnpm-lock.yaml` | Lockfile gerenciado automaticamente |

---

## 9. DOBBLER (GERENCIADOR DE SECRETS)
- **Projeto:** `painel-prime`
- **Config principal:** `dev_personal` (ambiente `dev`)
- **Comando de refer├¬ncia:** `doppler secrets --config dev_personal`
- **Secrets salvos (8):** Todos os valores reais est├úo no Doppler. Use `doppler secrets set KEY="value" --config dev_personal` para adicionar novos.

---

## 10. PROTOCOLO DE FLUXO DE TRABALHO
Quando o usu├írio solicitar uma corre├º├úo (Ex: *"O bot├úo X est├í quebrando"*, *"O login falhou"*):
1. **Audite os Imports:** Garanta que componentes de UI venham de `@painel-prime/ui` quando aplic├ível.
2. **Verifique o Crash no Dispositivo:** Se um Android estiver conectado via `adb`, desinstale a vers├úo atual, baixe o APK do artifact do GitHub Actions ou do Firebase, instale e capture logs com `adb logcat`.
3. **N├úo Adivinhe Erros de Build:** Se a pipeline do GitHub falhar, utilize a CLI do GitHub (`gh run view <id> --log`) para ler o log real. N├úo fa├ºa novos commits baseados em suposi├º├Áes.
4. **Push Limpo:** Commite as altera├º├Áes na branch `fix/*`, crie PR via `gh pr create`, mergeie. O GitHub Actions cuidar├í do build e do envio para o Firebase de forma 100% aut├┤noma.
5. **Sempre Verifique:** `newArchEnabled`, plugins do `app.json`, env vars no Doppler, e o lockfile do pnpm antes de considerar uma tarefa conclu├¡da.
6. **Sincroniza├º├úo Multi-Repo:** Ap├│s modificar `apps/mobile/`, fa├ºa push para AMBOS os remotes (`origin` e `mobile`). Use `git show mobile/main:apps/mobile/app.json` para verificar o estado do reposit├│rio mobile antes de empurrar. Se os hist├│ricos divergirem, fa├ºa um branch limpo a partir de `mobile/main`, aplique apenas os arquivos de c├│digo alterados (nunca o lockfile), e rode `pnpm install` localmente para regenerar o lockfile espec├¡fico daquele reposit├│rio.

---

**├Ültima atualiza├º├úo:** 2026-07-08 ÔÇö Refatora├º├úo completa de gradientes (SVG), corre├º├úo de OAuth e sincroniza├º├úo multi-reposit├│rio.
