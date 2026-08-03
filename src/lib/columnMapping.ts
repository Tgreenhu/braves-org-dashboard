// Maps each source's raw CSV column headers to our Supabase schema column
// names, and drops anything we don't recognize (exports include plenty of
// columns we don't store, which would otherwise make Supabase reject the
// whole row with a "could not find column" error).
//
// TODO(verify): these candidate header names are best-effort guesses at
// each source's actual export column labels — if your real export uses
// different wording for something, add it to that field's candidates
// array below. Easiest way to check: open the CSV and look at row 1.

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

// Some "whole number" stats (wRC+ especially) come through some reports —
// the "Advanced" one in particular — as a long precise decimal (e.g.
// 80.37196200961044) rather than the rounded value the website displays.
// Our schema columns for these are plain integers, so round instead of
// erroring. Postgres would otherwise reject the whole row with "invalid
// input syntax for type integer".
function parseInteger(raw: any): number | null {
  const n = parseNumber(raw)
  return n === null ? null : Math.round(n)
}

function parseString(raw: any): string | null {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  return s === '' ? null : s
}

// TJStats stores its "_percent" columns as a 0-1 fraction (e.g. 0.1452 for
// 14.52%), unlike FanGraphs which gives an already-scaled string like
// "14.5%" — parseNumber alone would store TJStats percentages 100x too
// small. Confirmed against a real TJStats export — bb_percent/k_percent
// were 0.1452/0.2124 for a real player, not 14.52/21.24, while things
// named "_percent" that are actually rate stats on a normal scale
// (woba_percent, xwoba_percent — TJStats' naming is inconsistent here,
// those are NOT percentages despite the column name) use plain
// parseNumber instead, same as avg/obp/slg.
function parsePercentFraction(raw: any): number | null {
  const n = parseNumber(raw)
  return n === null ? null : n * 100
}

// Level labels don't always match our display labels 1:1 (e.g. "High-A"
// instead of "A+"). Known variants get normalized; anything we don't
// recognize passes through unchanged rather than being guessed at — the
// database no longer hard-rejects unrecognized values (see the dropped
// check constraint in schema.sql), so an unmapped label just shows up
// as-is instead of crashing the upload or being silently mislabeled.
const LEVEL_ALIASES: Record<string, string> = {
  MLB: 'MLB',
  AAA: 'AAA',
  AA: 'AA',
  'A+': 'A+',
  'HIGH-A': 'A+',
  'HIGH A': 'A+',
  A: 'A',
  'A-': 'A',
  'LOW-A': 'A',
  'SINGLE-A': 'A',
  FCL: 'FCL',
  GCL: 'FCL', // Florida Complex League's old name
  CPX: 'FCL', // generic "complex league" label some reports use
  ACL: 'FCL',
  DSL: 'DSL',
}

// Level priority for picking the "best" level out of a multi-level string
// (lower number = higher level). Used both for normalizing a single label
// and for resolving something like "AA,AAA" down to just "AAA".
const LEVEL_PRIORITY: Record<string, number> = { MLB: 1, AAA: 2, AA: 3, 'A+': 4, A: 5, FCL: 6, DSL: 7 }

function parseLevel(raw: any): string | null {
  const s = parseString(raw)
  if (!s) return null

  // Some exports give one row per player with a comma-joined level list
  // (e.g. "AA,AAA") for anyone who split time, instead of a separate row
  // per level. Rather than storing that garbage string as-is (which
  // silently breaks level-based bonuses/comparisons elsewhere in the
  // app), resolve it down to whichever level is highest.
  if (s.includes(',')) {
    const tokens = s.split(',').map((t) => LEVEL_ALIASES[t.trim().toUpperCase()] ?? t.trim().toUpperCase())
    tokens.sort((a, b) => (LEVEL_PRIORITY[a] ?? 99) - (LEVEL_PRIORITY[b] ?? 99))
    return tokens[0]
  }

  return LEVEL_ALIASES[s.toUpperCase()] ?? s
}

