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
  { target: 'name', candidates: ['Name', 'Player', 'Batter'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'z_contact_pct', candidates: ['Z-Contact%', 'ZContact%'], parse: parseNumber },
  { target: 'chase_pct', candidates: ['Chase%', 'O-Swing%'], parse: parseNumber },
  { target: 'ev_avg', candidates: ['EV', 'Exit Velo'], parse: parseNumber },
  { target: 'ev_max', candidates: ['Max EV'], parse: parseNumber },
  { target: 'la_avg', candidates: ['LA', 'Launch Angle'], parse: parseNumber },
  { target: 'barrel_pct', candidates: ['Barrel%'], parse: parseNumber },
  { target: 'hardhit_pct', candidates: ['HardHit%'], parse: parseNumber },
  { target: 'bat_speed', candidates: ['Bat Speed'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
]

export const TJSTATS_PITCHER_COLUMNS: ColumnSpec[] = [
  { target: 'name', candidates: ['Name', 'Player', 'Pitcher'], parse: parseString },
  { target: 'team', candidates: ['Team'], parse: parseString },
  { target: 'level', candidates: ['Level'], parse: parseLevel },
  { target: 'age', candidates: ['Age'], parse: parseInteger },
  { target: 'z_contact_pct', candidates: ['Z-Contact%', 'ZContact%'], parse: parseNumber },
  { target: 'fb_velo', candidates: ['FB Velo', 'Velo', 'FF Velo'], parse: parseNumber },
  { target: 'sweet_spot_pct', candidates: ['SwSP%', 'Sweet Spot%'], parse: parseNumber },
  { target: 'xba', candidates: ['xBA'], parse: parseNumber },
  { target: 'xslg', candidates: ['xSLG'], parse: parseNumber },
  { target: 'xwoba', candidates: ['xwOBA'], parse: parseNumber },
]
