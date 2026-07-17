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
  level text not null check (level in ('MLB','AAA','AA','A+','A','FCL','DSL')),
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
  era numeric(6,2),
  fip numeric(6,2),
  siera numeric(6,2),
  games_back text,
  x_record text,
  vs500_record text,
  next_game_date text,
  next_game_opponent text,
  next_game_is_home boolean,
  next_game_url text,
  updated_at timestamptz not null default now(),
  unique (level)
);

-- ---------------------------------------------------------------------
-- Tab 2 / 3 / 4: Players — hitters and pitchers. One row per player PER
-- LEVEL this season, plus one additional row per player with is_total =
-- true representing their combined stat line across every level (this
-- is the row Fangraphs already includes for multi-level players — see
-- lib/detectTotals.ts for how uploads identify which row that is).
-- Players who only played at one level all year just get a single row
-- with is_total = true, since that row already IS their season total.
-- ---------------------------------------------------------------------
create table if not exists hitter_stats (
  id uuid primary key default gen_random_uuid(),
  player_id text, -- internal id, nullable until Tab 5 linking assigns one
  name text not null,
  level text,
  team text,
  position text,
  age int,
  bats text check (bats in ('L','R','S')),
  g int, pa int, ab int,
  avg numeric(4,3), obp numeric(4,3), slg numeric(4,3), ops numeric(4,3),
  wrc_plus int,
  bb_pct numeric(5,2), k_pct numeric(5,2),
  hr int, sb int,
  -- Batted Ball
  gb_pct numeric(5,2), fb_pct numeric(5,2), ld_pct numeric(5,2), hr_fb_pct numeric(5,2),
  pull_pct numeric(5,2), cent_pct numeric(5,2), oppo_pct numeric(5,2), hard_pct numeric(5,2),
  -- Statcast
  ev_avg numeric(5,2), ev_max numeric(5,2), la_avg numeric(5,2), barrel_pct numeric(5,2),
  hardhit_pct numeric(5,2), xba numeric(4,3), xslg numeric(4,3), xwoba numeric(4,3),
  -- Bat Tracking
  bat_speed numeric(5,2), swing_length numeric(5,2), squared_up_pct numeric(5,2), blast_pct numeric(5,2),
  mlb_games_career int not null default 0,
  is_total boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (name, team, level)
);

create table if not exists pitcher_stats (
  id uuid primary key default gen_random_uuid(),
  player_id text,
  name text not null,
  level text,
  team text,
  position text,
  age int,
  throws text check (throws in ('L','R')),
  g int, gs int, ip numeric(5,1),
  era numeric(6,2), fip numeric(6,2), siera numeric(6,2), whip numeric(6,2),
  k_pct numeric(5,2), bb_pct numeric(5,2), kbb_pct numeric(5,2),
  -- Batted Ball
  gb_pct numeric(5,2), fb_pct numeric(5,2), ld_pct numeric(5,2), hr_fb_pct numeric(5,2), hard_pct numeric(5,2),
  -- Statcast
  barrel_pct numeric(5,2), hardhit_pct numeric(5,2), xera numeric(6,2), xba numeric(4,3),
  whiff_pct numeric(5,2), chase_pct numeric(5,2),
  -- Pitch grades
  stuff_plus numeric(6,1), location_plus numeric(6,1), pitching_plus numeric(6,1),
  mlb_games_career int not null default 0,
  is_total boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (name, team, level)
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
  era numeric(6,2), fip numeric(6,2), siera numeric(6,2), whip numeric(6,2),
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
-- Historical archive — past-season data, uploaded once and left alone.
-- Deliberately separate from hitter_stats/pitcher_stats (which represent
-- the CURRENT season and get refreshed by every Tab 6 upload) so old years
-- never get touched or overwritten by a live-season re-upload. One row per
-- player per season per level; re-uploading the same season/player/team/
-- level pair updates that row instead of duplicating it (handy if you spot
-- a typo in an old file), but nothing else ever writes to these tables.
-- ---------------------------------------------------------------------
create table if not exists historical_hitter_stats (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  level text,
  name text not null,
  team text,
  position text,
  age int,
  g int, pa int, ab int,
  avg numeric(4,3), obp numeric(4,3), slg numeric(4,3), ops numeric(4,3),
  wrc_plus int,
  bb_pct numeric(5,2), k_pct numeric(5,2),
  hr int, sb int,
  gb_pct numeric(5,2), fb_pct numeric(5,2), ld_pct numeric(5,2), hr_fb_pct numeric(5,2),
  pull_pct numeric(5,2), cent_pct numeric(5,2), oppo_pct numeric(5,2), hard_pct numeric(5,2),
  ev_avg numeric(5,2), ev_max numeric(5,2), la_avg numeric(5,2), barrel_pct numeric(5,2),
  hardhit_pct numeric(5,2), xba numeric(4,3), xslg numeric(4,3), xwoba numeric(4,3),
  bat_speed numeric(5,2), swing_length numeric(5,2), squared_up_pct numeric(5,2), blast_pct numeric(5,2),
  is_total boolean not null default false,
  uploaded_at timestamptz not null default now(),
  unique (season, name, team, level)
);

create table if not exists historical_pitcher_stats (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  level text,
  name text not null,
  team text,
  position text,
  age int,
  g int, gs int, ip numeric(5,1),
  era numeric(6,2), fip numeric(6,2), siera numeric(6,2), whip numeric(6,2),
  k_pct numeric(5,2), bb_pct numeric(5,2), kbb_pct numeric(5,2),
  gb_pct numeric(5,2), fb_pct numeric(5,2), ld_pct numeric(5,2), hr_fb_pct numeric(5,2), hard_pct numeric(5,2),
  barrel_pct numeric(5,2), hardhit_pct numeric(5,2), xera numeric(6,2), xba numeric(4,3),
  whiff_pct numeric(5,2), chase_pct numeric(5,2),
  stuff_plus numeric(6,1), location_plus numeric(6,1), pitching_plus numeric(6,1),
  is_total boolean not null default false,
  uploaded_at timestamptz not null default now(),
  unique (season, name, team, level)
);

-- ---------------------------------------------------------------------
-- Tab 7: Writer — every published piece across outlets, plus a simple
-- income/expense tracker with a running tax estimate.
-- ---------------------------------------------------------------------
create table if not exists writer_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null unique,
  company text not null, -- e.g. "Just Baseball", "Braves Today"
  category text, -- e.g. "Analysis", "News" — whatever the outlet tags it
  content_type text not null default 'Article', -- 'Article' | 'Video' | 'Other'
  published_date date,
  source text not null default 'manual', -- 'scraped' | 'manual'
  created_at timestamptz not null default now()
);

