# Braves Org Dashboard

A mobile-first organizational dashboard for the Atlanta Braves system —
record/splits from MLB down to DSL, a full sortable player database, an
All-Organization Team generator, prospect similarity comps, a drag-and-drop
Top 30 list, and a CSV upload center that pushes Fangraphs exports into
Supabase.

This is the **shell**: every tab is wired up with real layout, sorting,
filtering, drag-and-drop, charts, and image export, running on placeholder
data. Swap the placeholder data for live Supabase tables (schema included)
whenever you're ready — the components don't need to change, just the data
source.

## Stack

- **React + TypeScript + Vite** — fast build, easy to deploy as static files
- **Tailwind CSS** — mobile-first styling, Braves navy/red/cream tokens in `tailwind.config.js`
- **Supabase** — Postgres database + client library (`src/lib/supabaseClient.ts`)
- **recharts** — radar charts for prospect comps
- **@dnd-kit** — drag and drop for the Top 30 list
- **html-to-image** — the "download as image" button on every card
- **papaparse** — CSV parsing for the upload center

## Tabs

1. **Org Overview** — record, home/away splits, L5/L10/L15, streak, runs
   scored/allowed/differential, and team AVG/OBP/SLG/OPS/ERA/FIP/SIERA for
   every affiliate.
2. **Players** — full org player table, sortable columns, multi-select
   filters (level, team), Hitter/Pitcher toggle, Min PA / Min IP.
3. **All-Organization Team** — three teams (best/next-best/next-best) built
   from a composite score. See `src/lib/scoring.ts` for the exact formula
   and the reasoning behind each weight.
4. **Prospect Comps** — any org player under 162 career MLB games, matched
   to a comp pool by a weighted Similarity Score, with a radar chart and a
   blurb per comp. See `src/lib/prospectComps.ts`.
5. **My Top 30 List** — add players by searching the existing database, or
   add a player manually if they're not in there yet (a new signee, for
   example). Manual entries get a "Not in DB" badge; the moment a matching
   name shows up in the database, a "link now" prompt appears to attach the
   entry to that real player record. Drag-and-drop ranking with an
   always-visible "off the list" bucket. Edit freely day to day — nothing
   is saved until you hit **Submit**, which stores a dated, immutable
   snapshot you can browse (and delete) in the History panel. Every player
   shows a **Prev** rank pulled from your last submission ("NR" if they
   weren't ranked last time), colored green/red for moves up/down.
6. **Upload** — one card per Fangraphs export (links to fill in later) with
   a CSV drop zone that upserts straight into Supabase.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev
```

The app runs fine with **no Supabase connection** — it falls back to the
mock data in `src/data/mockData.ts` and shows a "Mock data mode" badge in
the header so you always know which data you're looking at.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` — it creates every table
   the app expects (`team_level_records`, `hitter_stats`, `pitcher_stats`,
   `prospect_comp_pool_hitters/pitchers`, `top_30_list`, `upload_log`) with
   public-read row level security policies.
3. Copy your project URL and anon key (Project Settings → API) into
   `.env.local`.
4. Restart `npm run dev` — the "Mock data mode" badge disappears once the
   client can reach Supabase. (Pages haven't been switched over to read
   from Supabase yet in this shell — each page has a `// TODO(supabase)`
   comment marking exactly where to swap the mock array for a real query.)

## Deploying via GitHub

This repo ships with `.github/workflows/deploy.yml`, which builds the app
and deploys it to **GitHub Pages** on every push to `main`.

1. Push this repo to GitHub.
2. In **Settings → Pages**, set the source to "GitHub Actions".
3. In **Settings → Secrets and variables → Actions**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets.
4. Push to `main` — the Action builds and deploys automatically.

Prefer Vercel or Netlify instead? Both work with zero config — just import
the repo and set the same two environment variables in their dashboard;
you can delete `.github/workflows/deploy.yml` if you go that route.

## Project structure

```
src/
  App.tsx                 # tab navigation (mobile bottom bar / desktop top bar)
  index.css                # Tailwind + shared table/card/pill styles
  components/shared/
    DownloadableCard.tsx    # wraps any table/chart with a "download as image" button
  data/mockData.ts          # placeholder data — same shape as the Supabase tables
  lib/
    supabaseClient.ts       # Supabase client (falls back gracefully if unset)
    cache.ts                # localStorage cache so data "doesn't change" across a session
    downloadImage.ts         # html-to-image export helper
    scoring.ts               # All-Org Team composite scoring formulas
    allOrgTeam.ts             # All-Org Team selection algorithm
    prospectComps.ts          # Similarity score + comp pool for Tab 4
  pages/
    OrgOverview.tsx, Players.tsx, AllOrgTeam.tsx,
    ProspectComps.tsx, Top30.tsx, Upload.tsx
  types/index.ts             # shared domain types (mirrors supabase/schema.sql)
supabase/schema.sql          # full DB schema, run this first
.github/workflows/deploy.yml # GitHub Pages CI/CD
```

## What's a placeholder vs. what's real

- **Real / functional now:** navigation, table sorting & filtering,
  hitter/pitcher toggle, Min PA/IP, All-Org Team scoring + selection logic,
  similarity scoring + radar charts, drag-and-drop Top 30 with bucket, CSV
  parsing, download-as-image on every table/card/chart, responsive
  mobile/desktop layout.
- **Placeholder, ready to swap in:** all data (`src/data/mockData.ts`),
  the 6-player prospect comp pool (needs to grow to the full 500/500 —
  `src/lib/prospectComps.ts`), the AI-generated blurb (currently a
  templated string — wire a Supabase Edge Function that calls the Claude
  API for real generated text), the Fangraphs URLs in Tab 6
  (`src/pages/Upload.tsx`), and Supabase row-level-security write policies
  (currently read-only from the browser; writes need a service role key or
  auth).

## Next steps (in the order I'd tackle them)

1. Fill in the Fangraphs URLs in `src/pages/Upload.tsx`.
2. Run `supabase/schema.sql`, connect real credentials.
3. Do one real upload per level and confirm the column-mapping in
   `handleFile()` in `Upload.tsx` matches Fangraphs' export headers exactly
   (they rarely match your column names 1:1 — you'll need a small mapping
   object).
4. Swap each page's mock-data import for a Supabase query (each has a
   `// TODO(supabase)` marker).
5. Build out the real 1000-player prospect comp pool as a one-time SQL
   import into `prospect_comp_pool_hitters` / `_pitchers`.
6. Wire a Supabase Edge Function calling the Claude API for the Tab 4
   blurb generation.
