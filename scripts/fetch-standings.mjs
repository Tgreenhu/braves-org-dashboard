// Pulls a fresh record for all 7 Braves affiliate levels into
// `team_level_records`, once a day at 8am America/New_York (DST-safe, see
// the two-cron-trigger + self-check pattern below).
//
//   MLB   — MLB's free public Stats API (statsapi.mlb.com). Plain JSON,
//           no browser needed, very reliable.
//   MiLB  — AAA/AA/A+/A/FCL/DSL standings pages on mlb.com/milb.com are
//           React apps that render their tables client-side, so a plain
//           fetch() only gets an empty shell. This uses Playwright
//           (a real headless browser) to load each page and read the
//           rendered table, same as a person would see it.
//
// IMPORTANT — this MiLB half is best-effort and UNTESTED against the live
// site (I don't have network access to milb.com to verify selectors while
// writing this). It's written defensively — it reads the table's own
// header row to figure out which column is which, rather than assuming
// fixed positions, so small layout differences between leagues shouldn't
// break it. But the very first scheduled run is the real test. Check the
// Actions log after it runs; if a level comes back empty or wrong, send me
// that log and I'll adjust the selectors.

import { chromium } from 'playwright'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

// Only actually run at 8am America/New_York, regardless of which UTC cron
// trigger fired — makes this correct through Daylight Saving with no
// manual adjustment (see the two cron entries in the workflow file).
const nyHour = Number(
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(
    new Date(),
  ),
)
if (nyHour !== 8 && process.env.FORCE_RUN !== 'true') {
  console.log(`Skipping — it's ${nyHour}:00 in New York, not 8am. (Expected for one of the two daily triggers.)`)
  process.exit(0)
}

const season = new Date().getFullYear()
const BRAVES_TEAM_ID = 144
const NL_LEAGUE_ID = 104

const MILB_TARGETS = [
  { level: 'AAA', url: 'https://www.milb.com/milb/standings/overall-standings', needle: 'Gwinnett', teamName: 'Gwinnett Stripers' },
  { level: 'AA', url: 'https://www.milb.com/milb/standings/southern-league/overall-standings', needle: 'Columbus', teamName: 'Columbus Clingstones' },
  { level: 'A+', url: 'https://www.milb.com/milb/standings/south-atlantic-league/overall-standings', needle: 'Rome', teamName: 'Rome Emperors' },
  { level: 'A', url: 'https://www.milb.com/milb/standings/carolina-league/overall-standings', needle: 'Augusta', teamName: 'Augusta GreenJackets' },
  { level: 'FCL', url: 'https://www.milb.com/milb/standings/florida-complex-league', needle: 'FCL Braves', teamName: 'FCL Braves' },
  { level: 'DSL', url: 'https://www.mlb.com/milb/standings/dominican-summer-league', needle: 'DSL Braves', teamName: 'DSL Braves' },
]

async function main() {
  const rows = []

  rows.push(await fetchMlbRow())

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    for (const target of MILB_TARGETS) {
      try {
        const row = await scrapeMilbRow(page, target)
        if (row) {
          rows.push(row)
          console.log(`${target.level}: ${row.wins}-${row.losses}`)
        } else {
          console.warn(`${target.level}: could not find "${target.needle}" in the standings table — skipping this level.`)
        }
      } catch (err) {
        console.warn(`${target.level}: failed —`, err.message)
      }
    }
  } finally {
    await browser.close()
  }

  for (const row of rows) {
    await upsertTeamRecord(row)
  }

  console.log(`Updated ${rows.length}/7 levels.`)
}

// ---------------------------------------------------------------------
// MLB — public Stats API (reliable, no browser)
// ---------------------------------------------------------------------
async function fetchMlbRow() {
  const standingsUrl = `https://statsapi.mlb.com/api/v1/standings?leagueId=${NL_LEAGUE_ID}&season=${season}&standingsTypes=regularSeason`
  const res = await fetch(standingsUrl)
  if (!res.ok) throw new Error(`MLB Stats API standings request failed: ${res.status}`)
  const data = await res.json()

  const bravesRecord = data.records.flatMap((division) => division.teamRecords).find((tr) => tr.team.id === BRAVES_TEAM_ID)
  if (!bravesRecord) throw new Error('Could not find the Braves in the MLB standings response.')

  const home = bravesRecord.records.splitRecords.find((r) => r.type === 'home')
  const away = bravesRecord.records.splitRecords.find((r) => r.type === 'away')
  const lastTen = bravesRecord.records.splitRecords.find((r) => r.type === 'lastTen')
  const { last5, last15 } = await computeRecentSplits(BRAVES_TEAM_ID)

  return {
    level: 'MLB',
    team_name: `Atlanta ${bravesRecord.team.name}`,
    wins: bravesRecord.wins,
    losses: bravesRecord.losses,
    home_wins: home?.wins ?? null,
    home_losses: home?.losses ?? null,
    away_wins: away?.wins ?? null,
    away_losses: away?.losses ?? null,
    last_5: last5,
    last_10: lastTen ? `${lastTen.wins}-${lastTen.losses}` : null,
    last_15: last15,
    streak: bravesRecord.streak?.streakCode ?? null,
    runs_scored: bravesRecord.runsScored,
    runs_allowed: bravesRecord.runsAllowed,
    games_back: bravesRecord.gamesBack ?? null,
    updated_at: new Date().toISOString(),
  }
}

