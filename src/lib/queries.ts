import { supabase, supabaseConfigured } from '@/lib/supabaseClient'
import { cachedFetch } from '@/lib/cache'
import { CURRENT_SEASON } from '@/lib/constants'
import type { HitterSeasonStats, PitcherSeasonStats, TeamLevelRecord, OrgLevel } from '@/types'
import { ORG_LEVELS } from '@/types'

// =====================================================================
// This is the real data layer — every read in the app should go through
// one of these functions, not a hardcoded array. Each one:
//   1. Returns [] immediately if Supabase isn't connected (no fake
//      fallback data — an empty state is more honest than mock rows).
//   2. Maps Supabase's snake_case columns to the app's camelCase types.
//   3. Caches results in localStorage (via lib/cache.ts) so switching
//      tabs doesn't re-fetch — cache only clears when Tab 6 uploads new
//      data (see cacheClear() calls in Upload.tsx).
// =====================================================================

function mapHitterRow(row: Record<string, any>): HitterSeasonStats {
  return {
    dbId: row.id,
    playerId: row.player_id ?? row.id,
    name: row.name,
    season: row.season ?? CURRENT_SEASON,
    level: row.level as OrgLevel,
    team: row.team,
    position: row.position,
    age: row.age,
    bats: row.bats ?? 'R', // historical_hitter_stats doesn't capture bats
    g: row.g,
    pa: row.pa,
    ab: row.ab,
    avg: row.avg,
    obp: row.obp,
    slg: row.slg,
    ops: row.ops,
    wrcPlus: row.wrc_plus,
    bbPct: row.bb_pct,
    kPct: row.k_pct,
    hr: row.hr,
    sb: row.sb,
    mlbGamesCareer: row.mlb_games_career ?? 0, // not tracked in historical_hitter_stats
    isTotal: row.is_total ?? true,
    gbPct: row.gb_pct,
    fbPct: row.fb_pct,
    ldPct: row.ld_pct,
    hrFbPct: row.hr_fb_pct,
    pullPct: row.pull_pct,
    centPct: row.cent_pct,
    oppoPct: row.oppo_pct,
    hardPct: row.hard_pct,
    evAvg: row.ev_avg,
    evMax: row.ev_max,
    laAvg: row.la_avg,
    barrelPct: row.barrel_pct,
    hardHitPct: row.hardhit_pct,
    xba: row.xba,
    xslg: row.xslg,
    xwoba: row.xwoba,
    batSpeed: row.bat_speed,
    swingLength: row.swing_length,
    squaredUpPct: row.squared_up_pct,
    blastPct: row.blast_pct,
  }
}

function mapPitcherRow(row: Record<string, any>): PitcherSeasonStats {
  return {
    dbId: row.id,
    playerId: row.player_id ?? row.id,
    name: row.name,
    season: row.season ?? CURRENT_SEASON,
    level: row.level as OrgLevel,
    team: row.team,
    position: row.position,
    age: row.age,
    throws: row.throws ?? 'R', // historical_pitcher_stats doesn't capture throws
    g: row.g,
    gs: row.gs,
    ip: row.ip,
    era: row.era,
    fip: row.fip,
    siera: row.siera,
    whip: row.whip,
    kPct: row.k_pct,
    bbPct: row.bb_pct,
    kbbPct: row.kbb_pct,
    mlbGamesCareer: row.mlb_games_career ?? 0,
    isTotal: row.is_total ?? true,
    gbPct: row.gb_pct,
    fbPct: row.fb_pct,
    ldPct: row.ld_pct,
    hrFbPct: row.hr_fb_pct,
    hardPct: row.hard_pct,
    barrelPct: row.barrel_pct,
    hardHitPct: row.hardhit_pct,
    xera: row.xera,
    xba: row.xba,
    whiffPct: row.whiff_pct,
    chasePct: row.chase_pct,
    stuffPlus: row.stuff_plus,
    locationPlus: row.location_plus,
    pitchingPlus: row.pitching_plus,
  }
}

