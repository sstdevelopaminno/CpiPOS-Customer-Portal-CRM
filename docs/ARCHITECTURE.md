# Customer Portal architecture

## Goal
Keep Vercel Fluid Active CPU close to zero during normal customer usage.

## Request path
1. Vercel serves this Vite SPA as static files/CDN.
2. Login calls Supabase Edge Function `customer-portal-login`.
3. The function validates store code + owner/manager employee code via a service-role-only RPC.
4. A one-time Supabase Auth token is exchanged directly with Supabase Auth.
5. Browser queries CpiPOS-001 directly; existing RLS limits tenant/branch access.

There are no Vercel API Routes, Server Actions, SSR pages, middleware, cron jobs, or polling loops.

## Security
- Browser never receives `service_role`.
- Browser never receives privileged credential data.
- Only `owner` and `manager` can bootstrap a Portal session.
- Employee-code login failures are rate-limited by store + hashed client fingerprint.
- Existing CpiPOS RLS remains authoritative.

## Phase 1
- Owner/Manager login
- Today dashboard
- Recent sales and sales list
- Products
- Ingredient inventory / reorder warning
- Subscription status and Owner billing cycles

## PWA

The production portal is installable as a Progressive Web App. The service worker is deliberately limited to the same-origin static shell. Cross-origin Supabase/Auth/API requests are never intercepted, so business data is not persisted in the PWA cache.
