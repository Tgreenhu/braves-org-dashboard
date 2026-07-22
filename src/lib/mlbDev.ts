// Metric definitions per the Prospect Development Dashboard spec. Kept in
// one place so the formulas are easy to audit against that document.

import { CURRENT_SEASON } from '@/lib/constants'

export type PlayerType = 'Hitter' | 'Pitcher'

export interface RankingRow {
  year: number
  rank: number
  name: string
  position: string | null
  organization: string
}

export interface CareerWarRow {
  name: string
  playerType: PlayerType | null
  careerFwar: number
  mlbSeasons: number
  organization: string | null
  debutSeason: number | null
  debutTeam: string | null
}

export interface PlayerDevRecord {
  name: string
  position: string | null
  organization: string | null
  playerType: PlayerType | null
  highestRank: number
  rankBucket: string
  yearsRanked: number[]
  mlbSeasons: number
  careerFwar: number
  annualXwar: number
  careerXwar: number
  developmentSurplus: number
  developmentIndex: number | null // null when careerXwar is 0 (avoid divide-by-zero)
}

// Franchise moves/abbreviation changes since 2018 — applied to every
// upload so a player's org history is consistent regardless of which
// year's export used which abbreviation.
const ORG_ALIASES: Record<string, string> = {
  LA: 'LAD',
  OAK: 'ATH',
  SD: 'SDP',
  TB: 'TBR',
  WSN: 'WAS',
}

export function normalizeOrg(raw: string | null | undefined): string {
  if (!raw) return 'UNK'
  const trimmed = raw.trim().toUpperCase()
  return ORG_ALIASES[trimmed] ?? trimmed
}

/** 1-10=4.0, 11-25=3.5, 26-50=3.0, 51-100=2.5, unranked=1.0 */
export function annualXwar(rank: number | null): number {
  if (rank == null) return 1.0
  if (rank <= 10) return 4.0
  if (rank <= 25) return 3.5
  if (rank <= 50) return 3.0
  if (rank <= 100) return 2.5
  return 1.0
}

export function rankBucket(rank: number | null): string {
  if (rank == null) return 'NR'
  if (rank <= 10) return '1-10'
  if (rank <= 25) return '11-25'
  if (rank <= 50) return '26-50'
  if (rank <= 100) return '51-100'
  return 'NR'
}

export const RANK_BUCKETS = ['1-10', '11-25', '26-50', '51-100', 'NR'] as const

/**
 * Joins the two raw tables into one record per player, with every derived
 * metric computed per the spec:
 *   Career xWAR = Annual xWAR × MLB Seasons
 *   Development Surplus = Career fWAR − Career xWAR
 *   Development Index = Career fWAR ÷ Career xWAR
 */
export function buildPlayerDevRecords(rankings: RankingRow[], careerWar: CareerWarRow[]): PlayerDevRecord[] {
  const byName = new Map<string, RankingRow[]>()
  for (const r of rankings) {
    const key = r.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(r)
  }
  const warByName = new Map(careerWar.map((c) => [c.name.trim().toLowerCase(), c]))

  const allNames = new Set([...byName.keys(), ...warByName.keys()])
  const records: PlayerDevRecord[] = []

  for (const key of allNames) {
    const rankRows = byName.get(key) ?? []
    const war = warByName.get(key)

    const highestRank = rankRows.length > 0 ? Math.min(...rankRows.map((r) => r.rank)) : null
    const yearsRanked = rankRows.map((r) => r.year).sort((a, b) => a - b)
    const mostRecentRankRow = [...rankRows].sort((a, b) => b.year - a.year)[0]

    const mlbSeasons = war?.debutSeason != null ? Math.max(0, CURRENT_SEASON - war.debutSeason + 1) : war?.mlbSeasons ?? 0
    const careerFwar = war?.careerFwar ?? 0
    const xwarPerSeason = annualXwar(highestRank)
    const careerXwar = xwarPerSeason * mlbSeasons

    // Organization of record: debut team takes priority (it best answers
    // "which org actually developed this player to the majors," since a
    // prospect can get traded between being ranked and debuting) — falls
    // back to whichever org had them at the time they were ranked if no
    // debut data has been uploaded for this player yet.
    const organization = normalizeOrg(war?.debutTeam ?? mostRecentRankRow?.organization ?? war?.organization ?? null)

    records.push({
      name: mostRecentRankRow?.name ?? war?.name ?? key,
      position: mostRecentRankRow?.position ?? null,
      organization,
      playerType: war?.playerType ?? null,
      highestRank: highestRank ?? Infinity, // Infinity sorts NR players last; displayed as "NR"
      rankBucket: rankBucket(highestRank),
      yearsRanked,
      mlbSeasons,
      careerFwar,
      annualXwar: xwarPerSeason,
      careerXwar,
      developmentSurplus: careerFwar - careerXwar,
      developmentIndex: careerXwar !== 0 ? careerFwar / careerXwar : null,
    })
  }

  return records
}

export interface OrgSummary {
  organization: string
  prospectCount: number
  totalWar: number
  totalXwar: number
  developmentSurplus: number
  developmentIndex: number | null
  avgWar: number
  medianWar: number
  warPerProspect: number
  positiveWarRate: number // fraction of prospects with careerFwar > 0
  rate2Plus: number
  rate5Plus: number
  rate10Plus: number
  rate20Plus: number
}

export function summarizeByOrg(records: PlayerDevRecord[]): OrgSummary[] {
  const byOrg = new Map<string, PlayerDevRecord[]>()
  for (const r of records) {
    const org = r.organization ?? 'UNK'
    if (!byOrg.has(org)) byOrg.set(org, [])
    byOrg.get(org)!.push(r)
  }

  return Array.from(byOrg.entries()).map(([organization, players]) => {
    const wars = players.map((p) => p.careerFwar).sort((a, b) => a - b)
    const totalWar = wars.reduce((s, w) => s + w, 0)
    const totalXwar = players.reduce((s, p) => s + p.careerXwar, 0)
    const n = players.length
    const median = n % 2 === 0 ? (wars[n / 2 - 1] + wars[n / 2]) / 2 : wars[(n - 1) / 2]
    const rateAtLeast = (threshold: number) => players.filter((p) => p.careerFwar >= threshold).length / n

    return {
      organization,
      prospectCount: n,
      totalWar,
      totalXwar,
      developmentSurplus: totalWar - totalXwar,
      developmentIndex: totalXwar !== 0 ? totalWar / totalXwar : null,
      avgWar: totalWar / n,
      medianWar: median,
      warPerProspect: totalWar / n,
      positiveWarRate: rateAtLeast(0.01),
      rate2Plus: rateAtLeast(2),
      rate5Plus: rateAtLeast(5),
      rate10Plus: rateAtLeast(10),
      rate20Plus: rateAtLeast(20),
    }
  })
}