// =====================================================================
// FanGraphs — hitters. Every field mapped here matches what
// lib/queries.ts's mapHitterRow() actually reads (row.g, row.pa, etc.) —
// cross-checked directly against that function to make sure nothing here
// is a stub missing real stats again.
// =====================================================================
export const HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'position', candidates: ['Pos', 'Position', 'Position(s)', 'Primary Position', 'Primary Pos'], parse: parseString },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'bats', candidates: ['Bats', 'B'], parse: parseString },
  { target: 'g', candidates: ['G'], parse: parseInteger },
  { target: 'pa', candidates: ['PA'], parse: parseInteger },
  { target: 'ab', candidates: ['AB'], parse: parseInteger },
  { target: 'avg', candidates: ['AVG'], parse: parseNumber },
  { target: 'obp', candidates: ['OBP'], parse: parseNumber },
  { target: 'slg', candidates: ['SLG'], parse: parseNumber },
  { target: 'ops', candidates: ['OPS'], parse: parseNumber },
  { target: 'wrc_plus', candidates: ['wRC+'], parse: parseInteger },
  { target: 'hr', candidates: ['HR'], parse: parseInteger },
  { target: 'sb', candidates: ['SB'], parse: parseInteger },
  // wOBA/xBA/xSLG/xwOBA/Chase%/EV/MaxEV/LA/Barrel%/HardHit%/BatSpeed are
  // all FanGraphs-eligible as a fallback source per the spec (see
  // priorityMerge.ts) — mapped here so a FanGraphs upload can still fill
  // them in if neither ProspectSavant nor TJStats has been uploaded yet.
  { target: 'woba', candidates: ['wOBA'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
  { target: 'chase_pct', candidates: ['Chase%', 'O-Swing%'], parse: parseNumber },
  { target: 'ev_avg', candidates: ['EV', 'Avg EV', 'Exit Velocity'], parse: parseNumber },
  { target: 'ev_max', candidates: ['maxEV', 'Max EV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['LA', 'Avg LA', 'Launch Angle'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['Barrel%', 'Brl%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
  { target: 'bat_speed', candidates: ['Bat Speed', 'Avg Bat Speed'], parse: parseNumber },
  // Batted Ball (FanGraphs-exclusive, no other source provides these)
  { target: 'gb_pct', candidates: ['GB%'], parse: parseNumber },
  { target: 'fb_pct', candidates: ['FB%'], parse: parseNumber },
  { target: 'ld_pct', candidates: ['LD%'], parse: parseNumber },
  { target: 'hr_fb_pct', candidates: ['HR/FB'], parse: parseNumber },
  { target: 'pull_pct', candidates: ['Pull%'], parse: parseNumber },
  { target: 'cent_pct', candidates: ['Cent%'], parse: parseNumber },
  { target: 'oppo_pct', candidates: ['Oppo%'], parse: parseNumber },
  { target: 'hard_pct', candidates: ['Hard%'], parse: parseNumber },
  // Bat Tracking (FanGraphs-exclusive)
  { target: 'swing_length', candidates: ['Swing Length', 'SwingLength'], parse: parseNumber },
  { target: 'squared_up_pct', candidates: ['Squared-Up%', 'Squared Up%'], parse: parseNumber },
  { target: 'blast_pct', candidates: ['Blast%'], parse: parseNumber },
]

// =====================================================================
// FanGraphs — pitchers. Same cross-check against mapPitcherRow().
// =====================================================================
export const PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'position', candidates: ['Pos', 'Role', 'Position', 'Position(s)'], parse: parseString },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'throws', candidates: ['Throws', 'T'], parse: parseString },
  { target: 'g', candidates: ['G'], parse: parseInteger },
  { target: 'gs', candidates: ['GS'], parse: parseInteger },
  { target: 'ip', candidates: ['IP'], parse: parseNumber },
  { target: 'era', candidates: ['ERA'], parse: parseNumber },
  { target: 'fip', candidates: ['FIP'], parse: parseNumber },
  { target: 'siera', candidates: ['SIERA'], parse: parseNumber },
  { target: 'whip', candidates: ['WHIP'], parse: parseNumber },
  { target: 'k_pct', candidates: ['K%'], parse: parseNumber },
  { target: 'bb_pct', candidates: ['BB%'], parse: parseNumber },
  { target: 'kbb_pct', candidates: ['K-BB%', 'K/BB%', 'KBB%'], parse: parseNumber },
  // AVG/SLG/OBP/wOBA-against — FanGraphs primary, feeds the Expected diffs
  { target: 'avg', candidates: ['AVG'], parse: parseNumber },
  { target: 'slg', candidates: ['SLG'], parse: parseNumber },
  { target: 'obp', candidates: ['OBP'], parse: parseNumber },
  { target: 'woba', candidates: ['wOBA'], parse: parseNumber },
  // Expected/plate discipline stats FanGraphs is an eligible fallback for
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
  { target: 'chase_pct', candidates: ['Chase%', 'O-Swing%'], parse: parseNumber },
  { target: 'whiff_pct', candidates: ['Whiff%'], parse: parseNumber },
  { target: 'swstr_pct', candidates: ['SwStr%'], parse: parseNumber },
  { target: 'ev_avg', candidates: ['EV', 'Avg EV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['LA', 'Avg LA'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['Barrel%', 'Brl%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
  { target: 'xera', candidates: ['xERA'], parse: parseNumber },
  // Batted Ball (FanGraphs-exclusive)
  { target: 'gb_pct', candidates: ['GB%'], parse: parseNumber },
  { target: 'fb_pct', candidates: ['FB%'], parse: parseNumber },
  { target: 'ld_pct', candidates: ['LD%'], parse: parseNumber },
  { target: 'hr_fb_pct', candidates: ['HR/FB'], parse: parseNumber },
  { target: 'hard_pct', candidates: ['Hard%'], parse: parseNumber },
  // Pitch grades — overall (FanGraphs-exclusive)
  { target: 'stuff_plus', candidates: ['Stuff+'], parse: parseNumber },
  { target: 'location_plus', candidates: ['Location+'], parse: parseNumber },
  { target: 'pitching_plus', candidates: ['Pitching+'], parse: parseNumber },
  // Pitch grades — per pitch type (FanGraphs uses "FA" for four-seam,
  // where TJStats uses "FF" for the same pitch — kept as separate columns
  // from TJStats' tjStuff+ data, which lives in a different table)
  { target: 'stf_plus_fa', candidates: ['Stf+ FA', 'Stuff+ FA'], parse: parseNumber },
  { target: 'stf_plus_si', candidates: ['Stf+ SI', 'Stuff+ SI'], parse: parseNumber },
  { target: 'stf_plus_fs', candidates: ['Stf+ FS', 'Stuff+ FS'], parse: parseNumber },
  { target: 'stf_plus_fc', candidates: ['Stf+ FC', 'Stuff+ FC'], parse: parseNumber },
  { target: 'stf_plus_sl', candidates: ['Stf+ SL', 'Stuff+ SL'], parse: parseNumber },
  { target: 'stf_plus_cu', candidates: ['Stf+ CU', 'Stuff+ CU'], parse: parseNumber },
  { target: 'stf_plus_ch', candidates: ['Stf+ CH', 'Stuff+ CH'], parse: parseNumber },
]

// Narrower field sets for the Tab 4 comp pool tables — every rate stat
// the similarity score in lib/prospectComps.ts actually uses, not just
// name/level/age.
export const COMP_HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'avg', candidates: ['AVG'], parse: parseNumber },
  { target: 'obp', candidates: ['OBP'], parse: parseNumber },
  { target: 'slg', candidates: ['SLG'], parse: parseNumber },
  { target: 'ops', candidates: ['OPS'], parse: parseNumber },
  { target: 'wrc_plus', candidates: ['wRC+'], parse: parseInteger },
  { target: 'bb_pct', candidates: ['BB%'], parse: parseNumber },
  { target: 'k_pct', candidates: ['K%'], parse: parseNumber },
]