async function computeRecentSplits(teamId) {
  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&hydrate=linescore`
  const res = await fetch(url)
  if (!res.ok) return { last5: null, last15: null }
  const data = await res.json()

  const decidedGames = data.dates
    .flatMap((d) => d.games)
    .filter((g) => g.status?.abstractGameState === 'Final')
    .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))
    .map((g) => {
      const isHome = g.teams.home.team.id === teamId
      const teamSide = isHome ? g.teams.home : g.teams.away
      const oppSide = isHome ? g.teams.away : g.teams.home
      return (teamSide.score ?? 0) > (oppSide.score ?? 0) ? 'W' : 'L'
    })

  const tally = (games) => `${games.filter((g) => g === 'W').length}-${games.filter((g) => g === 'L').length}`
  return {
    last5: decidedGames.length >= 5 ? tally(decidedGames.slice(0, 5)) : null,
    last15: decidedGames.length >= 15 ? tally(decidedGames.slice(0, 15)) : null,
  }
}

// ---------------------------------------------------------------------
// MiLB — headless-browser scrape, header-aware column mapping
// ---------------------------------------------------------------------

// Maps this script's field names to every header label variant seen
// across the different league pages (International League uses "LgGB"
// where others use "GB", FCL has an extra "E#" column, etc.). Matching is
// done after stripping everything but letters/numbers, so "≥.500" and
// "X-W/L" compare cleanly against plain candidate strings.
const HEADER_MAP = {
  wins: ['W'],
  losses: ['L'],
  gamesBack: ['GB', 'LgGB'],
  l10: ['L10'],
  streak: ['STRK'],
  runsScored: ['RS'],
  runsAllowed: ['RA'],
  diff: ['DIFF'],
  xRecord: ['XWL'],
  home: ['HOME'],
  away: ['AWAY'],
  vs500: ['500'],
  nextGame: ['NextGame'],
}

function normalizeHeader(s) {
  return s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function findColumnIndex(headerCells, candidates) {
  const normalizedHeader = headerCells.map(normalizeHeader)
  for (const candidate of candidates) {
    const idx = normalizedHeader.indexOf(normalizeHeader(candidate))
    if (idx !== -1) return idx
  }
  return -1
}

async function scrapeMilbRow(page, target) {
  await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('table', { timeout: 30000 }).catch(() => {})

  const tables = await page.$$('table')
  for (const table of tables) {
    const { headers, rows } = await table.evaluate((tableEl) => {
      const trs = Array.from(tableEl.querySelectorAll('tr'))
      if (trs.length === 0) return { headers: [], rows: [] }
      const headers = Array.from(trs[0].querySelectorAll('th,td')).map((td) => td.innerText.trim())
      const rows = trs.slice(1).map((tr) =>
        Array.from(tr.querySelectorAll('td,th')).map((td) => ({
          text: td.innerText.trim(),
          href: td.querySelector('a')?.getAttribute('href') || null,
        })),
      )
      return { headers, rows }
    })

    const matchRow = rows.find((r) => r[0]?.text.includes(target.needle))
    if (!matchRow) continue

    const winsIdx = findColumnIndex(headers, HEADER_MAP.wins)
    const lossesIdx = findColumnIndex(headers, HEADER_MAP.losses)
    if (winsIdx === -1 || lossesIdx === -1) continue // not the standings table

    const cellText = (idx) => (idx !== -1 ? matchRow[idx]?.text ?? null : null)
    const cellNum = (idx) => {
      const t = cellText(idx)
      const n = t != null ? Number(t) : NaN
      return Number.isNaN(n) ? null : n
    }

    const homeIdx = findColumnIndex(headers, HEADER_MAP.home)
    const awayIdx = findColumnIndex(headers, HEADER_MAP.away)
    const nextGameIdx = findColumnIndex(headers, HEADER_MAP.nextGame)
    const [homeW, homeL] = (cellText(homeIdx) ?? '-').split('-')
    const [awayW, awayL] = (cellText(awayIdx) ?? '-').split('-')

    return {
      level: target.level,
      team_name: target.teamName,
      wins: cellNum(winsIdx),
      losses: cellNum(lossesIdx),
      home_wins: Number(homeW) || null,
      home_losses: Number(homeL) || null,
      away_wins: Number(awayW) || null,
      away_losses: Number(awayL) || null,
      last_10: cellText(findColumnIndex(headers, HEADER_MAP.l10)),
      streak: cellText(findColumnIndex(headers, HEADER_MAP.streak)),
      runs_scored: cellNum(findColumnIndex(headers, HEADER_MAP.runsScored)),
      runs_allowed: cellNum(findColumnIndex(headers, HEADER_MAP.runsAllowed)),
      games_back: cellText(findColumnIndex(headers, HEADER_MAP.gamesBack)),
      x_record: cellText(findColumnIndex(headers, HEADER_MAP.xRecord)),
      vs500_record: cellText(findColumnIndex(headers, HEADER_MAP.vs500)),
      next_game_opponent: nextGameIdx !== -1 ? matchRow[nextGameIdx]?.text ?? null : null,
      next_game_url: nextGameIdx !== -1 ? matchRow[nextGameIdx]?.href ?? null : null,
      updated_at: new Date().toISOString(),
    }
  }
  return null
}

// ---------------------------------------------------------------------
// Supabase write (service role — bypasses RLS, never use this key client-side)
// ---------------------------------------------------------------------
async function upsertTeamRecord(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_level_records?on_conflict=level`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Failed to upsert ${row.level}:`, res.status, text)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
