// Pulls new articles from both outlets into `writer_articles`, once a day
// (both scheduled triggers actually run now — see the note in
// fetch-standings.mjs about why the old "only at exactly 8am" check was
// removed; upserts are idempotent so running more than once is harmless).
//
// Rebuilt on Playwright (a real headless browser) after a plain-fetch/RSS
// version failed for both sources — Braves Today's RSS feed returned a
// flat 403 (bot detection), and Just Baseball's guessed feed URL returned
// 200 but zero parseable items (almost certainly a soft-404 page, not a
// real feed). A real browser sidesteps both: normal browser fingerprint,
// and this scrapes actual page content instead of a guessed feed URL.
//
// IMPORTANT: neither listing page reliably shows a publish date without
// opening each article individually, so scraped rows deliberately don't
// include a `published_date` key at all (not `null`) — Supabase's upsert
// only overwrites columns that are actually present in the row object, so
// omitting the key here means a real date already sitting in the
// database (e.g. from the original manual seed) never gets clobbered by
// a later automated re-scrape of the same URL. Setting it to `null`
// explicitly here was the bug that wiped out the seeded Just Baseball
// dates — don't reintroduce that.

import { chromium } from 'playwright'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
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
// Just Baseball — paginated author page
// ---------------------------------------------------------------------
async function scrapeJustBaseball(page) {
  const articles = []
  let pageNum = 1
  const maxPages = 10 // safety cap

  while (pageNum <= maxPages) {
    const url = pageNum === 1 ? JUST_BASEBALL_AUTHOR_URL : `${JUST_BASEBALL_AUTHOR_URL}page/${pageNum}/`
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null)
    if (!res || !res.ok()) break // ran past the last real page

    await page.waitForTimeout(1000)

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
        // no published_date key — see the note at the top of this file
        source: 'scraped',
      })
    }
    pageNum++
  }

  return articles
}

// ---------------------------------------------------------------------
// Braves Today — archive page, filtered to posts with a matching byline
// ---------------------------------------------------------------------
async function scrapeBravesToday(page) {
  const res = await page.goto(BRAVES_TODAY_ARCHIVE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => null)
  if (!res || !res.ok()) {
    console.warn(`Braves Today archive request failed: ${res ? res.status() : 'no response'}`)
    return []
  }

  await page.waitForTimeout(1500)
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
      // no published_date key — see the note at the top of this file
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
