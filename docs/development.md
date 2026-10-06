# Customer Portal development workflow

1. Branch from current `main`.
2. Keep screen UI in `src/views`, shared controls in `src/components`, and data access in `src/lib/api`.
3. Reuse `src/styles/tokens.css`; do not append another global override section to the stylesheet.
4. Keep POS/IT repositories read-only unless coordinated changes are explicitly required.
5. Run `npm run check` before merge.

## Merge gate

Required CI check: **CI Customer Portal / validate**. Repository administration should require this check and block direct pushes to `main`.

## Security boundaries

Never expose service-role/admin credentials under `src/`. Tenant/branch authorization stays server-side. Financial sale creation remains a POS responsibility. Device-local hardware settings remain read-only from CRM unless a safe control-plane API exists.

## Next UI phase

After this foundation is merged, the next UI iteration can map the POS main/submenu catalog into Customer Portal, especially the **เพิ่มเติม** and **ตั้งค่า** sections, without growing App.tsx or coupling menu UI to data-access code.
