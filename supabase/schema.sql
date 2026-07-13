-- =====================================================================
-- Braves Org Dashboard — Supabase schema (shell)
-- Run this in the Supabase SQL editor (or via `supabase db push`) to
-- create every table the app expects. Row Level Security is enabled with
-- permissive read policies + service-role-only writes as a sane default
-- for a single-admin internal tool; tighten as needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tab 1: Org Overview — one row per affiliate per data pull
-- ---------------------------------------------------------------------
create table if not exists team_level_records (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('MLB','AAA','AA','High-A','A','FCL','DSL')),
  team_name text not null,
  wins int not null default 0,
  losses int not null default 0,
  home_wins int not null default 0,
  home_losses int not null default 0,
  away_wins int not null default 0,
  away_losses int not null default 0,
  last_5 text,
  last_10 text,
  last_15 text,
  streak text,
  runs_scored int not null default 0,
  runs_allowed int not null default 0,
  avg numeric(4,3),
  obp numeric(4,3),
  slg numeric(4,3),
  ops numeric(4,3),
  era numeric(4,2),
  fip numeric(4,2),
  siera numeric(4,2),
  updated_at timestamptz not null default now(),
  unique (level)
);

-- ---------------------------------------------------------------------
-- Tab 2 / 3 / 4: Players — hitters and pitchers, one row per player per
-- level per season snapshot (re-uploading a level via Tab 6 upserts here)
-- ---------------------------------------------------------------------
create table if not exists hitter_stats (
  player_id text primary key,
  name text not null,
  level text not null check (level in ('MLB','AAA','AA','High-A','A','FCL','DSL')),
  team text not null,
  position text not null,
  age int,
  bats text check (bats in ('L','R','S')),
  g int, pa int, ab int,
  avg numeric(4,3), obp numeric(4,3), slg numeric(4,3), ops numeric(4,3),
  wrc_plus int,
  bb_pct numeric(5,2), k_pct numeric(5,2),
  hr int, sb int,
  mlb_games_career int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists pitcher_stats (
  player_id text primary key,
  name text not null,
  level text not null check (level in ('MLB','AAA','AA','High-A','A','FCL','DSL')),
  team text not null,
  position text not null check (position in ('SP','RP')),
  age int,
  throws text check (throws in ('L','R')),
  g int, gs int, ip numeric(5,1),
  era numeric(4,2), fip numeric(4,2), siera numeric(4,2), whip numeric(4,2),
  k_pct numeric(5,2), bb_pct numeric(5,2), kbb_pct numeric(5,2),
  mlb_games_career int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tab 4: Prospect comp pool — the ~1000 historical MiLB players
-- (500 hitters / 500 pitchers) used as the similarity-score comparison set
-- ---------------------------------------------------------------------
create table if not exists prospect_comp_pool_hitters (
  player_id text primary key,
  name text not null,
  years text, -- e.g. "2016-2019"
  level text not null,
  age int,
  avg numeric(4,3), obp numeric(4,3), slg numeric(4,3), ops numeric(4,3),
  wrc_plus int, bb_pct numeric(5,2), k_pct numeric(5,2),
  outcome text -- one-line career outcome, feeds the AI blurb
);

create table if not exists prospect_comp_pool_pitchers (
  player_id text primary key,
  name text not null,
  years text,
  level text not null,
  age int,
  era numeric(4,2), fip numeric(4,2), siera numeric(4,2), whip numeric(4,2),
  k_pct numeric(5,2), bb_pct numeric(5,2), kbb_pct numeric(5,2),
  outcome text
);

-- ---------------------------------------------------------------------
-- Tab 5: My Top 30 List — drag/drop ordered list + "off the list" bucket
-- rank = null means the player is in the bucket, not the top 30
-- ---------------------------------------------------------------------
create table if not exists top_30_list (
  id uuid primary key default gen_random_uuid(),
  rank int, -- null = in the bucket
  name text not null,
  position text not null,
  age int,
  notes text,
  sort_order int not null default 0,
  -- Links to hitter_stats/pitcher_stats.player_id once the player has
  -- recorded stats. Null for hand-added players (e.g. a fresh draft pick
  -- or international signee) who aren't in the stats tables yet.
  player_id text,
  source text not null default 'manual' check (source in ('database','manual')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tab 5: Top 30 submit history — one row per "Submit", an immutable dated
-- copy of the list + bucket at that moment. Powers "previous rank" lookups
-- and the historical view (with delete).
-- ---------------------------------------------------------------------
create table if not exists top_30_snapshots (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  list jsonb not null,   -- array of Top30Entry (ranked 1-30)
  bucket jsonb not null  -- array of Top30Entry (off the list at submit time)
);

-- ---------------------------------------------------------------------
-- Tab 6: Upload audit log — every CSV pushed through the upload center
-- ---------------------------------------------------------------------
create table if not exists upload_log (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  target_table text not null,
  row_count int not null,
  uploaded_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security — public read, service-role write.
-- The dashboard's anon key can read everything; writes (from Tab 6's
-- upload flow or any admin script) should go through the service role
-- key on a server / edge function, not the browser anon key, once this
-- moves past local/shell use.
-- =====================================================================
alter table team_level_records enable row level security;
alter table hitter_stats enable row level security;
alter table pitcher_stats enable row level security;
alter table prospect_comp_pool_hitters enable row level security;
alter table prospect_comp_pool_pitchers enable row level security;
alter table top_30_list enable row level security;
alter table top_30_snapshots enable row level security;
alter table upload_log enable row level security;

create policy "public read" on team_level_records for select using (true);
create policy "public read" on hitter_stats for select using (true);
create policy "public read" on pitcher_stats for select using (true);
create policy "public read" on prospect_comp_pool_hitters for select using (true);
create policy "public read" on prospect_comp_pool_pitchers for select using (true);
create policy "public read" on top_30_list for select using (true);
create policy "public read" on top_30_snapshots for select using (true);
create policy "public read" on upload_log for select using (true);

-- NOTE: no insert/update/delete policies are created here on purpose —
-- until you add auth, writes only work via the Supabase dashboard or a
-- service-role key. If you want Tab 6 uploads to work directly from the
-- browser with the anon key, add write policies here (and add real auth
-- first so anyone with the URL can't overwrite your data).
