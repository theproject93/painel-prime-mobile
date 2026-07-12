# Google AI Studio — Painel Prime Mobile

Este repositório é o aplicativo Android oficial em Expo/React Native.

## Entrada do preview

O Google AI Studio só executa preview web. Por isso `apps/web` contém um **companion preview** Vite, iniciado pelo script raiz `dev`. Ele existe para permitir visualização e inspeção dentro do AI Studio.

## Fonte de verdade

- Código de produção: `apps/mobile/app` e `apps/mobile/src`.
- Preview do AI Studio: `apps/web`.
- Componentes compartilhados: `packages/app` e `packages/ui`.

Uma alteração solicitada para o aplicativo Android deve ser implementada primeiro em `apps/mobile`. O companion preview só deve ser atualizado quando a mudança visual também precisar aparecer no navegador.

## Regras obrigatórias

1. Leia `AI_RULES.md` antes de editar.
2. Não crie `mockData.ts` nem simule respostas Supabase para contornar erro de build.
3. Não copie a aplicação WEB do repositório `painel-prime` para cá.
4. Não coloque secrets, tokens ou credenciais no preview Vite.
5. Não substitua componentes Expo/React Native por componentes HTML dentro de `apps/mobile`.
6. O APK continua sendo construído exclusivamente pelo workflow de tag Android.

## Comandos

```bash
pnpm dev
pnpm --filter @painel-prime/web build
pnpm --filter @painel-prime/mobile run validate
```

O script raiz também é compatível com o executor npm do AI Studio: `npm run dev`.
