// Core domain types shared across tabs. These mirror the Supabase schema in
// supabase/schema.sql — keep them in sync when you evolve the DB.

export type OrgLevel = 'MLB' | 'AAA' | 'AA' | 'A+' | 'A' | 'DSL' | 'FCL'

export const ORG_LEVELS: OrgLevel[] = ['MLB', 'AAA', 'AA', 'A+', 'A', 'FCL', 'DSL']

export const LEVEL_TEAM_NAMES: Record<OrgLevel, string> = {
  MLB: 'Atlanta Braves',
  AAA: 'Gwinnett Stripers',
  AA: 'Columbus Clingstones',
  'A+': 'Rome Emperors',
  A: 'Augusta GreenJackets',
  FCL: 'FCL Braves',
  DSL: 'DSL Braves',
}

export type ThrowsBats = 'L' | 'R' | 'S'
export type PlayerType = 'Hitter' | 'Pitcher'

export type Position =
  | 'C'
  | '1B'
  | '2B'
  | '3B'
  | 'SS'
  | 'LF'
  | 'CF'
  | 'RF'
  | 'DH'
  | 'OF'
  | 'IF'
  | 'SP'
  | 'RP'

/** Aggregate won/loss + run/splits record for one team at one level. */
export interface TeamLevelRecord {
  level: OrgLevel
  teamName: string
  wins: number
  losses: number
  homeWins: number
  homeLosses: number
  awayWins: number
  awayLosses: number
  last5: string // e.g. "3-2"
  last10: string
  last15: string
  streak: string // e.g. "W3" / "L2"
  runsScored: number
  runsAllowed: number
  // Team-level slash + pitching marks shown in Tab 1
  avg: number
  obp: number
  slg: number
  ops: number
  era: number
  fip: number
  siera: number
  // Extra columns pulled straight from MLB.com/MiLB.com standings pages
  gamesBack?: string | null // e.g. "7.0" or "-"
  xRecord?: string | null // Pythagorean expected W-L based on run differential
  vs500Record?: string | null // record against teams .500 or better
  nextGameDate?: string | null
  nextGameOpponent?: string | null // e.g. "@ TOL" or "vs. ASH"
  nextGameIsHome?: boolean | null
  nextGameUrl?: string | null
  updatedAt: string // ISO date of last data pull (Tab 6 upload)
}

export interface HitterSeasonStats {
  dbId: string // the row's own primary key in Supabase — needed to save edits back
  playerId: string
  name: string
  season: number // e.g. 2026 — current season, or a past year from the Historical Archive
  level: OrgLevel
  team: string
  position: Position
  age: number
  bats: ThrowsBats
  g: number
  pa: number
  ab: number
  avg: number
  obp: number
  slg: number
  ops: number
  wrcPlus: number
  bbPct: number
  kPct: number
  hr: number
  sb: number
  mlbGamesCareer: number // career MLB games (any team) — drives Tab 4 eligibility
  isTotal: boolean // true = this row is the player's combined season line (or their only level)

  // ---- Multi-source stats (ProspectSavant / TJStats / FanGraphs) ----
  // Each field below is filled from whichever source's priority cascade
  // won for that specific stat — see lib/priorityMerge.ts's
  // HITTER_STAT_PRIORITY for the exact per-stat source order. Optional
  // since a stat is only populated once at least one of its sources has
  // been uploaded.

  // Expected
  woba?: number | null
  xba?: number | null
  xslg?: number | null
  xwoba?: number | null
  // Computed at read time (not stored) — see computeExpectedDiffs()
  avgVsExpected?: number | null // AVG - xBA
  slgVsExpected?: number | null // SLG - xSLG
  wobaVsExpected?: number | null // wOBA - xwOBA

  // Plate discipline
  chasePct?: number | null
  whiffPct?: number | null
  swingPct?: number | null
  zSwingPct?: number | null
  zContactPct?: number | null
  pullAirPct?: number | null

  // Batted Ball (optional — only present if that report was uploaded)
  gbPct?: number | null
  fbPct?: number | null
  ldPct?: number | null
  hrFbPct?: number | null
  pullPct?: number | null
  centPct?: number | null
  oppoPct?: number | null
  hardPct?: number | null
  // Statcast
  evAvg?: number | null
  evMax?: number | null
  laAvg?: number | null
  barrelPct?: number | null
  hardHitPct?: number | null
  // Bat Tracking
  batSpeed?: number | null
  swingLength?: number | null
  squaredUpPct?: number | null
  blastPct?: number | null
}

