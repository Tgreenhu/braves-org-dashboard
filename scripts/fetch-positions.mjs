// Backfills the `position` column for current-season players who don't
// have one — see the conversation this was built in: standard Fangraphs
// batting leaderboard exports (Standard/Advanced/Batted Ball/Statcast)
// genuinely don't include a position column at all, so this fills the gap
// from two different Fangraphs pages that do carry position:
//
//   MLB:  https://www.fangraphs.com/depthcharts.aspx?position=ALL&teamid=16
//         Each player's position is embedded in their profile link
//         (e.g. ?position=OF, ?position=2B/SS). The "ALL Batters" / "ALL
//         Pitchers" sections give one row per player.
//
//   MiLB: https://www.fangraphs.com/roster-resource/minor-league-power-rankings/braves
//         A paginated table (Player, Age, Pos, Level, ...). "Pos" is a
//         slash-separated list like "CF/RF" or "2B/SS".
//
// Normalization (per the brief):
//   - any single/combo of LF/CF/RF        -> "OF"
//   - multiple infield spots (1B/2B/3B/SS) -> "INF"
//   - a mix of infield AND outfield        -> "UTIL"
//   - a single non-OF spot (C, 1B, 2B, 3B, SS, SP, RP) -> kept as-is
//
// IMPORTANT: this only ever fills in a NULL position — it never overwrites
// one that's already set, whether that came from an earlier automated run
// or from you manually editing it in the Players tab. Manual corrections
// are permanent.
//
// IMPORTANT #2: like the standings scraper, this is best-effort and
// UNTESTED against the live pages — especially the MiLB page's pagination,
// which is a JS data table I couldn't fully verify the controls for ahead
// of time. Check the Actions log after the first run.

import { chromium } from 'playwright'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const nyHour = Number(
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(
    new Date(),
  ),
)
if (nyHour !== 8 && process.env.FORCE_RUN !== 'true') {
  console.log(`Skipping — it's ${nyHour}:00 in New York, not 8am.`)
  process.exit(0)
}

const OF_SET = new Set(['LF', 'CF', 'RF'])
const IF_SET = new Set(['1B', '2B', '3B', 'SS'])

/** Applies the OF/INF/UTIL collapsing rule to a slash-separated (or single) position string. */
function normalizePosition(raw) {
  if (!raw) return null
  const parts = raw
    .split('/')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) {
    return OF_SET.has(parts[0]) ? 'OF' : parts[0]
  }
  const hasOF = parts.some((p) => OF_SET.has(p))
  const hasIF = parts.some((p) => IF_SET.has(p))
  if (hasOF && hasIF) return 'UTIL'
  if (hasOF) return 'OF'
  if (hasIF) return 'INF'
  return parts[0] // fallback: e.g. multiple non-OF/IF codes, just take the first
}