function mapTeamRecordRow(row: Record<string, any>): TeamLevelRecord {
  return {
    level: row.level as OrgLevel,
    teamName: row.team_name,
    wins: row.wins,
    losses: row.losses,
    homeWins: row.home_wins,
    homeLosses: row.home_losses,
    awayWins: row.away_wins,
    awayLosses: row.away_losses,
    last5: row.last_5,
    last10: row.last_10,
    last15: row.last_15,
    streak: row.streak,
    runsScored: row.runs_scored,
    runsAllowed: row.runs_allowed,
    avg: row.avg,
    obp: row.obp,
    slg: row.slg,
    ops: row.ops,
    era: row.era,
    fip: row.fip,
    siera: row.siera,
    gamesBack: row.games_back,
    xRecord: row.x_record,
    vs500Record: row.vs500_record,
    nextGameDate: row.next_game_date,
    nextGameOpponent: row.next_game_opponent,
    nextGameIsHome: row.next_game_is_home,
    nextGameUrl: row.next_game_url,
    updatedAt: row.updated_at,
  }
}

// Fallback season-length assumptions (roughly real MiLB schedule lengths)
// used for the "Qualified" filter when team_level_records doesn't have a
// row for that level yet — real team_level_records data (wins+losses)
// takes priority whenever it's available.
const FALLBACK_TEAM_GAMES: Record<string, number> = {
  MLB: 162,
  AAA: 150,
  AA: 138,
  'A+': 132,
  A: 120,
  FCL: 60,
  DSL: 72,
}

/** Team games played per level, for the Tab 2 "Qualified" filter (3.1 PA or 1.0 IP per team game). */
export async function fetchTeamGamesByLevel(): Promise<Record<string, number>> {
  const result = { ...FALLBACK_TEAM_GAMES }
  if (!supabaseConfigured) return result
  const records = await fetchTeamLevelRecords()
  for (const r of records) {
    const games = r.wins + r.losses
    if (games > 0) result[r.level] = games
  }
  return result
}

// =====================================================================
// Tab 7: Writer
// =====================================================================

export interface WriterArticle {
  id: string
  title: string
  url: string
  company: string
  category: string | null
  contentType: string
  publishedDate: string | null
  source: 'scraped' | 'manual'
}

function mapArticleRow(row: Record<string, any>): WriterArticle {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    company: row.company,
    category: row.category,
    contentType: row.content_type,
    publishedDate: row.published_date,
    source: row.source,
  }
}

export async function fetchWriterArticles(): Promise<WriterArticle[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase.from('writer_articles').select('*').order('published_date', { ascending: false })
  if (error || !data) return []
  return data.map(mapArticleRow)
}

export async function addWriterArticle(article: {
  title: string
  url: string
  company: string
  category?: string | null
  contentType: string
  publishedDate?: string | null
  source?: 'scraped' | 'manual'
}) {
  return supabase.from('writer_articles').upsert(
    {
      title: article.title,
      url: article.url,
      company: article.company,
      category: article.category ?? null,
      content_type: article.contentType,
      published_date: article.publishedDate ?? null,
      source: article.source ?? 'manual',
    },
    { onConflict: 'url' },
  )
}

export async function deleteWriterArticle(id: string) {
  return supabase.from('writer_articles').delete().eq('id', id)
}

export interface WriterIncomeRow {
  id: string
  year: number
  month: number
  company: string
  amount: number
  notes: string | null
}

export interface WriterExpenseRow {
  id: string
  year: number
  month: number
  category: string | null
  description: string | null
  amount: number
}

