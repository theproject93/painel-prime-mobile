# Plano de Redesign — Painel Prime Mobile (React Native / Expo)

> **Objetivo:** Evoluir o aplicativo para um visual premium, menos branco/estático, mais mastigado, intuitivo e voltado para assessores de eventos.
> **Autor:** Agente de código
> **Data:** 2026-07-06
> **Status:** Aguardando aprovação do usuário

---

## Contexto e Diagnóstico

**Feedback do usuário:**
- "O aplicativo está todo muito branco e estático demais, muitos números muitos texto mas pouco intuitivo"
- "Lembrar que não é um super usuário que estará usando isso, mas sim uma assessoria de eventos, quando mais coisa 'mastigada' melhor"
- "É necessário evoluir, simplificar, deixar mais colorido, com cara de app premium de eventos"
- Dashboard de clientes está longo demais
- Dashboard de fornecedores está esteticamente horrível

**Problemas identificados na auditoria do código:**
1. **Cards uniformes e brancos** — Todos os cards usam `backgroundColor: colors.card` (#FFFFFF) com borda `#E4E8EF`. Sem variação visual.
2. **Métricas como textos puros** — Números grandes sem ícones, sem cores, sem progressão visual.
3. **Filtros como pills de borda** — Sem destaque visual, sem gradiente, sem ícones.
4. **Dashboard de clientes (1003 linhas)** — Funil, fila de prioridade, forecast, execução CRM, consentimento LGPD — tudo em uma tela scrollável. Sobrecarga cognitiva.
5. **Fornecedores (916 linhas)** — Cards com foto placeholder (letra inicial), sem imagem real, sem rating, sem visual premium.
6. **Tab bar funcional mas sem personalidade** — Ícones padrão, sem badge, sem animação.
7. **Screen.tsx minimalista** — Header sem gradiente, sem ícone, sem personalidade.
8. **Eventos (591 linhas)** — Cards com imagem de capa mas sem overlay de status, sem ações rápidas.

---

## Paleta de Cores Estendida (Design Tokens)

Mantendo a identidade existente e adicionando novos tokens para o redesign:

```typescript
// Cores existentes (manter)
gold500: '#C9A54D'        // Dourado principal
royal500: '#6B5BFF'       // Roxo IA
background: '#F7F8FA'     // Fundo
surface: '#FFFFFF'        // Superfície
text: '#151922'           // Texto principal

// Novos tokens para o redesign
gold50: '#FDF8ED'         // Dourado claro para fundos sutis
gold100: '#F6ECD2'        // Dourado médio para badges
gold200: '#E8D5A0'        // Dourado para bordas
gold600: '#B8933A'        // Dourado escuro para hovers
gold700: '#9A7A2E'        // Dourado muito escuro

royal50: '#F4F2FF'        // Roxo claro para fundos
royal100: '#E8E4FF'       // Roxo médio para badges
royal400: '#8B7DFF'       // Roxo vibrante
royal600: '#5A4AE0'       // Roxo escuro

success50: '#EAF8F0'      // Verde claro fundo
success100: '#D1F5E0'     // Verde médio
success500: '#1F9D62'     // Verde principal
success600: '#178A55'     // Verde escuro

warning50: '#FFF6E5'      // Amarelo claro fundo
warning100: '#FFECC0'     // Amarelo médio
warning500: '#D98E04'     // Amarelo principal

danger50: '#FDECEC'       // Vermelho claro fundo
danger100: '#FBD5D5'      // Vermelho médio
danger500: '#D14343'      // Vermelho principal

info50: '#EFF6FF'         // Azul claro fundo
info100: '#DBEAFE'        // Azul médio
info500: '#2563EB'        // Azul principal

// Gradientes premium
gradientGold: 'linear-gradient(135deg, #C9A54D 0%, #E8D5A0 100%)'
gradientGoldVertical: 'linear-gradient(180deg, #C9A54D 0%, #B8933A 100%)'
gradientRoyal: 'linear-gradient(135deg, #6B5BFF 0%, #8B7DFF 100%)'
gradientSuccess: 'linear-gradient(135deg, #1F9D62 0%, #2BC47A 100%)'
gradientSurface: 'linear-gradient(180deg, #FFFFFF 0%, #F7F8FA 100%)'

// Sombras premium
shadowCard: '0 2px 12px rgba(15, 17, 21, 0.06)'
shadowElevated: '0 8px 32px rgba(15, 17, 21, 0.12)'
shadowGold: '0 4px 16px rgba(201, 165, 77, 0.25)'
shadowRoyal: '0 4px 16px rgba(107, 91, 255, 0.25)'

// Border radius
radiusSm: 8
radiusMd: 12
radiusLg: 16
radiusXl: 20
radiusFull: 999

// Espaçamento
spaceXs: 4
spaceSm: 8
spaceMd: 12
spaceLg: 16
spaceXl: 20
space2xl: 24
```

---

## FASE 1: Design System Upgrade

### Objetivo
Criar a fundação visual que todas as outras fases vão usar. Atualizar tokens, criar sistema de gradientes, e refatorar componentes base.

### Arquivos que mudam

#### 1.1 `apps/mobile/src/theme/colors.ts` (27 → 80 linhas)
**Mudanças:**
- Adicionar todos os novos tokens de cor listados acima
- Exportar objetos de gradiente (LinearGradient do expo-linear-gradient)
- Exportar objetos de sombra
- Exportar constantes de border radius
- Manter retrocompatibilidade com tokens existentes

**Estrutura proposta:**
```typescript
export const colors = {
  // ... tokens existentes (manter)
  
  // Novos tokens
  gold50, gold100, gold200, gold600, gold700,
  royal50, royal100, royal400, royal600,
  success100, warning100, danger100, info100,
};

export const gradients = {
  gold: ['#C9A54D', '#E8D5A0'],
  goldVertical: ['#C9A54D', '#B8933A'],
  royal: ['#6B5BFF', '#8B7DFF'],
  success: ['#1F9D62', '#2BC47A'],
  surface: ['#FFFFFF', '#F7F8FA'],
  warm: ['#FDF8ED', '#F6ECD2'],
};

export const shadows = {
  card: { shadowColor: '#0F1115', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  elevated: { shadowColor: '#0F1115', shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  gold: { shadowColor: '#C9A54D', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  royal: { shadowColor: '#6B5BFF', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
};

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 };
```

**Dependência:** `expo-linear-gradient` (já disponível via Expo SDK 54)

#### 1.2 `apps/mobile/src/components/ui/GradientCard.tsx` (NOVO, ~80 linhas)
**Componente reutilizável para cards com gradiente no topo ou fundo.**

**Props:**
- `gradient?: keyof typeof gradients` — qual gradiente aplicar
- `gradientPosition?: 'top' | 'background' | 'accent-bar'` — posição do gradiente
- `accentColor?: string` — cor da barra lateral de destaque
- `children: ReactNode`
- `style?: ViewStyle`

**Visual:**
```
┌─────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░│ ← Gradiente sutil no topo (height: 4-6px)
│                         │
│  [Ícone]  Título        │
│           Descrição     │
│                         │
│  [Botão]     [Badge]    │
│                         │
└─────────────────────────┘
  Sombra: shadowCard
  Border: 1px #E4E8EF
  Radius: 16
```

#### 1.3 `apps/mobile/src/components/ui/ProgressRing.tsx` (NOVO, ~100 linhas)
**Anel de progresso SVG para métricas visuais.**

**Props:**
- `progress: number` (0-100)
- `size?: number` (default 64)
- `strokeWidth?: number` (default 6)
- `color?: string` (default gold500)
- `label?: string`
- `sublabel?: string`

**Implementação:** Usar `react-native-svg` (já disponível no Expo SDK 54) para desenhar dois arcos — fundo cinza e progresso colorido.

#### 1.4 `apps/mobile/src/components/ui/StatCardPremium.tsx` (NOVO, ~90 linhas)
**Substitui o MetricCard genérico. Mais visual, mastigado.**

**Props:**
- `title: string`
- `value: string | number`
- `subtitle?: string`
- `icon: keyof typeof Ionicons.glyphMap`
- `gradient?: keyof typeof gradients`
- `trend?: 'up' | 'down' | 'neutral'`
- `trendValue?: string`

**Visual:**
```
┌─────────────────────────────┐
│  ┌──────┐                   │
│  │ 🎯   │  Eventos ativos   │
│  │      │  12               │
│  └──────┘  +2 esta semana   │
│                             │
│  ████████████░░░░ 75%       │ ← Barra de progresso sutil
└─────────────────────────────┘
  Background: gradiente sutil gold50 → white
  Shadow: shadowCard
```

#### 1.5 `apps/mobile/src/components/ui/Badge.tsx` (NOVO, ~50 linhas)
**Badge de status com cor e ícone.**

**Props:**
- `label: string`
- `variant: 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'royal'`
- `size?: 'sm' | 'md'`
- `icon?: keyof typeof Ionicons.glyphMap`

**Visual:**
```
● Confirmado     (verde)
● Pendente       (amarelo)
● Atrasado       (vermelho)
● Em análise     (azul)
● VIP            (dourado com gradiente)
```

#### 1.6 `apps/mobile/src/components/ui/QuickAction.tsx` (NOVO, ~60 linhas)
**Botão de ação rápida com ícone grande e gradiente.**

**Props:**
- `label: string`
- `icon: keyof typeof Ionicons.glyphMap`
- `gradient?: keyof typeof gradients`
- `onPress: () => void`
- `badge?: number`

**Visual:**
```
  ┌──────────┐
  │   📧     │  ← Ícone em gradiente royal
  │  Enviar  │
  │   RSVP   │
  │    (3)   │  ← Badge vermelho se houver
  └──────────┘
```

#### 1.7 `apps/mobile/src/components/ui/SectionHeader.tsx` (NOVO, ~40 linhas)
**Header de seção com título, subtítulo e ação opcional.**

**Props:**
- `title: string`
- `subtitle?: string`
- `action?: { label: string; onPress: () => void }`
- `icon?: keyof typeof Ionicons.glyphMap`

**Visual:**
```
📋 Top Pendências           [Ver todas →]
   Itens que precisam de atenção imediata
```

#### 1.8 `apps/mobile/src/components/Screen.tsx` (45 → 70 linhas)
**Mudanças:**
- Header com gradiente sutil de fundo (gold50 → transparente)
- Ícone decorativo ao lado do título
- Subtítulo com ícone de info opcional
- SafeArea superior com cor do gradiente

**Visual atual:**
```
┌─────────────────────────┐
│ (fundo branco)          │
│ Título                  │
│ Subtítulo               │
└─────────────────────────┘
```

**Visual proposto:**
```
┌─────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░│ ← Gradiente gold50 → transparente
│ ★ Título                │
│   Subtítulo             │
│                         │
```

**Dependência:** `expo-linear-gradient`

### Resumo da Fase 1

| Item | Arquivo | Linhas estimadas |
|------|---------|-----------------|
| Tokens de cor | `theme/colors.ts` | 27 → 80 (+53) |
| GradientCard | `ui/GradientCard.tsx` | NOVO ~80 |
| ProgressRing | `ui/ProgressRing.tsx` | NOVO ~100 |
| StatCardPremium | `ui/StatCardPremium.tsx` | NOVO ~90 |
| Badge | `ui/Badge.tsx` | NOVO ~50 |
| QuickAction | `ui/QuickAction.tsx` | NOVO ~60 |
| SectionHeader | `ui/SectionHeader.tsx` | NOVO ~40 |
| Screen | `components/Screen.tsx` | 45 → 70 (+25) |
| **Total Fase 1** | | **~578 linhas novas/modificadas** |

### Dependências novas
- `expo-linear-gradient` (Expo SDK 54 — já incluído)
- `react-native-svg` (Expo SDK 54 — já incluído)

---

## FASE 2: Dashboard Redesign

### Objetivo
Transformar o DashboardScreen de uma lista de métricas textuais em um painel visual premium com cards gradientes, anéis de progresso, atalhos visuais e dados mastigados.

### Arquivo principal: `apps/mobile/src/screens/DashboardScreen.tsx` (614 → ~450 linhas)

**Estrutura atual (problemas):**
```
Pipeline Comercial → 3 números puros lado a lado
Métricas → 3 cards brancos com texto
Top pendências → Lista de texto com botão "Resolver"
Atalhos inteligentes → Grid de botões de borda
Próximos 7 dias → Lista de texto
Modal de seleção de evento
```

**Estrutura proposta:**
```
Header com gradiente e saudação personalizada
├── Resumo Rápido (3 StatCardPremium com ícones e gradientes)
├── Próximo Evento (card hero com imagem de fundo e countdown)
├── Pendências Críticas (cards com Badge de severidade)
├── Ações Rápidas (grid de QuickAction com ícones)
├── Agenda 7 Dias (timeline visual compacta)
└── Modal de seleção de evento (redesenhado com cards)
```

### Mudanças específicas

#### 2.1 Header com Saudação Personalizada
**Atual:** `<Screen title="Painel Prime" subtitle="Operação central da assessoria">`
**Proposto:** Saudação com nome do usuário (se disponível), ícone de estrela dourada, gradiente sutil.

```tsx
<View style={styles.heroHeader}>
  <LinearGradient colors={gradients.warm} style={styles.heroGradient}>
    <View style={styles.heroContent}>
      <Ionicons name="star" size={20} color={colors.gold500} />
      <Text style={styles.heroGreeting}>Bom dia, {firstName}!</Text>
    </View>
    <Text style={styles.heroSubtitle}>Operação central da assessoria</Text>
  </LinearGradient>
</View>
```

#### 2.2 Resumo Rápido — 3 StatCardPremium
**Atual:**
```
Pipeline Comercial
12  |  5  |  R$ 45.000
Lead  Evento Orçamento
```

**Proposto:** 3 cards com ícone, gradiente de fundo, trend indicator.
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🟣 Leads     │ │ 🟡 Eventos   │ │ 💰 Orçamento │
│    12        │ │    5         │ │ R$ 45.000    │
│  +3 mês      │ │  2 ativos    │ │  ↑ 12%       │
└──────────────┘ └──────────────┘ └──────────────┘
  royal50 bg      gold50 bg        success50 bg
```

**Cores:** Cada card usa a cor de fundo do seu tema (royal50, gold50, success50) em vez de branco puro.

#### 2.3 Próximo Evento — Card Hero
**Atual:** Texto "Próximo evento: Casamento Fulano, Faltam 12 dias"
**Proposto:** Card com imagem de fundo (capa do evento), overlay escuro, countdown grande.

```
┌─────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Imagem do evento
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Overlay gradiente
│ Casamento Ana & Pedro           │
│ 📅 15/08/2026 • 12 dias        │
│ ████████████░░░░ 75% completo   │ ← ProgressRing sutil
└─────────────────────────────────┘
  Sombra: shadowGold
  Radius: 20
```

**Se não houver próximo evento:** Card com gradiente royal e CTA "Criar primeiro evento".

#### 2.4 Pendências Críticas — Cards com Badge
**Atual:** Lista de texto com "Resolver" button.
**Proposto:** Cards com cor de fundo baseada na severidade + Badge.

```
┌─────────────────────────────────┐
│ 🔴 3 tarefas atrasadas         │ ← Badge danger
│    Casamento Ana & Pedro        │
│    Priorize o cronograma        │
│                    [Resolver →] │
├─────────────────────────────────┤
│ 🟡 12 RSVPs pendentes          │ ← Badge warning
│    Evento Corporativo X         │
│    Envio em massa recomendado   │
│                    [Resolver →] │
├─────────────────────────────────┤
│ 🟣 Fornecedor buffet ausente    │ ← Badge royal
│    Casamento Ana & Pedro        │
│    Cadastre para evitar lacuna  │
│                    [Resolver →] │
└─────────────────────────────────┘
```

**Cores de fundo por severidade:**
- Crítico (score > 90): `danger50` (#FDECEC)
- Médio (score 70-90): `warning50` (#FFF6E5)
- Baixo (score < 70): `info50` (#EFF6FF)

#### 2.5 Ações Rápidas — Grid de QuickAction
**Atual:** Grid de botões com borda e texto.
**Proposto:** Grid 2x2 de QuickAction com ícones grandes em gradiente.

```
┌──────────────┐ ┌──────────────┐
│  📧          │ │  🏪          │
│  Enviar      │ │  Ajustar     │
│  RSVP        │ │  Fornecedores│
│     (3)      │ │              │
└──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐
│  📋          │ │  💰          │
│  Revisar     │ │  Financeiro  │
│  Cronograma  │ │  do Evento   │
│              │ │              │
└──────────────┘ └──────────────┘
```

**Gradientes:** Cada botão usa um gradiente diferente (royal, gold, success, info).

#### 2.6 Agenda 7 Dias — Timeline Visual
**Atual:** Lista de texto com data e título.
**Proposto:** Timeline com linha vertical, pontos coloridos e cards compactos.

```
Hoje
  ● ─── Tarefa: Enviar convites
  │     Casamento Ana • 10:00
  │
Amanhã
  ● ─── Reunião com buffet
  │     Evento Corp X • 14:00
  │
Quarta
  ● ─── Finalizar decoração
        Casamento Ana • 09:00
```

#### 2.7 Modal de Seleção de Evento (Redesenhado)
**Atual:** Lista de botões de texto com borda.
**Proposto:** Cards com imagem do evento, nome, data e radio button estilizado.

### Resumo da Fase 2

| Item | Mudança | Linhas estimadas |
|------|---------|-----------------|
| Header com saudação | Novo componente no DashboardScreen | ~30 |
| StatCardPremium x3 | Substitui pipelineRow | ~40 |
| Card Hero Próximo Evento | Substitui metricCard de próximo evento | ~50 |
| Pendências com Badge | Substitui lista de pendências | ~60 |
| QuickAction grid | Substitui shortcutGrid | ~40 |
| Timeline visual | Substitui agendaNextDays | ~50 |
| Modal redesenhado | Substitui Modal atual | ~40 |
| Estilos novos/atualizados | StyleSheet | ~80 |
| **Total Fase 2** | | **~390 linhas** |

---

## FASE 3: Events List Redesign

### Objetivo
Transformar a lista de eventos em um carrossel visual premium com cards que mostram imagem, status, countdown e ações rápidas.

### Arquivo principal: `apps/mobile/src/screens/EventsScreen.tsx` (591 → ~500 linhas)

### Mudanças específicas

#### 3.1 Header com Botão Criar Premium
**Atual:** Botão "Novo" simples dourado.
**Proposto:** Botão com gradiente gold e ícone +.

```tsx
<Pressable style={styles.newButton}>
  <LinearGradient colors={gradients.gold} style={styles.newButtonGradient}>
    <Ionicons name="add" size={18} color={colors.primaryTextOn} />
    <Text style={styles.newButtonText}>Novo Evento</Text>
  </LinearGradient>
</Pressable>
```

#### 3.2 Filtros com Ícones
**Atual:** Pills de texto "Todos", "Ativos", "Concluídos".
**Proposto:** Pills com ícone e contadores.

```
[Todos (12)] [🟢 Ativos (8)] [✅ Concluídos (4)]
```

**Cores:**
- Todos: `border: colors.border, bg: colors.card`
- Ativos: `border: colors.success500, bg: colors.success50`
- Concluídos: `border: colors.gold500, bg: colors.gold50`

#### 3.3 Event Cards com Overlay de Status
**Atual:** Card com imagem, nome, data/local, status como pill dourado.
**Proposto:** Card com imagem full-width, overlay gradiente, status badge, countdown, ações rápidas.

**Visual proposto:**
```
┌─────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Imagem do evento
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Overlay gradiente
│ 🟢 Ativo                 12d  │ ← Badge status + countdown
│                              │
│ Casamento Ana & Pedro         │
│ 📅 15/08/2026                │
│ 📍 Espaço Luxe, BH           │
│                              │
│ [▶ Abrir]  [📋 Tarefas]     │ ← Ações rápidas
└─────────────────────────────────┘
  Sombra: shadowCard
  Radius: 20
```

**Cores do overlay:**
- Gradiente de baixo para cima: `rgba(0,0,0,0.7) → transparente`
- Status "active": Badge `success50` com ícone verde
- Status "completed": Badge `gold50` com ícone dourado
- Countdown: Texto branco em negrito

#### 3.4 Empty State Premium
**Atual:** Texto "Nenhum evento encontrado"
**Proposto:** Ilustração + mensagem + CTA com gradiente.

```
┌─────────────────────────────────┐
│                                 │
│        🎉 (ícone grande)       │
│                                 │
│   Nenhum evento encontrado      │
│   Crie seu primeiro evento      │
│   para começar a planejar.      │
│                                 │
│   [✨ Criar Primeiro Evento]   │ ← Botão com gradiente royal
│                                 │
└─────────────────────────────────┘
```

#### 3.5 Modal de Criar Evento Redesenhado
**Atual:** Modal com inputs e grid de tipo de evento.
**Proposto:** Modal com cards de tipo de evento maiores, preview da capa maior, botão criar com gradiente.

**Tipo de evento cards:**
```
┌──────────────┐ ┌──────────────┐
│ ▓▓ Imagem ▓▓ │ │ ▓▓ Imagem ▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓ │
│ Casamento ✓  │ │ Aniversário  │
└──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐
│ ▓▓ Imagem ▓▓ │ │ ▓▓ Imagem ▓▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓▓▓▓▓ │
│ Debutante    │ │ Corporativo  │
└──────────────┘ └──────────────┘
```

**Border selecionado:** 3px `gold500` com sombra `shadowGold`.

### Resumo da Fase 3

| Item | Mudança | Linhas estimadas |
|------|---------|-----------------|
| Header com botão gradiente | Atualiza newButton | ~15 |
| Filtros com ícones e contadores | Atualiza typeRow | ~25 |
| Event cards com overlay | Substitui eventCard | ~60 |
| Empty state premium | Substitui emptyState | ~30 |
| Modal redesenhado | Atualiza modal | ~50 |
| Estilos | StyleSheet | ~60 |
| **Total Fase 3** | | **~240 linhas** |

---

## FASE 4: Clients Dashboard Redesign

### Objetivo
Simplificar a tela de clientes (atualmente 1003 linhas) com layout seccionado, tabs, áreas colapsáveis e menos números. Focar no que é "mastigado" para o assessor de eventos.

### Arquivo principal: `apps/mobile/src/screens/ClientsScreen.tsx` (1003 → ~700 linhas)

### Problemas atuais
1. **Métricas na parte superior** — 3 MetricCards genéricos + pipeline + forecast + fila de prioridade + execução CRM. Tudo visível de uma vez.
2. **Funil horizontal** — Board scrollável horizontal com 5 colunas, cada uma com cards de texto.
3. **Cliente selecionado** — Seção gigante com interações, follow-ups, documentos, assinatura, consentimento LGPD.
4. **Forecast e Execução** — Mais cards de texto no final.

### Estrutura proposta

```
Header com título e botão "Novo Cliente"
├── Tabs: [Visão Geral] [Funil] [Follow-ups] [Documentos]
├── Visão Geral (padrão):
│   ├── 3 StatCardPremium com ícones
│   ├── Próximos Follow-ups (lista compacta com Badge)
│   └── Últimas Interações (timeline)
├── Funil:
│   ├── Busca + Filtros de etapa
│   ├── Kanban visual com colunas colapsáveis
│   └── Cards de cliente com avatar, nome, etapa, valor
├── Follow-ups:
│   ├── Lista de follow-ups com data e status
│   └── Botão "Concluir" com animação
└── Documentos:
    ├── Lista de documentos por cliente
    └── Status de assinatura
```

### Mudanças específicas

#### 4.1 Tabs de Navegação Interna
**Atual:** Tudo em uma única ScrollView gigante.
**Proposto:** 4 tabs internas que separam as responsabilidades.

```tsx
const [activeTab, setActiveTab] = useState<'overview' | 'funnel' | 'followups' | 'docs'>('overview');
```

**Visual das tabs:**
```
[ Visão Geral ] [ Funil ] [ Follow-ups ] [ Documentos ]
     ↓              ↓           ↓              ↓
  Ícone home    Ícone funnel  Ícone checklist  Ícone doc
```

**Cores:**
- Tab ativa: `gold500` text, `gold50` bg, borda inferior `gold500`
- Tab inativa: `mutedText`, sem bg

#### 4.2 Visão Geral — Cards Mastigados
**Atual:** 3 MetricCards + pipeline + forecast + fila + execução.
**Proposto:** Apenas o essencial mastigado.

```
┌─────────────────────────────────┐
│ 📊 Resumo do CRM               │
├─────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌────┐ │
│ │ 👥      │ │ 📋      │ │ 💰│ │
│ │ 24      │ │ 8       │ │ R$ │ │
│ │ clientes│ │ follow- │ │120k│ │
│ │ ativos  │ │ ups     │ │    │ │
│ └─────────┘ └─────────┘ └────┘ │
├─────────────────────────────────┤
│ 📅 Próximos Follow-ups          │
│ ┌───────────────────────────┐   │
│ │ ● Ana Silva • Amanhã     │   │
│ │   Ligação de retorno      │   │
│ ├───────────────────────────┤   │
│ │ ● Pedro Santos • Qua     │   │
│ │   Enviar proposta         │   │
│ └───────────────────────────┘   │
├─────────────────────────────────┤
│ 🕐 Últimas Interações           │
│ ┌───────────────────────────┐   │
│ │ 📱 WhatsApp • Ana Silva   │   │
│ │ "Confirmou interesse"     │   │
│ │ Há 2 horas                │   │
│ └───────────────────────────┘   │
└─────────────────────────────────┘
```

**Cores:**
- StatCards: Fundos coloridos (gold50, royal50, success50)
- Follow-ups: Badges de urgência (danger para atrasados, warning para hoje, info para futuro)
- Interações: Timeline com ícone do canal (WhatsApp verde, email azul, ligação dourado)

#### 4.3 Funil — Kanban Visual
**Atual:** Board horizontal scrollável com colunas brancas.
**Proposto:** Kanban com colunas colapsáveis, cards com avatar, valor e badge de etapa.

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Conhecendo   │ │ Analisando   │ │ Assinatura   │
│ (5)          │ │ (3)          │ │ (2)          │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ │ AS Ana S │ │ │ │ PS Pedro │ │ │ │ ML Maria │ │
│ │ Casamento│ │ │ │ Corporate│ │ │ │ Anivers. │ │
│ │ R$ 45.000│ │ │ │ R$ 28.000│ │ │ │ R$ 15.000│ │
│ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
│ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ │ JO João  │ │ │ │ CL Carla │ │ │ │ RF Rosa  │ │
│ │ Debutante│ │ │ │ Casamento│ │ │ │ Casamento│ │
│ │ R$ 22.000│ │ │ │ R$ 35.000│ │ │ │ R$ 52.000│ │
│ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Cores por etapa:**
- Conhecendo cliente: `info50` (#EFF6FF) header, `info500` badge
- Analisando orçamento: `warning50` (#FFF6E5) header, `warning500` badge
- Assinatura contrato: `royal50` (#F4F2FF) header, `royal500` badge
- Cliente fechado: `success50` (#EAF8F0) header, `success500` badge
- Cliente perdido: `danger50` (#FDECEC) header, `danger500` badge

**Cards de cliente:**
```
┌────────────────────┐
│ 👤 Ana Silva       │
│ 💍 Casamento       │
│ 📅 15/08/2026      │
│ 💰 R$ 45.000       │ ← Texto gold600
│ 🟡 Analisando      │ ← Badge warning
└────────────────────┘
  Radius: 12
  Shadow: shadowCard
```

#### 4.4 Colapsável de Detalhes do Cliente
**Atual:** Seção gigante com tudo expandido.
**Proposto:** Accordion/colapsável por seção.

```
┌─────────────────────────────────┐
│ 👤 Ana Silva                    │
│ 📧 ana@email.com | 📱 (31) 9...│
│ ▼ Detalhes do Cliente           │ ← Clicável
├─────────────────────────────────┤
│   Etapa: [Conhecendo] [Analisando] [Assinatura] [Fechado] [Perdido]
│   Tipo: Casamento | Data: 15/08/2026
│   Orçamento: R$ 45.000
├─────────────────────────────────┤
│ ▶ Registrar Interação           │ ← Colapsado
├─────────────────────────────────┤
│ ▶ Histórico de Interações (3)   │ ← Colapsado com contador
├─────────────────────────────────┤
│ ▶ Documentos (2)                │ ← Colapsado com contador
├─────────────────────────────────┤
│ ▶ Consentimento LGPD            │ ← Colapsado
└─────────────────────────────────┘
```

**Cores:**
- Seção expandida: Fundo `card` branco
- Seção colapsada: Fundo `surfaceSubtle` (#F2F4F7)
- Ícone de expandir: `mutedText`, animação de rotação

#### 4.5 Remover ou Simplificar
- **Fila de prioridade** → Mover para tab "Visão Geral" como seção compacta (top 3)
- **Forecast por etapa** → Mover para tab "Funil" como métrica no header
- **Execução CRM** → Remover da tela principal (é métrica de admin)
- **Funil (seção separada)** → Mover para tab "Funil"

### Resumo da Fase 4

| Item | Mudança | Linhas estimadas |
|------|---------|-----------------|
| Tabs de navegação | Novo componente | ~40 |
| Visão Geral mastigada | Substitui métricas + pipeline | ~80 |
| Kanban visual | Substitui board horizontal | ~100 |
| Cards de cliente | Cards com avatar e badge | ~50 |
| Accordion de detalhes | Substitui seção expandida | ~60 |
| Remoção de seções | Delete de código | -150 |
| Estilos | StyleSheet | ~80 |
| **Total Fase 4** | | **~260 linhas (com remoção de ~150)** |

---

## FASE 5: Vendors Redesign

### Objetivo
Transformar o catálogo de fornecedores de uma lista funcional em uma vitrine visual premium com cards que mostram imagem real, rating, localização e ações de contato rápidas.

### Arquivo principal: `apps/mobile/src/screens/VendorsCatalogScreen.tsx` (916 → ~650 linhas)

### Problemas atuais
1. **Foto placeholder** — Letra inicial em fundo dourado. Sem imagem real.
2. **Cards de texto** — Nome, categoria, contato, ações. Sem visual premium.
3. **Filtros de categoria** — Pills simples sem ícone.
4. **Sem rating** — Não há sistema de avaliação visual.
5. **Contato como texto** — Phone, WhatsApp, Email como chips de borda.

### Mudanças específicas

#### 5.1 Header com Busca Premium
**Atual:** Título + botão "Novo" + input de busca simples.
**Proposto:** Header com gradiente sutil + busca com ícone + botão "Novo" com gradiente.

```
┌─────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← Gradiente gold50
│ Fornecedores                    │
│ Catálogo de parceiros           │
│                                 │
│ 🔍 Buscar fornecedor...        │ ← Input com ícone
│                                 │
│ [✨ Novo Fornecedor]            │ ← Botão gradiente gold
└─────────────────────────────────┘
```

#### 5.2 Category Chips com Ícones
**Atual:** Pills de texto simples.
**Proposto:** Chips com ícone representativo + contadores.

```
[🍽️ Todos (24)] [🎵 Música (5)] [📸 Foto (4)] [🎂 Buffet (3)] [💐 Decoração (2)]
```

**Cores:**
- Chip ativo: `gold500` bg, `primaryTextOn` text
- Chip inativo: `card` bg, `border` border, `text` text

#### 5.3 Vendor Cards com Imagem Real
**Atual:** Card com foto placeholder (letra), nome, categoria badge, localização, contatos, ações.
**Proposto:** Card com imagem de capa (ou placeholder premium), overlay de categoria, rating, localização com ícone, ações de contato como botões de ícone.

**Visual proposto:**
```
┌─────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← Imagem de capa (ou placeholder premium)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Overlay gradiente
│ 📸 Foto            ★★★★★      │ ← Categoria + Rating
│                              │
│ Lumière Filmes                │ ← Nome grande
│ 📍 Belo Horizonte, MG        │ ← Localização com ícone
│ 💰 $$$ - Premium              │ ← Faixa de preço
│                              │
│ ┌─────┐ ┌─────┐ ┌─────┐     │
│ │ 📱  │ │ 💬  │ │ 📧  │     │ ← Botões de contato
│ │Ligar│ │WA   │ │Email│     │    com ícones grandes
│ └─────┘ └─────┘ └─────┘     │
│                              │
│ [✏️ Editar]    [⬆️][⬇️]      │ ← Ações de reordenação
└─────────────────────────────────┘
  Sombra: shadowCard
  Radius: 16
```

**Se não tiver imagem:** Placeholder premium com gradiente `gold` → `gold200` e ícone da categoria.

```
┌─────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← Gradiente gold
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░  📸  ░░░░░░░░░░░░░░░░░░│ ← Ícone da categoria
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────┘
```

#### 5.4 Botões de Contato Premium
**Atual:** Chips de borda com ícone pequeno.
**Proposto:** Botões de ícone grandes com fundo colorido.

```
┌─────┐ ┌─────┐ ┌─────┐
│     │ │     │ │     │
│  📱 │ │  💬 │ │  📧 │
│     │ │     │ │     │
│Ligar│ │WhatsApp│ │Email│
└─────┘ └─────┘ └─────┘
  bg:     bg:      bg:
  gold50  success50  info50
  color:  color:     color:
  gold500 success500 info500
```

**Tamanho:** 56x56 px, border radius 14, ícone 22px.

#### 5.5 Empty State Premium
**Atual:** Componente EmptyState genérico.
**Proposto:** Ilustração temática + mensagem + CTA.

```
┌─────────────────────────────────┐
│                                 │
│        🏪 (ícone grande)       │
│                                 │
│   Nenhum fornecedor cadastrado  │
│   Monte seu catálogo de         │
│   parceiros de confiança.       │
│                                 │
│   [✨ Cadastrar Fornecedor]    │
│                                 │
└─────────────────────────────────┘
```

#### 5.6 Modal de Criar/Editar Redesenhado
**Atual:** Modal com muitos inputs e pills de categoria.
**Proposto:** Modal com seções visuais, preview da imagem, categorias com ícones.

**Seções do modal:**
1. **Informações Básicas** — Nome, categoria (com ícone), faixa de preço
2. **Contato** — Telefone, WhatsApp, Email (com ícones)
3. **Localização** — Cidade, Estado
4. **Imagem de Capa** — Upload ou URL com preview
5. **Vitrine** — Toggle com preview

### Resumo da Fase 5

| Item | Mudança | Linhas estimadas |
|------|---------|-----------------|
| Header premium | Atualiza header | ~25 |
| Category chips com ícones | Atualiza categoryRow | ~30 |
| Vendor cards com imagem | Substitui vendorCard | ~80 |
| Botões de contato | Substitui contactRow | ~40 |
| Empty state premium | Substitui EmptyState | ~30 |
| Modal redesenhado | Atualiza modal | ~70 |
| Estilos | StyleSheet | ~80 |
| **Total Fase 5** | | **~355 linhas** |

---

## FASE 6: Navigation Polish

### Objetivo
Elevar a experiência de navegação com tab bar premium, floating actions, transições suaves e microinterações.

### Arquivos que mudam

#### 6.1 `app/(app)/(tabs)/_layout.tsx` (80 → ~120 linhas)
**Mudanças na Tab Bar:**

**Visual atual:**
```
┌─────────────────────────────────────────────┐
│  🏠      📅      👥      💰      🏪      ⋯   │
│ Início  Eventos Clientes Financeiro Forn. Mais│
└─────────────────────────────────────────────┘
  Fundo: #FFFFFF
  Borda: hairline #E4E8EF
  Ícone ativo: #A98535
  Ícone inativo: #8A93A6
```

**Visual proposto:**
```
┌─────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← Gradiente sutil
│  🏠      📅      👥      💰      🏪      ⋯   │
│ Início  Eventos Clientes Financeiro Forn. Mais│
│   ●                                      ●   │ ← Indicador de badge
└─────────────────────────────────────────────┘
  Fundo: gradiente gold50 → white
  Borda: superior invisível (gradiente faz a separação)
  Ícone ativo: gradiente gold → com sombra gold sutil
  Ícone inativo: #8A93A6
  Indicador ativo: bolinha dourada abaixo do ícone
  Shadow: shadowElevated
```

**Mudanças de código:**
```tsx
tabBarStyle: {
  height: 68,
  paddingBottom: 8,
  paddingTop: 8,
  backgroundColor: 'transparent', // Transparente para gradiente
  borderTopWidth: 0, // Sem borda
  shadowColor: '#0F1115',
  shadowOpacity: 0.10,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: -10 },
  elevation: 16,
},
```

**Adicionar indicador ativo personalizado:**
```tsx
tabBarActiveTintColor: colors.gold500,
// Adicionar dot indicator via custom tabBar prop
```

#### 6.2 Floating Action Button (FAB) — `apps/mobile/src/components/ui/FloatingActionButton.tsx` (NOVO, ~80 linhas)
**FAB que aparece em telas específicas (Dashboard, Eventos, Clientes).**

**Visual:**
```
                          ┌─────┐
                          │  +  │ ← Gradiente gold, 56px
                          └─────┘
                            ↓
                      [Criar Evento]
                      [Novo Cliente]
                      [Nova Despesa]
