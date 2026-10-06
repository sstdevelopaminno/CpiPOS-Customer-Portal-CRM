# CpiPOS Customer Portal CRM

Customer-facing owner/manager portal for CpiPOS.

## Architecture

- Static SPA on Vercel (Vite + React)
- CpiPOS-001 is the single source of truth
- Browser reads authorized data directly from Supabase using Auth + RLS
- Store-code + employee-code login is handled by a Supabase Edge Function, not a Vercel Function
- Only `owner` and `manager` branch roles may enter the portal
- Never expose `service_role` or privileged credential data to the browser

The design intentionally minimizes Vercel Fluid Active CPU usage.

## Phase 1 status

Foundation implementation is tracked in PR #1.

## Progressive Web App

- Installable on supported desktop/mobile browsers
- Standalone app mode with CpiPOS branding
- Service worker caches only same-origin static app-shell assets
- Supabase/Auth/business-data requests are intentionally never intercepted or cached
- The portal remains a static Vite deployment and does not add Vercel Functions
