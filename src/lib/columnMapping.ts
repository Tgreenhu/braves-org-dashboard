export interface ColumnSpec {
  target: string
  candidates: string[]
  parse?: (raw: any) => any
}

function parseNumber(raw: any): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const cleaned = String(raw).replace('%', '').replace(/,/g, '').trim()
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n
}
function parseInteger(raw: any): number | null {
  const n = parseNumber(raw)
  return n === null ? null : Math.round(n)
}

// TJStats stores its "_percent" columns as a 0-1 fraction (e.g. 0.1452 for
// 14.52%), unlike FanGraphs which gives an already-scaled string like
// "14.5%" — parseNumber alone would store TJStats percentages 100x too
// small. Confirmed against a real TJStats export (see the conversation
// this was fixed in) — bb_percent/k_percent were 0.1452/0.2124 for a
// real player, not 14.52/21.24, while things named "_percent" that are
// actually rate stats on a normal scale (woba_percent, xwoba_percent —
// TJStats' naming is inconsistent here, those are NOT percentages despite
// the column name) use plain parseNumber instead, same as avg/obp/slg.
function parsePercentFraction(raw: any): number | null {
  const n = parseNumber(raw)
  return n === null ? null : n * 100
}
function parseString(raw: any): string | null {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  return s === '' ? null : s
}
const LEVEL_ALIASES: Record<string, string> = {
  MLB: 'MLB', AAA: 'AAA', AA: 'AA', 'A+': 'A+', 'HIGH-A': 'A+', 'HIGH A': 'A+',
  A: 'A', 'A-': 'A', 'LOW-A': 'A', 'SINGLE-A': 'A',
  FCL: 'FCL', GCL: 'FCL', CPX: 'FCL', ACL: 'FCL', DSL: 'DSL',
}
const LEVEL_PRIORITY: Record<string, number> = { MLB: 1, AAA: 2, AA: 3, 'A+': 4, A: 5, FCL: 6, DSL: 7 }
function parseLevel(raw: any): string | null {
  const s = parseString(raw)
  if (!s) return null
  if (s.includes(',')) {
    const tokens = s.split(',').map((t) => LEVEL_ALIASES[t.trim().toUpperCase()] ?? t.trim().toUpperCase())
    tokens.sort((a, b) => (LEVEL_PRIORITY[a] ?? 99) - (LEVEL_PRIORITY[b] ?? 99))
    return tokens[0]
  }
  return LEVEL_ALIASES[s.toUpperCase()] ?? s
}

export const HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'position', candidates: ['Pos', 'Position'], parse: parseString },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
]
export const PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'position', candidates: ['Pos', 'Role'], parse: parseString },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
]
export const COMP_HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
]
export const COMP_PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
]

