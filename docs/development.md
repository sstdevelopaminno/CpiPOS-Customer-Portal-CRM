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

## POS menu parity source

The Customer Portal **เพิ่มเติม** and **ตั้งค่า** catalogs mirror `sstdevelopaminno/CpIPOS` branch `main` at commit `37aeb6dbb7f20486c073d782f6d5fb2f437a86e0`. The parity contract is centralized in `src/config/pos-menu-catalog.ts` and protected by `tests/pos-menu-parity.test.ts`. Customer Portal uses the same CpiPOS-001 data and package/IT feature policy as POS. Writable POS administration is exposed only through dedicated server-side RPC control-plane functions.

Writable parity is enabled for tables/zones, members, kitchen zones/KDS/routing, buffet pricing, and cashier devices. Printer physical discovery/connections, Customer Display secret pairing, and device-local language/menu placement remain linked/read-only until their safe control-plane actions are implemented.

## POS administration control-plane

Migration `customer_portal_pos_admin_crud_parity` adds authenticated Owner/Manager RPCs for shared POS back-office data. Every mutation is tenant/branch scoped, package-feature gated, IT menu-policy gated, and audit logged. Cashier-device provisioning also honors contract quota and revokes active POS sessions when device identity changes or a device is removed.

## POS administration phase 2

Customer Portal now manages the shared table floor plan, floor objects, product-level kitchen routing, printer profiles/registry assignments, and Customer Display pairing lifecycle. Customer Display device limits and inactivity policy remain IT-owned. USB/Bluetooth physical discovery remains a local POS/Print Agent responsibility; the portal manages the shared configuration after registration.