export const COMP_PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'era', candidates: ['ERA'], parse: parseNumber },
  { target: 'fip', candidates: ['FIP'], parse: parseNumber },
  { target: 'siera', candidates: ['SIERA'], parse: parseNumber },
  { target: 'whip', candidates: ['WHIP'], parse: parseNumber },
  { target: 'k_pct', candidates: ['K%'], parse: parseNumber },
  { target: 'bb_pct', candidates: ['BB%'], parse: parseNumber },
  { target: 'kbb_pct', candidates: ['K-BB%', 'K/BB%', 'KBB%'], parse: parseNumber },
]

/**
 * Builds a clean row containing ONLY the target schema columns, pulling
 * each value from whichever of its candidate header names is present in
 * the source row (case-insensitive). Anything in the source row that
 * isn't mapped to a target column is simply left out — this is what
 * prevents "could not find column X" errors from a source's extra columns.
 */
export function mapRow(row: Record<string, any>, columns: ColumnSpec[]): Record<string, any> {
  const mapped: Record<string, any> = {}
  const sourceKeys = Object.keys(row)
  for (const col of columns) {
    const matchKey = sourceKeys.find((k) =>
      col.candidates.some((c) => c.trim().toLowerCase() === k.trim().toLowerCase()),
    )
    if (matchKey !== undefined) {
      mapped[col.target] = col.parse ? col.parse(row[matchKey]) : row[matchKey]
    }
  }
  return mapped
}