export function mapRow(row: Record<string, any>, columns: ColumnSpec[]): Record<string, any> {
  const mapped: Record<string, any> = {}
  const sourceKeys = Object.keys(row)
  for (const col of columns) {
    const matchKey = sourceKeys.find((k) => col.candidates.some((c) => c.trim().toLowerCase() === k.trim().toLowerCase()))
    if (matchKey !== undefined) {
      mapped[col.target] = col.parse ? col.parse(row[matchKey]) : row[matchKey]
    }
  }
  return mapped
}
export const PROSPECTSAVANT_HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name', 'Player'], parse: parseString },
  { target: 'team', candidates: ['Team', 'Org'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lvl'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'woba', candidates: ['wOBA'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
  { target: 'bb_pct', candidates: ['BB%'], parse: parseNumber },
  { target: 'k_pct', candidates: ['K%'], parse: parseNumber },
  { target: 'chase_pct', candidates: ['Chase%', 'O-Swing%'], parse: parseNumber },
  { target: 'whiff_pct', candidates: ['Whiff%'], parse: parseNumber },
  { target: 'swing_pct', candidates: ['Swing%'], parse: parseNumber },
  { target: 'z_swing_pct', candidates: ['Z-Swing%'], parse: parseNumber },
  { target: 'z_contact_pct', candidates: ['Z-Contact%'], parse: parseNumber },
  { target: 'pull_pct', candidates: ['Pull%'], parse: parseNumber },
  { target: 'pull_air_pct', candidates: ['Pull Air%', 'PullAir%', 'Pull-Air%'], parse: parseNumber },
  { target: 'gb_pct', candidates: ['GB%'], parse: parseNumber },
  { target: 'ev_avg', candidates: ['EV', 'Avg EV'], parse: parseNumber },
  { target: 'ev_max', candidates: ['Max EV', 'maxEV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['LA', 'Avg LA'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['Barrel%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
  { target: 'bat_speed', candidates: ['Bat Speed'], parse: parseNumber },
]

export const PROSPECTSAVANT_PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name', 'Player'], parse: parseString },
  { target: 'team', candidates: ['Team', 'Org'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lvl'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'avg', candidates: ['AVG', 'AVG Against'], parse: parseNumber },
  { target: 'slg', candidates: ['SLG', 'SLG Against'], parse: parseNumber },
  { target: 'obp', candidates: ['OBP', 'OBP Against'], parse: parseNumber },
  { target: 'woba', candidates: ['wOBA'], parse: parseNumber },
  { target: 'fb_velo', candidates: ['FB Velo', 'Fastball Velo', 'FBv'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
  { target: 'k_pct', candidates: ['K%'], parse: parseNumber },
  { target: 'bb_pct', candidates: ['BB%'], parse: parseNumber },
  { target: 'kbb_pct', candidates: ['K-BB%'], parse: parseNumber },
  { target: 'chase_pct', candidates: ['Chase%'], parse: parseNumber },
  { target: 'whiff_pct', candidates: ['Whiff%'], parse: parseNumber },
  { target: 'swstr_pct', candidates: ['SwStr%'], parse: parseNumber },
  { target: 'swing_pct', candidates: ['Swing%'], parse: parseNumber },
  { target: 'z_swing_pct', candidates: ['Z-Swing%'], parse: parseNumber },
  { target: 'pull_pct', candidates: ['Pull%'], parse: parseNumber },
  { target: 'pull_air_pct', candidates: ['Pull Air%', 'PullAir%'], parse: parseNumber },
  { target: 'gb_pct', candidates: ['GB%'], parse: parseNumber },
  { target: 'extension', candidates: ['Extension', 'Ext'], parse: parseNumber },
  { target: 'ev_avg', candidates: ['EV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['LA'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['Barrel%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
]

export const TJSTATS_HITTER_COLUMNS: ColumnSpec[] = [
  // Confirmed against a real TJStats export (tjstats_batter_overview_2026.csv):
  // player_id, player_name, player_team, pa, home_run, bb_percent, k_percent,
  // iso, avg, obp, slg, woba_percent, xwoba_percent — no Level or Age column
  // on this particular tab, so 'level' falls back to the upload source's
  // configured level (see Upload.tsx) and age just won't populate from here.
  { target: 'name', candidates: ['player_name', 'Name', 'Player', 'Batter'], parse: parseString },
  { target: 'team', candidates: ['player_team', 'Team'], parse: parseString },
  { target: 'level', candidates: ['level', 'Level'], parse: parseLevel },
  { target: 'age', candidates: ['age', 'Age'], parse: parseInteger },
  { target: 'avg', candidates: ['avg', 'AVG'], parse: parseNumber },
  { target: 'obp', candidates: ['obp', 'OBP'], parse: parseNumber },
  { target: 'slg', candidates: ['slg', 'SLG'], parse: parseNumber },
  { target: 'woba', candidates: ['woba_percent', 'woba', 'wOBA'], parse: parseNumber }, // NOT a percent despite the "_percent" name — already on the normal wOBA scale
  { target: 'xwoba', candidates: ['xwoba_percent', 'xwoba', 'xwOBA'], parse: parseNumber }, // same as above
  { target: 'bb_pct', candidates: ['bb_percent', 'BB%'], parse: parsePercentFraction },
  { target: 'k_pct', candidates: ['k_percent', 'K%'], parse: parsePercentFraction },
  // Everything below this line is an UNCONFIRMED guess — likely lives on
  // one of the other tabs (tab=1/2/3), not the Overview tab checked so
  // far, but using the now-confirmed snake_case + player_ prefix + 0-1
  // fraction convention. Send the other tabs' files to lock these down.
  { target: 'z_contact_pct', candidates: ['z_contact_percent', 'zcontact_percent', 'Z-Contact%'], parse: parsePercentFraction },
  { target: 'chase_pct', candidates: ['chase_percent', 'o_swing_percent', 'Chase%'], parse: parsePercentFraction },
  { target: 'whiff_pct', candidates: ['whiff_percent', 'Whiff%'], parse: parsePercentFraction },
  { target: 'swing_pct', candidates: ['swing_percent', 'Swing%'], parse: parsePercentFraction },
  { target: 'z_swing_pct', candidates: ['z_swing_percent', 'Z-Swing%'], parse: parsePercentFraction },
  { target: 'pull_pct', candidates: ['pull_percent', 'Pull%'], parse: parsePercentFraction },
  { target: 'pull_air_pct', candidates: ['pull_air_percent', 'Pull Air%'], parse: parsePercentFraction },
  { target: 'gb_pct', candidates: ['gb_percent', 'GB%'], parse: parsePercentFraction },
  { target: 'ev_avg', candidates: ['ev', 'exit_velo', 'EV'], parse: parseNumber },
  { target: 'ev_max', candidates: ['max_ev', 'Max EV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['la', 'launch_angle', 'LA'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['barrel_percent', 'Barrel%'], parse: parsePercentFraction },
  { target: 'hardhit_pct', candidates: ['hardhit_percent', 'hard_hit_percent', 'HardHit%'], parse: parsePercentFraction },
  { target: 'bat_speed', candidates: ['bat_speed', 'Bat Speed'], parse: parseNumber },
  { target: 'xba', candidates: ['xba', 'xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xslg', 'xSLG'], parse: parseNumber },
]

export const TJSTATS_PITCHER_COLUMNS: ColumnSpec[] = [
  // Confirmed against two real TJStats pitcher exports — pitcher files use
  // pitcher_name/pitcher_team (NOT player_name/player_team like the batter
  // file does — different prefix convention between the two).
  { target: 'name', candidates: ['pitcher_name', 'player_name', 'Name', 'Player', 'Pitcher'], parse: parseString },
  { target: 'team', candidates: ['pitcher_team', 'player_team', 'Team'], parse: parseString },
  { target: 'level', candidates: ['level', 'Level'], parse: parseLevel },
  { target: 'age', candidates: ['age', 'Age'], parse: parseInteger },
  { target: 'avg', candidates: ['avg', 'AVG'], parse: parseNumber },
  { target: 'slg', candidates: ['slg', 'SLG'], parse: parseNumber },
  { target: 'obp', candidates: ['obp', 'OBP'], parse: parseNumber },
  { target: 'woba', candidates: ['woba_percent', 'woba', 'wOBA'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwoba_percent', 'xwoba', 'xwOBA'], parse: parseNumber },
  { target: 'z_contact_pct', candidates: ['z_contact_percent', 'Z-Contact%'], parse: parsePercentFraction },
  { target: 'fb_velo', candidates: ['fb_velo', 'fastball_velo', 'FB Velo'], parse: parseNumber },
  { target: 'sweet_spot_pct', candidates: ['sweet_spot_percent', 'swsp_percent', 'SwSP%'], parse: parsePercentFraction },
  { target: 'xba', candidates: ['xba', 'xBA'], parse: parseNumber },
  // Confirmed from tjstats_pitcher_tjstuff__2026.csv — the pitcher's
  // OVERALL TJStuff+ grade (kept as its own column, separate from
  // FanGraphs' Stuff+, per the spec). The file's per-pitch-type stuff_XX
  // columns are intentionally NOT mapped here — the pitch-characteristics
  // file below covers per-pitch tjStuff+ with more detail (velo/spin/
  // movement alongside it), so this file's per-pitch columns would just
  // be redundant with less information.
  { target: 'tjstuff_plus_overall', candidates: ['stuff_overall'], parse: parseNumber },
  { target: 'xslg', candidates: ['xslg', 'xSLG'], parse: parseNumber },
]

// =====================================================================
// Pitch Characteristics — TJStats only, no priority cascade. One row per
// (pitcher, pitch type), feeding the separate pitcher_pitch_characteristics
// table (see supabase/multi-source-stats-migration.sql) rather than
// pitcher_stats — a pitcher throwing 4 of 7 possible pitch types shouldn't
// mean ~40 mostly-empty columns on the main table.
//
// Confirmed against a real export
// (tjstats_pitcher_pitch_type_characteristics_2026.csv): pitcher_id,
// pitcher_name, pitcher_team, pitcher_hand, pitch_type, pitches, velo,
// max_velo, spin_rate, ivb, hb, extension, release_height, release_side,
// tj_stuff_plus.
// =====================================================================
export const PITCH_CHARACTERISTICS_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['pitcher_name'], parse: parseString },
  { target: 'team', candidates: ['pitcher_team'], parse: parseString },
  { target: 'pitcher_hand', candidates: ['pitcher_hand'], parse: parseString },
  { target: 'pitch_type', candidates: ['pitch_type'], parse: parseString },
  { target: 'pitches', candidates: ['pitches'], parse: parseInteger },
  { target: 'velo', candidates: ['velo'], parse: parseNumber },
  { target: 'velo_max', candidates: ['max_velo'], parse: parseNumber },
  { target: 'spin_rate', candidates: ['spin_rate'], parse: parseNumber },
  { target: 'ivb', candidates: ['ivb'], parse: parseNumber },
  { target: 'hb', candidates: ['hb'], parse: parseNumber },
  { target: 'extension', candidates: ['extension'], parse: parseNumber },
  { target: 'release_height', candidates: ['release_height'], parse: parseNumber },
  { target: 'release_side', candidates: ['release_side'], parse: parseNumber },
  { target: 'tjstuff_plus', candidates: ['tj_stuff_plus'], parse: parseNumber },
]
