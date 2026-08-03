// The priority-merge engine for multi-source stats (ProspectSavant /
// TJStats / FanGraphs). See supabase/multi-source-stats-migration.sql for
// the `stat_sources` column this reads/writes.
//
// The core problem this solves: a blind "fill blanks only" upload rule
// breaks the moment upload order doesn't match priority order (e.g.
// uploading TJStats before ProspectSavant would let TJStats permanently
// claim a column ProspectSavant should have won). Tracking WHICH source
// currently owns each value — not just whether it's blank — makes the
// priority rule hold regardless of what order you upload the three
// sources in.

export type StatSource = 'ProspectSavant' | 'TJStats' | 'FanGraphs'

/** Lower number = higher priority. Used as the universal rank scale stored in stat_sources. */
const SOURCE_RANK: Record<StatSource, number> = {
  ProspectSavant: 1,
  TJStats: 2,
  FanGraphs: 3,
}

/**
 * Per-stat-column priority order, straight from the spec. A column with
 * only one source listed means "only that source ever writes this column"
 * — no cascade, no possibility of being overwritten by anything else.
 */
export const HITTER_STAT_PRIORITY: Record<string, StatSource[]> = {
  // Standard — FanGraphs only, no cascade
  g: ['FanGraphs'],
  avg: ['FanGraphs'],
  obp: ['FanGraphs'],
  slg: ['FanGraphs'],
  ops: ['FanGraphs'],
  hr: ['FanGraphs'],
  sb: ['FanGraphs'],
  wrc_plus: ['FanGraphs'],
  woba: ['ProspectSavant', 'FanGraphs'],
  // Expected
  xba: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  xslg: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  xwoba: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  // Plate discipline
  bb_pct: ['ProspectSavant'],
  k_pct: ['ProspectSavant'],
  chase_pct: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  whiff_pct: ['ProspectSavant'],
  swing_pct: ['ProspectSavant'],
  z_swing_pct: ['ProspectSavant'],
  z_contact_pct: ['TJStats'],
  pull_pct: ['ProspectSavant'],
  pull_air_pct: ['ProspectSavant'],
  gb_pct: ['ProspectSavant'],
  // Batted ball / Statcast / bat tracking
  ev_avg: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  ev_max: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  la_avg: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  barrel_pct: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  hardhit_pct: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  bat_speed: ['ProspectSavant', 'TJStats', 'FanGraphs'],
}

export const PITCHER_STAT_PRIORITY: Record<string, StatSource[]> = {
  // Standard — FanGraphs only, no cascade
  g: ['FanGraphs'],
  gs: ['FanGraphs'],
  ip: ['FanGraphs'],
  era: ['FanGraphs'],
  fip: ['FanGraphs'],
  siera: ['FanGraphs'],
  whip: ['FanGraphs'],
  // AVG/SLG/OBP/wOBA-against — added specifically so the Expected diffs
  // below have something real to subtract from (see clarifying exchange)
  avg: ['FanGraphs', 'ProspectSavant'],
  slg: ['FanGraphs', 'ProspectSavant'],
  obp: ['FanGraphs', 'ProspectSavant'],
  woba: ['FanGraphs', 'ProspectSavant'],
  fb_velo: ['ProspectSavant', 'TJStats'],
  // Expected
  xba: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  xslg: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  xwoba: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  // Plate discipline
  k_pct: ['ProspectSavant', 'FanGraphs'],
  bb_pct: ['ProspectSavant', 'FanGraphs'],
  kbb_pct: ['ProspectSavant', 'FanGraphs'],
  chase_pct: ['ProspectSavant', 'FanGraphs'],
  whiff_pct: ['ProspectSavant', 'FanGraphs'],
  swstr_pct: ['ProspectSavant', 'FanGraphs'],
  swing_pct: ['ProspectSavant'],
  z_swing_pct: ['ProspectSavant'],
  z_contact_pct: ['TJStats'],
  pull_pct: ['ProspectSavant'],
  pull_air_pct: ['ProspectSavant'],
  gb_pct: ['ProspectSavant'],
  extension: ['ProspectSavant'],
  // Batted ball
  ev_avg: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  la_avg: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  barrel_pct: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  hardhit_pct: ['ProspectSavant', 'TJStats', 'FanGraphs'],
  sweet_spot_pct: ['TJStats'],
  // Stuff — overall grades are FanGraphs-only; per-pitch-type tjStuff+
  // lives in pitcher_pitch_characteristics, not here
  stuff_plus: ['FanGraphs'],
  location_plus: ['FanGraphs'],
  pitching_plus: ['FanGraphs'],
  tjstuff_plus_overall: ['TJStats'], // TJStats' own overall grade — kept separate from FanGraphs' Stuff+ per the spec, not a fallback for it
  stf_plus_fa: ['FanGraphs'],
  stf_plus_si: ['FanGraphs'],
  stf_plus_fs: ['FanGraphs'],
  stf_plus_fc: ['FanGraphs'],
  stf_plus_sl: ['FanGraphs'],
  stf_plus_cu: ['FanGraphs'],
  stf_plus_ch: ['FanGraphs'],
}

/**
 * Given an incoming partial row from one source (already mapped to our
 * snake_case DB column names) plus the existing row's current values and
 * its stat_sources tracking map, returns the merged row + updated
 * tracking map — respecting priority regardless of what's already there.
 *
 * Columns not present in `incoming` are left untouched entirely (existing
 * value AND existing source tracking both preserved) — this is what lets
 * a partial upload (e.g. a report with only 5 columns) coexist safely
 * with everything already on the row.
 */
export function mergeWithPriority(
  incoming: Record<string, any>,
  existing: Record<string, any> | null,
  existingSources: Record<string, number>,
  source: StatSource,
  priorityTable: Record<string, StatSource[]>,
): { merged: Record<string, any>; sources: Record<string, number> } {
  const merged: Record<string, any> = { ...(existing ?? {}) }
  const sources: Record<string, number> = { ...existingSources }
  const incomingRank = SOURCE_RANK[source]

  for (const [column, value] of Object.entries(incoming)) {
    if (value == null) continue // never overwrite with a blank

    const allowedSources = priorityTable[column]
    if (allowedSources && !allowedSources.includes(source)) {
      // This source isn't in the priority list for this column at all —
      // skip it silently rather than writing data we were told never to
      // use for this stat.
      continue
    }

    const currentRank = sources[column]
    if (currentRank === undefined || incomingRank <= currentRank) {
      merged[column] = value
      sources[column] = incomingRank
    }
    // else: a higher-priority source already owns this value — leave it alone
  }

  return { merged, sources }
}

/**
 * The three "over/under expectation" diffs from the spec, computed at
 * read time (not stored) so they're always consistent with whatever the
 * underlying AVG/SLG/wOBA and xBA/xSLG/xwOBA currently are.
 */
export function computeExpectedDiffs(row: { avg?: number | null; slg?: number | null; woba?: number | null; xba?: number | null; xslg?: number | null; xwoba?: number | null }) {
  return {
    avgVsExpected: row.avg != null && row.xba != null ? row.avg - row.xba : null,
    slgVsExpected: row.slg != null && row.xslg != null ? row.slg - row.xslg : null,
    wobaVsExpected: row.woba != null && row.xwoba != null ? row.woba - row.xwoba : null,
  }
}