// =====================================================================
// ProspectSavant — best-effort guesses (no real sample file confirmed yet)
// =====================================================================

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

// =====================================================================
// TJStats — confirmed against real exports (see the conversation these
// were fixed in). Hitter file uses player_name/player_team; pitcher files
// use pitcher_name/pitcher_team — genuinely different convention between
// the two, both handled here.
// =====================================================================

export const TJSTATS_HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['player_name', 'Name', 'Player', 'Batter'], parse: parseString },
  { target: 'team', candidates: ['player_team', 'Team'], parse: parseString },
  { target: 'level', candidates: ['level', 'Level'], parse: parseLevel },
  { target: 'age', candidates: ['age', 'Age'], parse: parseInteger },
  { target: 'avg', candidates: ['avg', 'AVG'], parse: parseNumber },
  { target: 'obp', candidates: ['obp', 'OBP'], parse: parseNumber },
  { target: 'slg', candidates: ['slg', 'SLG'], parse: parseNumber },
  { target: 'woba', candidates: ['woba_percent', 'woba', 'wOBA'], parse: parseNumber }, // NOT a percent despite the "_percent" name
  { target: 'xwoba', candidates: ['xwoba_percent', 'xwoba', 'xwOBA'], parse: parseNumber }, // same as above
  { target: 'bb_pct', candidates: ['bb_percent', 'BB%'], parse: parsePercentFraction },
  { target: 'k_pct', candidates: ['k_percent', 'K%'], parse: parsePercentFraction },
  // Unconfirmed guesses — likely on tabs 1/2/3, using the confirmed convention
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
  // OVERALL TJStuff+ grade (kept separate from FanGraphs' Stuff+ per the
  // spec). Per-pitch-type stuff_XX columns from that same file are NOT
  // mapped here — the pitch-characteristics file/table covers per-pitch
  // tjStuff+ with far more detail (velo/spin/movement alongside it).
  { target: 'tjstuff_plus_overall', candidates: ['stuff_overall'], parse: parseNumber },
  { target: 'xslg', candidates: ['xslg', 'xSLG'], parse: parseNumber },
]

// =====================================================================
// Pitch Characteristics — TJStats only, no priority cascade. One row per
// (pitcher, pitch type), feeding the separate pitcher_pitch_characteristics
// table rather than pitcher_stats — a pitcher throwing 4 of 7 possible
// pitch types shouldn't mean ~40 mostly-empty columns on the main table.
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
