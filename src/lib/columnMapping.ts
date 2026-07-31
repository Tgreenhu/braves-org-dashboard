// =====================================================================
// ADD THIS TO THE END OF YOUR EXISTING columnMapping.ts — this is an
// ADDITION, not a replacement for the whole file. Everything above
// (HITTER_COLUMNS, PITCHER_COLUMNS, mapRow, parseLevel, etc.) stays
// exactly as it already is.
//
// IMPORTANT: these are BEST-EFFORT GUESSES at ProspectSavant's and
// TJStats' actual export column headers — I don't have real sample files
// from either site yet. Same pattern as every other source in this app:
// once you upload a real file and it can't find a column, tell me the
// actual header text and I'll add it to the right candidates array below.
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
