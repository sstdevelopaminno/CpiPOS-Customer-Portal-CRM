# CpiPOS Customer Portal CRM

Customer-facing Owner/Manager portal for CpiPOS.

## Architecture

- Static SPA on Vercel (Vite + React + TypeScript)
- CpiPOS-001 / Supabase is the single source of truth
- Browser uses Supabase Auth + RLS with a publishable key only
- Privileged login, staff administration and billing evidence flows run in Supabase Edge Functions
- Only Owner/Manager branch roles may enter the portal
- No Vercel API routes, SSR or server functions are required

## Front-end structure

- `src/App.tsx`: app shell/navigation/session/global filters
- `src/views/*`: feature screens
- `src/components/*`: shared UI primitives
- `src/lib/api/*`: feature-scoped Supabase data access
- `src/types/portal.ts`: shared contracts
- `src/styles/*`: design tokens and layered styles

`src/lib/portal.ts` is now a small compatibility barrel so feature code can migrate incrementally without changing behavior.

## Quality gates

Run `npm run check` for TypeScript, automated tests and production build. CI uses committed `package-lock.json` with `npm ci`.

## Progressive Web App

The app remains installable. The service worker caches only same-origin static app-shell assets and never caches Supabase/Auth/business-data requests.