async function main() {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()

    const mlb = await scrapeMlbDepthChart(page)
    console.log(`MLB: found ${mlb.batterPositions.size} batter + ${mlb.pitcherPositions.size} pitcher positions`)

    const milb = await scrapeMilbPowerRankings(page)
    console.log(`MiLB: found ${milb.batterPositions.size} batter + ${milb.pitcherPositions.size} pitcher positions`)

    // Kept separate deliberately — a hitter can never receive a pitcher
    // role or vice versa, even if a name happens to coincide.
    const batterPositions = new Map([...milb.batterPositions, ...mlb.batterPositions])
    const pitcherPositions = new Map([...milb.pitcherPositions, ...mlb.pitcherPositions])

    await backfillTable('hitter_stats', batterPositions)
    await backfillTable('pitcher_stats', pitcherPositions)
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------
// MLB depth chart
// ---------------------------------------------------------------------
async function scrapeMlbDepthChart(page) {
  await page.goto('https://www.fangraphs.com/depthcharts.aspx?position=ALL&teamid=16', {
    waitUntil: 'networkidle',
    timeout: 60000,
  })

  // Kept as two SEPARATE maps on purpose — mixing hitter codes (OF/INF/...)
  // and pitcher roles (SP/RP) into one lookup, then applying it to both
  // tables, previously let a name-match write a pitcher role onto a hitter
  // row (or vice versa). Each map only ever gets applied to its own table.
  const batterPositions = new Map()
  const pitcherPositions = new Map()

  // "ALL Batters" and "ALL Pitchers" sections each list one row per player
  // with their position embedded in the profile link's query string.
  const rows = await page.$$eval('table tr', (trs) =>
    trs.flatMap((tr) => {
      const link = tr.querySelector('a[href*="statss.aspx?playerid"]')
      if (!link) return []
      const name = link.textContent.trim()
      const href = link.getAttribute('href') || ''
      const match = href.match(/position=([^&]+)/)
      const rawPos = match ? decodeURIComponent(match[1]) : null
      return rawPos ? [{ name, rawPos }] : []
    }),
  )

  for (const { name, rawPos } of rows) {
    if (rawPos === 'P') continue // pitcher role (SP/RP) handled separately below, not as a raw "P" position
    if (batterPositions.has(name)) continue // first occurrence wins
    batterPositions.set(name, normalizePosition(rawPos))
  }

  // Pitcher role: compare total IP in the SP section vs the RP section for
  // each pitcher and assign whichever role they threw more innings in.
  const spIp = await scrapeSectionIp(page, 'SP')
  const rpIp = await scrapeSectionIp(page, 'RP')
  const allPitcherNames = new Set([...spIp.keys(), ...rpIp.keys()])
  for (const name of allPitcherNames) {
    const sp = spIp.get(name) ?? 0
    const rp = rpIp.get(name) ?? 0
    pitcherPositions.set(name, sp >= rp ? 'SP' : 'RP')
  }

  return { batterPositions, pitcherPositions }
}

async function scrapeSectionIp(page, sectionId) {
  // Each position section (#SP, #RP) is its own table preceded by a heading
  // link with that id — walk tables and use the nearest preceding heading
  // to figure out which section a table belongs to.
  const result = await page.evaluate((id) => {
    const heading = document.querySelector(`a[href="#${id}"]`)
    if (!heading) return []
    let el = heading.closest('h2, h3, div') || heading
    let table = null
    let node = el.nextElementSibling
    for (let i = 0; i < 5 && node; i++) {
      table = node.querySelector ? node.querySelector('table') : null
      if (table) break
      node = node.nextElementSibling
    }
    if (!table) return []
    const rows = Array.from(table.querySelectorAll('tr'))
    return rows
      .map((tr) => {
        const link = tr.querySelector('a[href*="statss.aspx?playerid"]')
        const cells = Array.from(tr.querySelectorAll('td'))
        if (!link || cells.length === 0) return null
        const ip = parseFloat(cells[1]?.textContent ?? '0') // IP is the column right after Name
        return { name: link.textContent.trim(), ip: Number.isNaN(ip) ? 0 : ip }
      })
      .filter(Boolean)
  }, sectionId)

  const map = new Map()
  for (const { name, ip } of result) {
    map.set(name, (map.get(name) ?? 0) + ip)
  }
  return map
}

// ---------------------------------------------------------------------
// MiLB Roster Resource power rankings (paginated JS table)
// ---------------------------------------------------------------------
async function scrapeMilbPowerRankings(page) {
  await page.goto('https://www.fangraphs.com/roster-resource/minor-league-power-rankings/braves', {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForSelector('table', { timeout: 30000 }).catch(() => {})

  // Try to switch page size to show everything in one go, so we don't have
  // to drive pagination. Falls through harmlessly if the control isn't a
  // plain <select> (in which case we fall back to clicking "next" below).
  try {
    const pageSizeSelect = await page.$('select')
    if (pageSizeSelect) {
      await pageSizeSelect.selectOption({ label: 'Infinity' })
      await page.waitForTimeout(1500)
    }
  } catch {
    // ignore — fall back to pagination below
  }

  const batterPositions = new Map()
  const pitcherPositions = new Map()
  let pageNum = 1
  const maxPages = 10 // safety cap

  while (pageNum <= maxPages) {
    const rows = await page.$$eval('table tr', (trs) =>
      trs
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td'))
          if (cells.length < 6) return null
          const link = tr.querySelector('a[href*="/players/"]')
          if (!link) return null
          const name = link.textContent.trim()
          // Columns observed: Rank, Player, Team, Age, Pos, Level, ...
          const rawPos = cells[4]?.textContent?.trim()
          return rawPos ? { name, rawPos } : null
        })
        .filter(Boolean),
    )

    for (const { name, rawPos } of rows) {
      const isPitcherRole = rawPos.split('/')[0].trim().toUpperCase() === 'SP' || rawPos.split('/')[0].trim().toUpperCase() === 'RP'
      const targetMap = isPitcherRole ? pitcherPositions : batterPositions
      if (targetMap.has(name)) continue // "only use the first one listed" — first occurrence wins, skip dupes/other pages
      targetMap.set(name, isPitcherRole ? rawPos.split('/')[0].trim().toUpperCase() : normalizePosition(rawPos))
    }

    // If we successfully got everything via "Infinity" page size, or this
    // is a small roster, one pass may already have it all — check for a
    // "next page" control before trying to advance.
    const nextButton = await page.$('[aria-label="Next Page"], button:has-text("›"), a:has-text("Next")')
    if (!nextButton) break
    const isDisabled = await nextButton.evaluate((el) => el.disabled || el.getAttribute('aria-disabled') === 'true')
    if (isDisabled) break

    await nextButton.click()
    await page.waitForTimeout(1200)
    pageNum++
  }

  return { batterPositions, pitcherPositions }
}

// ---------------------------------------------------------------------
// Supabase write — only fills NULL positions, never overwrites
// ---------------------------------------------------------------------
const VALID_HITTER_CODES = new Set(['C', '1B', '2B', '3B', 'SS', 'INF', 'LF', 'CF', 'RF', 'OF', 'UTIL', 'DH'])
const VALID_PITCHER_CODES = new Set(['SP', 'RP'])

async function backfillTable(table, positionsByName) {
  const { data: rows, error } = await supabaseSelect(table, 'id,name,position,season')
  if (error) {
    console.error(`Failed to read ${table}:`, error)
    return
  }
  const validCodes = table === 'hitter_stats' ? VALID_HITTER_CODES : VALID_PITCHER_CODES

  let updated = 0
  let rejected = 0
  for (const row of rows) {
    if (row.position != null) continue // never touch an already-set position
    const match = positionsByName.get(row.name)
    if (!match) continue
    if (!validCodes.has(match)) {
      // Should be unreachable now that the maps are kept separate — kept as
      // a safety net so a wrong-type code can never land in the database.
      console.warn(`Skipping ${row.name}: "${match}" isn't a valid ${table} position.`)
      rejected++
      continue
    }
    const res = await supabaseUpdate(table, row.id, { position: match })
    if (res.ok) updated++
  }
  console.log(`${table}: filled in ${updated} blank position(s)${rejected ? `, rejected ${rejected} invalid match(es)` : ''}`)
}

async function supabaseSelect(table, columns) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) return { data: [], error: await res.text() }
  return { data: await res.json(), error: null }
}

async function supabaseUpdate(table, id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  return { ok: res.ok }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
