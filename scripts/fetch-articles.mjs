// Pulls new articles from both outlets into `writer_articles`, once a day
// at 8am America/New_York (same DST-safe pattern as the other scripts).
//
// Rebuilt on Playwright (a real headless browser) after the plain-fetch
// version failed for both sources:
//   - Braves Today's RSS feed returned a flat 403 — most likely bot
//     detection rejecting a request with no real browser signature.
//   - Just Baseball's guessed feed URL returned 200 but zero parseable
//     items — almost certainly a soft-404 (a normal page, not a feed)
//     that the site returns with a 200 status instead of an error.
// A real browser sidesteps both: it presents a normal browser fingerprint,
// and this scrapes the actual page content instead of a guessed feed URL.
//
// IMPORTANT — like the other Playwright scripts, this is best-effort and
// untested against the live sites. Check the Actions log after a run.

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

const JUST_BASEBALL_AUTHOR_URL = 'https://www.justbaseball.com/author/taylorgreenhut/'
const BRAVES_TODAY_ARCHIVE_URL = 'https://bravestoday.substack.com/archive'
const AUTHOR_NAME_MATCH = /\btaylor\b|greenhut|tgod176/i // byline on Braves Today reads just "Taylor" — confirmed from a real published post

async function main() {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()

    const justBaseballArticles = await scrapeJustBaseball(page)
    console.log(`Just Baseball: found ${justBaseballArticles.length} articles`)

    const bravesTodayArticles = await scrapeBravesToday(page)
    console.log(`Braves Today: found ${bravesTodayArticles.length} articles by a matching author`)

    const all = [...justBaseballArticles, ...bravesTodayArticles]
    for (const article of all) {
      await upsertArticle(article)
    }
    console.log(`Upserted ${all.length} total.`)
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------
// Just Baseball — paginated author page (not a guessed feed URL)
// ---------------------------------------------------------------------
async function scrapeJustBaseball(page) {
  const articles = []
  let pageNum = 1
  const maxPages = 10 // safety cap

  while (pageNum <= maxPages) {
    const url = pageNum === 1 ? JUST_BASEBALL_AUTHOR_URL : `${JUST_BASEBALL_AUTHOR_URL}page/${pageNum}/`
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null)
    if (!res || !res.ok()) break // ran past the last real page

    const rows = await page.$$eval('a', (links) =>
      links
        .filter((a) => /justbaseball\.com\/(mlb|prospects|international-baseball|fantasy)\//.test(a.href))
        .map((a) => ({ title: a.textContent.trim(), url: a.href }))
        .filter((r) => r.title.length > 10), // skip nav/icon links with no real title text
    )

    const deduped = Array.from(new Map(rows.map((r) => [r.url, r])).values())
    if (deduped.length === 0) break // no more pages

    for (const r of deduped) {
      articles.push({
        title: r.title,
        url: r.url,
        company: 'Just Baseball',
        category: null,
        content_type: 'Article',
        published_date: null, // not reliably available from the listing page without opening each article; add manually if needed
        source: 'scraped',
      })
    }
    pageNum++
  }

  return articles
}

// ---------------------------------------------------------------------
// Braves Today — archive page, filtered to posts with a matching byline.
// Substack's archive view for multi-author publications shows each post's
// byline directly in the listing, so this doesn't need to open every post.
// ---------------------------------------------------------------------
async function scrapeBravesToday(page) {
  const res = await page.goto(BRAVES_TODAY_ARCHIVE_URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null)
  if (!res || !res.ok()) {
    console.warn(`Braves Today archive request failed: ${res ? res.status() : 'no response'}`)
    return []
  }

  // Scroll a handful of times to load more of the archive (it's an
  // infinite-scroll list), then read whatever's rendered.
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000)
    await page.waitForTimeout(800)
  }

  const posts = await page.$$eval('a[href*="/p/"]', (links) =>
    links
      .map((a) => {
        const container = a.closest('article, .post-preview, div')
        return {
          title: a.textContent.trim(),
          url: a.href,
          containerText: container ? container.textContent : '',
        }
      })
      .filter((r) => r.title.length > 10),
  )

  const deduped = Array.from(new Map(posts.map((r) => [r.url, r])).values())

  return deduped
    .filter((r) => AUTHOR_NAME_MATCH.test(r.containerText))
    .map((r) => ({
      title: r.title,
      url: r.url,
      company: 'Braves Today',
      category: null,
      content_type: 'Article',
      published_date: null,
      source: 'scraped',
    }))
}

// ---------------------------------------------------------------------
// Supabase write
// ---------------------------------------------------------------------
async function upsertArticle(article) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/writer_articles?on_conflict=url`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(article),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Failed to upsert "${article.title}":`, res.status, text)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
