import { MOCK_HITTERS, MOCK_PITCHERS, CURRENT_SEASON } from '@/data/mockData'
import type { OrgLevel, Position } from '@/types'

/**
 * Flattened view of every player currently in the database (hitters +
 * pitchers), used anywhere the app needs a simple "pick a player" search —
 * right now that's Tab 5's "Add from database" flow. Filtered to the
 * current season so a past-season Historical Archive row for the same
 * player doesn't show up as a second, confusing entry.
 *
 * TODO(supabase): once hitter_stats/pitcher_stats are read from Supabase
 * instead of mockData, this function's shape stays the same — just swap
 * the two MOCK_ arrays for the live query results.
 */
export interface PoolPlayer {
  playerId: string
  name: string
  position: Position
  age: number
  level: OrgLevel
  team: string
  playerType: 'Hitter' | 'Pitcher'
}

export function getCombinedPlayerPool(): PoolPlayer[] {
  return [
    ...MOCK_HITTERS.filter((h) => h.season === CURRENT_SEASON).map((h) => ({
      playerId: h.playerId,
      name: h.name,
      position: h.position,
      age: h.age,
      level: h.level,
      team: h.team,
      playerType: 'Hitter' as const,
    })),
    ...MOCK_PITCHERS.filter((p) => p.season === CURRENT_SEASON).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      position: p.position,
      age: p.age,
      level: p.level,
      team: p.team,
      playerType: 'Pitcher' as const,
    })),
  ]
}

/**
 * Case-insensitive exact-name match against the database. Used to detect
 * when a manually-added Top 30 player has since started recording stats
 * (i.e. shown up in an upload) so the UI can offer to link the two records.
 * TODO(data quality): exact-name matching is a placeholder — worth
 * upgrading to fuzzy matching + DOB/level checks once real uploads land,
 * so "Jose Ramirez" the DSL signee doesn't get linked to the wrong org's
 * "Jose Ramirez" by accident.
 */
export function findDatabaseMatch(name: string): PoolPlayer | undefined {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return undefined
  return getCombinedPlayerPool().find((p) => p.name.trim().toLowerCase() === normalized)
}