export async function fetchWriterFinances(year: number): Promise<{
  income: WriterIncomeRow[]
  expenses: WriterExpenseRow[]
}> {
  if (!supabaseConfigured) return { income: [], expenses: [] }
  const [{ data: incomeRows }, { data: expenseRows }] = await Promise.all([
    supabase.from('writer_income').select('*').eq('year', year).order('month'),
    supabase.from('writer_expenses').select('*').eq('year', year).order('month'),
  ])
  return {
    income: (incomeRows ?? []).map((r: any) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      company: r.company,
      amount: Number(r.amount),
      notes: r.notes,
    })),
    expenses: (expenseRows ?? []).map((r: any) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      category: r.category,
      description: r.description,
      amount: Number(r.amount),
    })),
  }
}

export async function addWriterIncome(row: { year: number; month: number; company: string; amount: number; notes?: string }) {
  return supabase.from('writer_income').insert({
    year: row.year,
    month: row.month,
    company: row.company,
    amount: row.amount,
    notes: row.notes ?? null,
  })
}

export async function deleteWriterIncome(id: string) {
  return supabase.from('writer_income').delete().eq('id', id)
}

export async function addWriterExpense(row: { year: number; month: number; category?: string; description?: string; amount: number }) {
  return supabase.from('writer_expenses').insert({
    year: row.year,
    month: row.month,
    category: row.category ?? null,
    description: row.description ?? null,
    amount: row.amount,
  })
}

export async function deleteWriterExpense(id: string) {
  return supabase.from('writer_expenses').delete().eq('id', id)
}
/** Tab 2 inline position edit — saves permanently to hitter_stats/pitcher_stats. Only supported for current-season rows. */
export async function updateHitterPosition(dbId: string, position: string) {
  return supabase.from('hitter_stats').update({ position }).eq('id', dbId)
}
export async function updatePitcherPosition(dbId: string, position: string) {
  return supabase.from('pitcher_stats').update({ position }).eq('id', dbId)
}

/**
 * Tab 1: one row per affiliate, sorted MLB → DSL. Deliberately NOT cached
 * (unlike most reads here) — this table now updates once a day via the
 * standings automation running outside the browser (see
 * scripts/fetch-standings.mjs), so a cached copy would go stale with no
 * way for the app to know to refresh it. It's only 7 rows, so fetching
 * fresh every time is cheap.
 */
export async function fetchTeamLevelRecords(): Promise<TeamLevelRecord[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabase.from('team_level_records').select('*')
  if (error || !data) return []
  const records = data.map(mapTeamRecordRow)
  return records.sort((a, b) => ORG_LEVELS.indexOf(a.level) - ORG_LEVELS.indexOf(b.level))
}

/**
 * Tab 2 / All-Org Team / Prospect Comps: hitters for one or more seasons.
 * The current season lives in `hitter_stats`; any other season comes from
 * `historical_hitter_stats` — they're separate tables (see schema.sql), so
 * this fans out to both when a mixed year selection is requested.
 */
export async function fetchHitters(seasons: number[]): Promise<HitterSeasonStats[]> {
  if (!supabaseConfigured) return []
  const wantCurrent = seasons.length === 0 || seasons.includes(CURRENT_SEASON)
  const historicalSeasons = seasons.filter((s) => s !== CURRENT_SEASON)

  const results: HitterSeasonStats[] = []

  if (wantCurrent) {
    // Not cached — current-season rows can now change from outside the app
    // (manual position edits, SQL, the standings/position automations), so
    // a stale-forever cache would hide those changes on other devices.
    const { data, error } = await supabase.from('hitter_stats').select('*')
    const current = error || !data ? [] : data.map(mapHitterRow)
    results.push(...current)
  }

  if (historicalSeasons.length > 0 || (seasons.length === 0 && wantCurrent === false)) {
    const key = `historical_hitter_stats:${historicalSeasons.slice().sort().join(',')}`
    const historical = await cachedFetch(key, async () => {
      let query = supabase.from('historical_hitter_stats').select('*')
      if (historicalSeasons.length > 0) query = query.in('season', historicalSeasons)
      const { data, error } = await query
      return error || !data ? [] : data.map(mapHitterRow)
    })
    results.push(...historical)
  }

  return results
}