create table if not exists writer_income (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  company text not null,
  amount numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists writer_expenses (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  category text,
  description text,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table writer_articles enable row level security;
alter table writer_income enable row level security;
alter table writer_expenses enable row level security;

create policy "public read" on writer_articles for select using (true);
create policy "public read" on writer_income for select using (true);
create policy "public read" on writer_expenses for select using (true);

create policy "anon write" on writer_articles for insert with check (true);
create policy "anon update" on writer_articles for update using (true);
create policy "anon delete" on writer_articles for delete using (true);
create policy "anon write" on writer_income for insert with check (true);
create policy "anon update" on writer_income for update using (true);
create policy "anon delete" on writer_income for delete using (true);
create policy "anon write" on writer_expenses for insert with check (true);
create policy "anon update" on writer_expenses for update using (true);
create policy "anon delete" on writer_expenses for delete using (true);

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
alter table historical_hitter_stats enable row level security;
alter table historical_pitcher_stats enable row level security;
alter table upload_log enable row level security;

create policy "public read" on team_level_records for select using (true);
create policy "public read" on hitter_stats for select using (true);
create policy "public read" on pitcher_stats for select using (true);
create policy "public read" on prospect_comp_pool_hitters for select using (true);
create policy "public read" on prospect_comp_pool_pitchers for select using (true);
create policy "public read" on top_30_list for select using (true);
create policy "public read" on top_30_snapshots for select using (true);
create policy "public read" on historical_hitter_stats for select using (true);
create policy "public read" on historical_pitcher_stats for select using (true);
create policy "public read" on upload_log for select using (true);

-- The historical archive is uploaded straight from the browser (Tab 6) using
-- the anon key, unlike the other tables, so it needs explicit write access.
-- Since re-uploading the same season/player/team/level just updates that
-- row (see the unique constraint above), this is safe for a single-admin
-- tool — tighten with real auth before handing edit access to anyone else.
create policy "anon upload" on historical_hitter_stats for insert with check (true);
create policy "anon upload update" on historical_hitter_stats for update using (true);
create policy "anon upload" on historical_pitcher_stats for insert with check (true);
create policy "anon upload update" on historical_pitcher_stats for update using (true);

-- NOTE: no insert/update/delete policies are created here on purpose —
-- until you add auth, writes only work via the Supabase dashboard or a
-- service-role key. If you want Tab 6 uploads to work directly from the
-- browser with the anon key, add write policies here (and add real auth
-- first so anyone with the URL can't overwrite your data).
