# crm-1 — owner CRM, avisos, fuentes, Cloudflare email (2026-10-03)

Branch `claude/dazzling-bohr-97sjny`. Manager: Claude Code (Opus); parts built by
Sonnet sub-agents in separate worktrees and merged by the manager.

## Shipped
- **Migration 0005** (`drizzle/0005_crm.sql`, Hostinger: `docs/deploy/hostinger-import-0005.sql`):
  pipeline columns on `site_leads`, `push_subscriptions`, `analytics_events.ref_code`,
  `businesses.notify_email`.
- **/mi-sitio/clientes**: pipeline (Nuevas / En curso / Clientes / Perdidas), "Para hoy"
  follow-ups, notes, value in Gs, "Responder por WhatsApp" (marks Respondida), add customer,
  register a WhatsApp chat by ref code, repeat-customer badge, CSV export, month numbers.
- **Avisos** card on /mi-sitio: Web Push per phone + notify email.
- **Fuentes** card: visits, WhatsApp clicks and consultas per source (Google, Instagram…).
- **Ref codes**: site WhatsApp buttons append "(ref K7Q2)" to the first message.
- **Lead source** stored on every consulta (referrer / utm_source / page).
- **Email**: Resend replaced by Cloudflare Email Sending.
- **Bug fixes** from a whole-app review: see commits 13fc9e0 and 89cc2ae.

## Deploy (Anton)
1. Import `docs/deploy/hostinger-import-0005.sql` in phpMyAdmin (change the `USE` line).
2. hPanel env: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_TOKEN`, `EMAIL_FROM`,
   optional `EMAIL_FROM_NAME`; `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   (`npx web-push generate-vapid-keys`). Remove `RESEND_*`.
3. sitio.com.py on Cloudflare DNS, onboarded for Email Sending; one test send.
4. Superadmin will be logged out once (sessions now carry a password version).

## Not verified here
No database in the build session: CRM queries, push to a real phone and a real
Cloudflare send are untested until deploy.
