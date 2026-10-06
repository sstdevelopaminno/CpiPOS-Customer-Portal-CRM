# CpiPOS Customer Portal CRM

Customer-facing owner/manager portal for CpiPOS.

## Architecture

- Static SPA on Vercel (Vite + React)
- CpiPOS-001 is the single source of truth
- Browser reads authorized data directly from Supabase using Auth + RLS
- Store-code + PIN login is handled by a Supabase Edge Function, not a Vercel Function
- Only `owner` and `manager` branch roles may enter the portal
- Never expose `service_role` or `users_profiles.pin_hash` to the browser

The design intentionally minimizes Vercel Fluid Active CPU usage.
