// Maps Fangraphs' raw CSV column headers to our Supabase schema column
// names, and drops anything we don't recognize (Fangraphs exports include
// plenty of columns we don't store — 1B, 2B, wSB, etc. — which would
// otherwise make Supabase reject the whole row with a "could not find
// column" error).
//
// TODO(verify): these candidate header names are Fangraphs' standard
// column labels, but if your actual export uses different wording for
// something, add it to that field's candidates array below. Easiest way to
// check: open one of your CSVs and look at the first row.

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

// Some "whole number" stats (wRC+ especially) come through some Fangraphs
// reports — the "Advanced" one in particular — as a long precise decimal
// (e.g. 80.37196200961044) rather than the rounded value the website
// displays. Our schema columns for these are plain integers, so round
// instead of erroring. Postgres would otherwise reject the whole row with
// "invalid input syntax for type integer".
function parseInteger(raw: any): number | null {
  const n = parseNumber(raw)
  return n === null ? null : Math.round(n)
}

function parseString(raw: any): string | null {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  return s === '' ? null : s
}

// Fangraphs' level labels don't match our display labels 1:1 (e.g. "A+"
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
  DSL: 'DSL',
}

function parseLevel(raw: any): string | null {
  const s = parseString(raw)
  if (!s) return null
  return LEVEL_ALIASES[s.toUpperCase()] ?? s
}

export const HITTER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'position', candidates: ['Pos', 'Position'], parse: parseString },
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
  { target: 'bb_pct', candidates: ['BB%'], parse: parseNumber },
  { target: 'k_pct', candidates: ['K%'], parse: parseNumber },
  { target: 'hr', candidates: ['HR'], parse: parseInteger },
  { target: 'sb', candidates: ['SB'], parse: parseInteger },
  // Batted Ball
  { target: 'gb_pct', candidates: ['GB%'], parse: parseNumber },
  { target: 'fb_pct', candidates: ['FB%'], parse: parseNumber },
  { target: 'ld_pct', candidates: ['LD%'], parse: parseNumber },
  { target: 'hr_fb_pct', candidates: ['HR/FB'], parse: parseNumber },
  { target: 'pull_pct', candidates: ['Pull%'], parse: parseNumber },
  { target: 'cent_pct', candidates: ['Cent%'], parse: parseNumber },
  { target: 'oppo_pct', candidates: ['Oppo%'], parse: parseNumber },
  { target: 'hard_pct', candidates: ['Hard%'], parse: parseNumber },
  // Statcast
  { target: 'ev_avg', candidates: ['EV', 'Avg EV', 'Exit Velocity'], parse: parseNumber },
  { target: 'ev_max', candidates: ['maxEV', 'Max EV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['LA', 'Avg LA', 'Launch Angle'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['Barrel%', 'Brl%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
  // Bat Tracking
  { target: 'bat_speed', candidates: ['Bat Speed', 'Avg Bat Speed'], parse: parseNumber },
  { target: 'swing_length', candidates: ['Swing Length', 'SwingLength'], parse: parseNumber },
  { target: 'squared_up_pct', candidates: ['Squared-Up%', 'Squared Up%'], parse: parseNumber },
  { target: 'blast_pct', candidates: ['Blast%'], parse: parseNumber },
]

export const PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level', 'Lev'], parse: parseLevel },
  { target: 'position', candidates: ['Pos', 'Role'], parse: parseString },
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
  // Batted Ball
  { target: 'gb_pct', candidates: ['GB%'], parse: parseNumber },
  { target: 'fb_pct', candidates: ['FB%'], parse: parseNumber },
  { target: 'ld_pct', candidates: ['LD%'], parse: parseNumber },
  { target: 'hr_fb_pct', candidates: ['HR/FB'], parse: parseNumber },
  { target: 'hard_pct', candidates: ['Hard%'], parse: parseNumber },
  // Statcast
  { target: 'barrel_pct', candidates: ['Barrel%', 'Brl%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
  { target: 'xera', candidates: ['xERA'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'whiff_pct', candidates: ['Whiff%'], parse: parseNumber },
  { target: 'chase_pct', candidates: ['Chase%', 'O-Swing%'], parse: parseNumber },
  // Pitch grades
  { target: 'stuff_plus', candidates: ['Stuff+'], parse: parseNumber },
  { target: 'location_plus', candidates: ['Location+'], parse: parseNumber },
  { target: 'pitching_plus', candidates: ['Pitching+'], parse: parseNumber },
]

// Narrower field sets for the Tab 4 comp pool tables — no team/counting
// stats, just the rate stats the similarity score actually uses.
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
 * prevents "could not find column X" errors from Fangraphs' extra columns.
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