/** Same as fetchHitters, for pitchers. */
export async function fetchPitchers(seasons: number[]): Promise<PitcherSeasonStats[]> {
  if (!supabaseConfigured) return []
  const wantCurrent = seasons.length === 0 || seasons.includes(CURRENT_SEASON)
  const historicalSeasons = seasons.filter((s) => s !== CURRENT_SEASON)

  const results: PitcherSeasonStats[] = []

  if (wantCurrent) {
    // Not cached — see the matching comment in fetchHitters above.
    const { data, error } = await supabase.from('pitcher_stats').select('*')
    const current = error || !data ? [] : data.map(mapPitcherRow)
    results.push(...current)
  }

  if (historicalSeasons.length > 0) {
    const key = `historical_pitcher_stats:${historicalSeasons.slice().sort().join(',')}`
    const historical = await cachedFetch(key, async () => {
      let query = supabase.from('historical_pitcher_stats').select('*')
      if (historicalSeasons.length > 0) query = query.in('season', historicalSeasons)
      const { data, error } = await query
      return error || !data ? [] : data.map(mapPitcherRow)
    })
    results.push(...historical)
  }

  return results
}

/** Every season that actually has data — current season (if hitter_stats has rows) plus whatever's in the historical archive. */
export async function fetchAvailableSeasons(): Promise<number[]> {
  if (!supabaseConfigured) return [CURRENT_SEASON]
  return cachedFetch('available-seasons', async () => {
    const [{ data: currentRows }, { data: histHitterRows }, { data: histPitcherRows }] = await Promise.all([
      supabase.from('hitter_stats').select('name').limit(1),
      supabase.from('historical_hitter_stats').select('season'),
      supabase.from('historical_pitcher_stats').select('season'),
    ])
    const seasons = new Set<number>()
    if (currentRows && currentRows.length > 0) seasons.add(CURRENT_SEASON)
    histHitterRows?.forEach((r: any) => seasons.add(r.season))
    histPitcherRows?.forEach((r: any) => seasons.add(r.season))
    if (seasons.size === 0) seasons.add(CURRENT_SEASON) // always show current as an option even if empty
    return Array.from(seasons).sort((a, b) => b - a)
  })
}

/**
 * Tab 5 "Add from database": current-season players only, ONE row per
 * player — the combined/total line if they played multiple levels this
 * season, or their only row if they didn't. Includes the stat line shown
 * next to each name in the Top 30 list.
 */
export interface PoolPlayer {
  playerId: string
  name: string
  position: string
  age: number
  level: OrgLevel
  team: string
  playerType: 'Hitter' | 'Pitcher'
  // Hitters
  avg?: number
  ops?: number
  wrcPlus?: number
  bbPct?: number
  kPct?: number
  // Pitchers
  throws?: string
  era?: number
  fip?: number
  siera?: number
  kbbPct?: number
}

/**
 * Collapses possibly-multiple rows per player down to one: prefer the row
 * marked is_total (the combined season line), and if a legacy/edge-case
 * player has no row flagged that way, fall back to whichever row has the
 * most playing time (PA or IP) as the best stand-in for "their season."
 */
function dedupeToOneRowPerPlayer<T extends { name: string; isTotal: boolean }>(
  rows: T[],
  volumeKey: 'pa' | 'ip',
): T[] {
  const byName = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(row)
  }
  const result: T[] = []
  for (const group of byName.values()) {
    const total = group.find((r) => r.isTotal)
    if (total) {
      result.push(total)
    } else {
      result.push([...group].sort((a: any, b: any) => (b[volumeKey] ?? 0) - (a[volumeKey] ?? 0))[0])
    }
  }
  return result
}