```

**Comportamento:**
- Posição: canto inferior direito, 20px das bordas
- Ao tocar: expande para mostrar 2-3 ações rápidas
- Animação: spring com Reanimated (já instalado)
- Só aparece nas telas principais (não em modais ou detalhes)

#### 6.3 Transições de Tela — `apps/mobile/src/components/ScreenTransition.tsx` (NOVO, ~40 linhas)
**Wrapper para transições suaves entre telas.**

**Opções:**
- `slideFromRight` — Padrão para navegação para frente
- `slideUp` — Para modais e detalhes
- `fadeIn` — Para carregamento de conteúdo

**Implementação:** Usar `react-native-reanimated` (já instalado) para animações de entrada/saída.

#### 6.4 Microinterações
**Adicionar feedback visual em ações:**

1. **Botões com press feedback** — Scale 0.97 ao pressionar, voltar ao normal com spring
2. **Cards com hover/press** — Leve elevação ao pressionar
3. **Toggle de status** — Animação de cor suave
4. **Pull-to-refresh** — Indicador customizado com gradiente gold
5. **Listas vazias** — Fade in do empty state

**Implementação:** Usar `Animated.createAnimatedComponent` do Reanimated para todos os feedbacks.

#### 6.5 Loading States Premium
**Atual:** `ActivityIndicator` genérico dourado.
**Proposto:** Skeleton screens com shimmer effect.

```
┌─────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← Skeleton com shimmer
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░            │
└─────────────────────────────────┘
  Shimmer: gradiente linear animado de -100% para 200%
  Cor base: #F2F4F7
  Cor shimmer: #FFFFFF
  Duração: 1.5s loop
