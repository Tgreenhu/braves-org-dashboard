// Core domain types shared across tabs. These mirror the Supabase schema in
// supabase/schema.sql — keep them in sync when you evolve the DB.

export type OrgLevel = 'MLB' | 'AAA' | 'AA' | 'High-A' | 'A' | 'DSL' | 'FCL'

export const ORG_LEVELS: OrgLevel[] = ['MLB', 'AAA', 'AA', 'High-A', 'A', 'FCL', 'DSL']

export const LEVEL_TEAM_NAMES: Record<OrgLevel, string> = {
  MLB: 'Atlanta Braves',
  AAA: 'Gwinnett Stripers',
  AA: 'Columbus Clingstones',
  'High-A': 'Rome Emperors',
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
  updatedAt: string // ISO date of last data pull (Tab 6 upload)
}

export interface HitterSeasonStats {
  playerId: string
  name: string
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
}

export interface PitcherSeasonStats {
  playerId: string
  name: string
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