export async function fetchCombinedPlayerPool(): Promise<PoolPlayer[]> {
  if (!supabaseConfigured) return []
  const [hittersRaw, pitchersRaw] = await Promise.all([
    fetchHitters([CURRENT_SEASON]),
    fetchPitchers([CURRENT_SEASON]),
  ])
  const hitters = dedupeToOneRowPerPlayer(hittersRaw, 'pa')
  const pitchers = dedupeToOneRowPerPlayer(pitchersRaw, 'ip')
  return [
    ...hitters.map((h) => ({
      playerId: h.playerId,
      name: h.name,
      position: h.position,
      age: h.age,
      level: h.level,
      team: h.team,
      playerType: 'Hitter' as const,
      avg: h.avg,
      ops: h.ops,
      wrcPlus: h.wrcPlus,
      bbPct: h.bbPct,
      kPct: h.kPct,
    })),
    ...pitchers.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      position: p.position,
      age: p.age,
      level: p.level,
      team: p.team,
      playerType: 'Pitcher' as const,
      throws: p.throws,
      era: p.era,
      fip: p.fip,
      siera: p.siera,
      kbbPct: p.kbbPct,
    })),
  ]
}

/** Case-insensitive exact-name match against the current-season database, used by Tab 5's auto-link prompt. */
export async function findDatabaseMatch(name: string): Promise<PoolPlayer | undefined> {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return undefined
  const pool = await fetchCombinedPlayerPool()
  return pool.find((p) => p.name.trim().toLowerCase() === normalized)
}

/** Tab 4 eligibility: current-season players with under 162 career MLB games. */
export async function fetchEligibleProspects(year: number): Promise<{
  hitters: HitterSeasonStats[]
  pitchers: PitcherSeasonStats[]
}> {
  const [hitters, pitchers] = await Promise.all([fetchHitters([year]), fetchPitchers([year])])
  return {
    hitters: hitters.filter((h) => h.mlbGamesCareer < 162),
    pitchers: pitchers.filter((p) => p.mlbGamesCareer < 162),
  }
}

export interface CompPoolHitterRow {
  playerId: string
  name: string
  years: string
  level: OrgLevel
  age: number
  avg: number
  obp: number
  slg: number
  ops: number
  wrcPlus: number
  bbPct: number
  kPct: number
  outcome: string
}

export interface CompPoolPitcherRow {
  playerId: string
  name: string
  years: string
  level: OrgLevel
  age: number
  era: number
  fip: number
  siera: number
  whip: number
  kPct: number
  bbPct: number
  kbbPct: number
  outcome: string
}

/**
 * Tab 4's comparison pool. Empty until you build out
 * prospect_comp_pool_hitters/pitchers (see supabase/schema.sql) — there's
 * no upload flow for this yet since it's a one-time historical research
 * exercise, not a recurring stat pull. ProspectComps.tsx shows an
 * appropriate empty state when these come back empty.
 */
export async function fetchProspectCompPool(): Promise<{
  hitters: CompPoolHitterRow[]
  pitchers: CompPoolPitcherRow[]
}> {
  if (!supabaseConfigured) return { hitters: [], pitchers: [] }
  return cachedFetch('prospect-comp-pool', async () => {
    const [{ data: hitterRows }, { data: pitcherRows }] = await Promise.all([
      supabase.from('prospect_comp_pool_hitters').select('*'),
      supabase.from('prospect_comp_pool_pitchers').select('*'),
    ])
    return {
      hitters: (hitterRows ?? []).map((r: any) => ({
        playerId: r.player_id,
        name: r.name,
        years: r.years,
        level: r.level,
        age: r.age,
        avg: r.avg,
        obp: r.obp,
        slg: r.slg,
        ops: r.ops,
        wrcPlus: r.wrc_plus,
        bbPct: r.bb_pct,
        kPct: r.k_pct,
        outcome: r.outcome,
      })),
      pitchers: (pitcherRows ?? []).map((r: any) => ({
        playerId: r.player_id,
        name: r.name,
        years: r.years,
        level: r.level,
        age: r.age,
        era: r.era,
        fip: r.fip,
        siera: r.siera,
        whip: r.whip,
        kPct: r.k_pct,
        bbPct: r.bb_pct,
        kbbPct: r.kbb_pct,
        outcome: r.outcome,
      })),
    }
  })
}
