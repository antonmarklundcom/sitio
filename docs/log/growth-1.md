# Growth 1 — tillväxtpaketet

Runner: a Claude Code cloud session (2026-09-24), branch
`claude/awesome-faraday-0ywirq`, on Anton's request after the "top 20 ideas"
review: ideas 4 (monthly stats), 5 (renewal reminders), 6 (referrals),
7 (resellers), 11 (booking, lite), 15 (faster publishing), 16 (review
button, owner toggle), a lead form with an owner inbox, and room for Anton's
own services in the owner panel. Everything works **before** Meta
verification: messages go out by hand via wa.me from a queue that remembers
what was sent. No subagents, no Fable.

Migration **0004_growth** (5 tables, 7 columns on `businesses`). Hostinger:
import `docs/deploy/hostinger-import-0004.sql` after 0001–0003 (guarded,
tested twice on MariaDB 10.11 + `db:migrate` afterwards found nothing to do).

## What was built

| Area | Where | What |
|---|---|---|
| Lead form ("Dejanos tu número") | `src/components/site/lead-form.tsx`, `SiteClosing` in `blocks.tsx`, `src/app/api/consulta/route.ts` | Collapsed under the WhatsApp button in every theme's closing plate (WhatsApp stays primary). POST JSON to `/api/consulta`: honeypot, 5/10 min per IP, 60/day per site, only published sites with the form on. Saves to `site_leads`; the visitor gets a "write now on WhatsApp" link after. |
| Booking (turnos) | same form, `booking` module | With `booking` on, the form is a turno request: service (from the site's services), day (today…+90), time. Module is now marked built (`src/lib/modules.ts`); meant for Pro. |
| Owner inbox | `OwnerInbox` in `src/components/mi-sitio/owner-growth.tsx` | Top of `/mi-sitio`: every consulta/turno with a "Responder por WhatsApp" wa.me link to the visitor (prefilled), status nueva → respondida → cerrada. |
| Owner toggles (idea 16) | `OwnerSiteOptions`, `saveSiteOptionsAction` | Lead form on/off, review button on/off + Google review link (https Google hosts only), "Hecho con sitio.com.py" footer credit on/off (D4: off by default). Saves revalidate the ISR page. |
| Referrals (idea 6) | `OwnerReferral`, `/registro?ref=<code>`, `applyGrowthOnPaymentConfirmed` | Each business gets a 6-char code (lazily). Signup via `?ref=` stores `referred_by_business_id`. First confirmed payment of the referred business ⇒ both get extra days (30/30 default, `/admin/crecimiento`), once (`referral_rewarded_at` is claimed with a conditional UPDATE). The footer credit links with the owner's code. |
| Resellers (idea 7) | `/admin/socios`, `/socio/<token>` | Partners with code, commission % (default 30), WhatsApp welcome link, token report page (noindex). Signup via partner code ⇒ `partner_id`. Every confirmed payment within a year of the first commission ⇒ `partner_commissions` row (unique per payment). Mark paid/void. Existing sites can be assigned to a partner. |
| Services / upsells | `OwnerServices`, `/admin/crecimiento` catalog, `/admin/leads` | "Hacé crecer tu negocio" in `/mi-sitio`: editable catalog (Google Maps, ads, full website, CRM, WhatsApp bot, content — prices blank until Anton fills them), a "Pasate a Plus" card on Básico, and one card marked "Recomendado para vos" from the 30-day numbers. "Me interesa" ⇒ `service_requests` row (deduped while open), VenderCRM push when configured, then straight into WhatsApp with Anton's sales number. The queue is on `/admin/leads`. |
| Message queue (ideas 4 + 5) | `/admin/mensajes`, `outbound_messages`, `src/lib/message-queue.ts` | Renewal reminders at 30/15/7 days and overdue (≤30 days), with year stats + "tu año en cifras" link, each stage once per period; last month's numbers to every published site with traffic. "Enviar por WhatsApp" opens wa.me and records it; "Omitir" records without sending. When Cloud API exists (PR-17) the same rows get `channel = 'api'`. |
| Auto-publish (idea 15) | `src/lib/auto-publish.ts`, `after()` in `submitIntakeAction`, `/admin/crecimiento` | Off by default. On: after the intake is submitted, AI polish runs (or the raw text becomes the description when there is no key), the normal publish blockers apply, and the site goes live with `needs_review` — listed under "Para revisar" in `/admin/crecimiento`. |
| Trial from publication | `startTrialAtPublish` | Answers the 2026-09-23 question with (a): the trial window moves to the day of first publication (same length), for manual and automatic publishing. |

## Not built

- **Idea 14 (import from Instagram).** Instagram blocks scraping, and the
  official API needs the business to log in through a Meta app that has passed
  app review, which is the same Meta process as PR-17. Revisit after Meta verification.
- **Owner notification of a new consulta.** Without Cloud API the owner only
  sees it in `/mi-sitio`. The form's thank-you gives the visitor a WhatsApp link, so
  an urgent customer can still write directly. KNOWN-ISSUES.

## Gate

typecheck, lint, 418 unit tests (`tests/unit/growth.test.ts` new, 24 tests;
`modules.test.ts`: booking is built), `next build`; fresh MariaDB 10.11 +
built server: `npm run smoke` **9/9 green, 298 ✓** — new
`tests/smoke/growth.mjs` (57 checks) covers every row above end to end
(public form, API limits and honeypot, inbox and reply link, toggles on the
live page, turno, "Me interesa" → wa.me, referral bonus once, partner
commission 30 % and report page, queue skip, auto-publish with trial shift).
One e2e check was updated: "obyggda moduler flaggas" → all modules built.
Phone-width screenshots (390 px): closing plate with the open form and the
owner cards, no horizontal scroll.

## Live steps for Anton

1. Import `docs/deploy/hostinger-import-0004.sql` (after 0001–0003) and redeploy.
2. `/admin/crecimiento`: put prices on the services you want to sell, hide
   the ones you don't, and decide on auto-publish.
3. `/admin/socios`: create your first reseller, send them their links.
4. Check `NEXT_PUBLIC_SALES_WHATSAPP` is set. Without it, "Me interesa"
   only records the request and doesn't open WhatsApp.
5. Once a day: `/admin/mensajes`.