export interface PitcherSeasonStats {
  dbId: string
  playerId: string
  name: string
  season: number
  level: OrgLevel
  team: string
  position: 'SP' | 'RP'
  age: number
  throws: ThrowsBats
  g: number
  gs: number
  ip: number
  era: number
  fip: number
  siera: number
  whip: number
  kPct: number
  bbPct: number
  kbbPct: number
  mlbGamesCareer: number
  isTotal: boolean

  // ---- Multi-source stats (ProspectSavant / TJStats / FanGraphs) ----
  // See lib/priorityMerge.ts's PITCHER_STAT_PRIORITY for the exact
  // per-stat source order.

  // AVG/SLG/OBP/wOBA-against — added specifically so the Expected diffs
  // below have something real to subtract from
  avg?: number | null
  slg?: number | null
  obp?: number | null
  woba?: number | null
  fbVelo?: number | null

  // Expected
  xba?: number | null
  xslg?: number | null
  xwoba?: number | null
  // Computed at read time (not stored) — see computeExpectedDiffs()
  avgVsExpected?: number | null
  slgVsExpected?: number | null
  wobaVsExpected?: number | null

  // Plate discipline
  chasePct?: number | null
  whiffPct?: number | null
  swstrPct?: number | null
  swingPct?: number | null
  zSwingPct?: number | null
  zContactPct?: number | null
  pullPct?: number | null
  pullAirPct?: number | null
  extension?: number | null

  // Batted Ball
  gbPct?: number | null
  fbPct?: number | null
  ldPct?: number | null
  hrFbPct?: number | null
  hardPct?: number | null
  evAvg?: number | null
  laAvg?: number | null
  barrelPct?: number | null
  hardHitPct?: number | null
  sweetSpotPct?: number | null

  // Statcast (pre-existing)
  xera?: number | null

  // Pitch grades — overall (Fangraphs' stuff/location/pitching models).
  // Per-pitch-type tjStuff+ and pitch characteristics (Velo/Spin/IVB/HB/
  // Extension per pitch) live in a separate table — see
  // pitcher_pitch_characteristics in supabase/multi-source-stats-migration.sql
  // and PitchCharacteristics below — not here, since a pitcher throwing
  // 4 of 7 possible pitch types would otherwise mean ~40 mostly-empty
  // columns on this table.
  stuffPlus?: number | null
  locationPlus?: number | null
  pitchingPlus?: number | null
}

export type PitchType = 'FF' | 'SI' | 'FS' | 'FC' | 'SL' | 'ST' | 'CU' | 'CH'

/** One row per (pitcher, pitch type) — TJStats-sourced, see multi-source-stats-migration.sql. */
export interface PitchCharacteristics {
  id: string
  pitcherName: string
  team: string | null
  level: OrgLevel | null
  season: number
  pitchType: PitchType
  velo: number | null
  veloMax: number | null
  spinRate: number | null
  ivb: number | null // induced vertical break
  hb: number | null // horizontal break
  extension: number | null
  usagePct: number | null
  tjStuffPlus: number | null
}

export type PlayerRow =
  | ({ playerType: 'Hitter' } & HitterSeasonStats)
  | ({ playerType: 'Pitcher' } & PitcherSeasonStats)

export interface Top30Entry {
  id: string
  rank: number | null // null = in the "off the list" bucket
  name: string
  position: Position
  age: number
  notes?: string
  /** Links to hitter_stats/pitcher_stats.player_id once the player is in the database. Null for manually-added players who don't have stats yet. */
  playerId: string | null
  /** 'database' = selected from an existing player record. 'manual' = typed in by hand, not yet linked. */
  source: 'database' | 'manual'
}

/**
 * A saved, dated copy of the Top 30 + bucket, created whenever the user hits
 * "Submit". Snapshots are immutable history — editing the working list never
 * changes a past snapshot, only future submissions create new ones.
 */
export interface Top30Snapshot {
  id: string
  submittedAt: string // ISO timestamp
  list: Top30Entry[]
  bucket: Top30Entry[]
}

export interface ProspectCompResult {
  compPlayerName: string
  compPlayerYears: string // e.g. "2016-2019 A+/AA"
  similarityScore: number // 0-100
  metrics: { metric: string; player: number; comp: number }[] // radar chart data
  blurb: string
}
