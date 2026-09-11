# Portfolio integration design (2026-09-11)

Decision, Roy 2026-09-11: keep the trainer as its own app, reskin it with the royabes.com design
system, serve it at cca.royabes.com, and link it from the portfolio's Demos page and the Projects
Personal card. Rejected: merging the nine routes into the portfolio repo (heavier build and test
suite, and the trainer stops being its own repo), and links-only (the hop between sites feels like
leaving the portfolio).

## Placement

- Domain `cca.royabes.com`. Vercel treats custom domains as public even under its default
  deployment protection, so the domain is also what removes the login wall. GoDaddy holds the DNS:
  one CNAME, host `cca`, value `cname.vercel-dns.com`.
- Demos page on royabes.com: a fifth card in the same shape as the other four, opening the app in
  a new tab. Projects, Personal tab: the existing card, pointed at the subdomain, with the GitHub
  link now that the repo is public.
- Portfolio home: a data-driven "What's new" strip (`data/whats-new.ts`, latest three) between the
  proof strip and Featured Work. The trainer's dashboard carries its own "What's new" panel
  (`lib/whats-new.ts`) so a shared link explains itself.

## Reskin

- Palette: the trainer keeps its semantic token names (`--ink`, `--clay`, `--line`, ...) and
  `globals.css` remaps them to the portfolio's Pulse Cartography values under `html.dark` and
  `html:not(.dark)`, dark by default. Blue is action, green is correct, amber is uncertain. The
  portfolio has no red, so a calibrated coral for wrong answers is the one new color.
- Type: Inter for body, Archivo for headings with the portfolio's tight tracking, JetBrains Mono
  for code, loaded with `next/font/google` in `app/layout.tsx`.
- Theme: the same `ThemeProvider` and Sun / Moon / Monitor toggle as the portfolio, persisted
  under `theme` in localStorage, with an inline script that applies the saved theme before first
  paint.
- Header: sticky 64px bar in the portfolio's nav style. Diamond wordmark "Roy Abes" links back to
  royabes.com, then the app title and section links in the portfolio's active-link style, level
  select and theme toggle on the right. Footer: wordmark, "More demos", source link, and the
  not-affiliated note.
- Primitives: cards, chips, buttons, progress tracks and the score ring take the portfolio's radii,
  borders and hover states. Component code barely changes because it already reads the tokens.

## Verification

Lint, typecheck, the vitest suite (a new test covers the What's new data), the production build,
and screenshots of the dashboard, study, practice, exam and tutor pages in both themes.
