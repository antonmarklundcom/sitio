# Teman v2 "Placa" (#50, 2026-09-22)

Skriven i efterhand av batch 3-auditen (`docs/log/R3-3.md`): PR #50 mergades
utan logg, plan-rad eller KNOWN-ISSUES-rad. Källan är de tre commit-meddelandena
(b173203, c4fe225, 2687db4) och koden på `main`.

## Built
- Alla fyra kundteman omdesignade som en produktlinje: samma sektionsvokabulär,
  skillnad i färg, radie, textur, fotobehandling och blockordning.
- Delade komponenter `src/components/site/hero.tsx` ("la placa" + monogram när
  foto saknas + "abierto ahora") och `src/components/site/blocks.tsx`
  (tjänster, foton, var/när, avslut+footer, fast CTA). Temafilerna äger bara
  ordning och text.
- `palettes.ts`: alla teman ljusdominanta (servicios var mörkt), accent i tre
  tokens (`accent`, `accentInk`, `accentLight`) plus `deep`.
- `theme.css`: hela delade layouten; `.t-light` borttagen.
- Typsnitt Archivo + Instrument Sans (ersätter Bricolage Grotesque / Inter Tight).
- `theme-preview.tsx`: ett tomt läge per tema (`-v1-vacio`).
- Landningens telefonmock följer det nya temat.
- Fallbacks för `svh`, `env()` och `color-mix` (äldre Android-browsers).

## Decisions
- Tabellen bransch → tema/variant i `presentation.ts` är oförändrad; bara
  accent-etiketterna bytte namn. plan.md §1.11:s "Accent"-kolumn och §1.12:s
  "servicios (dark)" beskriver v1 — noterat i §1.12, inte omskrivet.

## Known issues
- Inga nya utöver `KNOWN-ISSUES.md`. `DEMO_MENU`-fixturen (S2) följde med
  oförändrad in i v2.

Verification: typecheck, lint, 298 tester och build gröna på fc9e032 (omkört av
auditen 2026-09-22); QA-gaten 12 sidor × 3 bredder enligt #50.