```

**Implementação:** Usar `react-native-reanimated` para animação do shimmer.

#### 6.6 Badges na Tab Bar
**Adicionar badges de notificação:**

```
  🏠      📅      👥      💰      🏪      ⋯
       (3)                (1)
```

- **Dashboard:** Badge com número de pendências críticas
- **Clientes:** Badge com número de follow-ups atrasados
- **Financeiro:** Badge com número de pagamentos pendentes

**Visual do badge:**
- Fundo: `danger500` (#D14343)
- Texto: branco, fonte 10px bold
- Posição: canto superior direito do ícone
- Animação: pulse sutil a cada 30 segundos se houver notificações

### Resumo da Fase 6

| Item | Arquivo | Linhas estimadas |
|------|---------|-----------------|
| Tab bar premium | `_layout.tsx` | 80 → 120 (+40) |
| FAB | `ui/FloatingActionButton.tsx` | NOVO ~80 |
| Screen transition | `ui/ScreenTransition.tsx` | NOVO ~40 |
| Microinterações | Diversos arquivos | ~60 |
| Loading states | `ui/SkeletonShimmer.tsx` | NOVO ~60 |
| Badges na tab bar | `_layout.tsx` | ~30 |
| **Total Fase 6** | | **~310 linhas** |

---

## Resumo Geral do Plano

### Fases e Estimativas

| Fase | Descrição | Linhas Novas/Modificadas | Componentes Novos |
|------|-----------|-------------------------|-------------------|
| **1** | Design System Upgrade | ~578 | 6 novos |
| **2** | Dashboard Redesign | ~390 | 0 (usa Fase 1) |
| **3** | Events List Redesign | ~240 | 0 (usa Fase 1) |
| **4** | Clients Dashboard | ~260 (com remoção) | 0 (usa Fase 1) |
| **5** | Vendors Redesign | ~355 | 0 (usa Fase 1) |
| **6** | Navigation Polish | ~310 | 3 novos |
| **TOTAL** | | **~2.133 linhas** | **9 componentes novos** |

### Arquivos impactados (resumo)

**Arquivos modificados:**
1. `apps/mobile/src/theme/colors.ts` — Tokens expandidos
2. `apps/mobile/src/components/Screen.tsx` — Header premium
3. `apps/mobile/src/screens/DashboardScreen.tsx` — Dashboard visual
4. `apps/mobile/src/screens/EventsScreen.tsx` — Cards com overlay
5. `apps/mobile/src/screens/ClientsScreen.tsx` — Layout seccionado
6. `apps/mobile/src/screens/VendorsCatalogScreen.tsx` — Cards com imagem
7. `apps/mobile/src/screens/MoreScreen.tsx` — Estilos atualizados
8. `apps/mobile/src/screens/FinanceScreen.tsx` — Estilos atualizados
9. `apps/mobile/app/(app)/(tabs)/_layout.tsx` — Tab bar premium

**Arquivos novos:**
1. `apps/mobile/src/components/ui/GradientCard.tsx`
2. `apps/mobile/src/components/ui/ProgressRing.tsx`
3. `apps/mobile/src/components/ui/StatCardPremium.tsx`
4. `apps/mobile/src/components/ui/Badge.tsx`
5. `apps/mobile/src/components/ui/QuickAction.tsx`
6. `apps/mobile/src/components/ui/SectionHeader.tsx`
7. `apps/mobile/src/components/ui/FloatingActionButton.tsx`
8. `apps/mobile/src/components/ui/ScreenTransition.tsx`
9. `apps/mobile/src/components/ui/SkeletonShimmer.tsx`

### Dependências

**Já instaladas (não precisa adicionar):**
- `expo-linear-gradient` (Expo SDK 54)
- `react-native-svg` (Expo SDK 54)
- `react-native-reanimated` (~4.1.1)
- `@expo/vector-icons` (Ionicons)
- `expo-haptics` (para feedback tátil)

**Nenhuma dependência nova necessária.**

### Ordem de Execução Recomendada

1. **Fase 1** (Design System) — Fundação, sem quebra de funcionalidade
2. **Fase 2** (Dashboard) — Maior impacto visual, tela principal
3. **Fase 6** (Navigation) — Melhora experiência imediatamente
4. **Fase 3** (Events) — Segunda tela mais usada
5. **Fase 5** (Vendors) — Mais rápido de implementar
6. **Fase 4** (Clients) — Mais complexo, pode ser dividido em sub-fases

### Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| `expo-linear-gradient` pode ter performance ruim em listas grandes | Usar apenas em headers e cards estáticos, não em listas scrolláveis |
| ProgressRing com SVG pode ser pesado | Limitar a 3-4 instâncias por tela |
| Reanimated pode conflitar com versão do Expo | Verificar compatibilidade antes de implementar |
| Mudanças no `_layout.tsx` podem quebrar navegação | Testar em todos os dispositivos antes de commitar |
| Fase 4 (Clients) é muito grande | Dividir em 4a (tabs + overview) e 4b (kanban + accordion) |

### Checklist de Validação

- [ ] Todos os textos em português do Brasil com acentuação correta
- [ ] Nenhuma referência a "planejarpro" (usar apenas "painelprime")
- [ ] Cores da paleta consistentes em todos os componentes
- [ ] Gradientes usando `expo-linear-gradient`
- [ ] Animações usando `react-native-reanimated`
- [ ] Ícones usando `@expo/vector-icons` (Ionicons)
- [ ] Fonts: Manrope (corpo) e Playfair Display (títulos premium)
- [ ] Testado em iOS e Android
- [ ] Accessibility: contraste mínimo 4.5:1 em todos os textos
- [ ] Loading states em todas as telas
- [ ] Empty states em todas as listas
- [ ] Pull-to-refresh em todas as telas com dados

---

**Próximo passo:** Aprovar este plano e começar pela Fase 1 (Design System Upgrade).
