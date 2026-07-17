// Pulls new articles from both outlets into `writer_articles`, once a day
// at 8am America/New_York (same DST-safe pattern as fetch-standings.mjs).
//
// Both sources are read via RSS/XML, not scraped HTML — much more
// reliable than the MiLB standings pages, since RSS feeds are static XML
// with no JavaScript rendering involved:
//   - Just Baseball: standard WordPress author feed
//   - Braves Today: Substack publication feed, filtered down to just this
//     author's posts (the publication has multiple contributors)
//
// IMPORTANT — like the standings script, this is best-effort and untested
// against the live feeds (no network access to either site while writing
// this). The exact feed URL and the author-name match on the Substack
// side are the two things most likely to need adjusting after a real run
// — check the Actions log and send it over if either source comes back
// with 0 articles.

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

const JUST_BASEBALL_FEED = 'https://www.justbaseball.com/author/taylorgreenhut/feed/'
const BRAVES_TODAY_FEED = 'https://bravestoday.substack.com/feed'
const AUTHOR_NAME_MATCH = /\btaylor\b|greenhut|tgod176/i // byline reads just "Taylor" (confirmed from a real published post), keeping the others as fallback in case the feed formats it differently

async function main() {
  const [justBaseballArticles, bravesTodayArticles] = await Promise.all([
    fetchJustBaseball(),
    fetchBravesToday(),
  ])

  const all = [...justBaseballArticles, ...bravesTodayArticles]
  console.log(`Found ${justBaseballArticles.length} Just Baseball + ${bravesTodayArticles.length} Braves Today = ${all.length} total`)

  for (const article of all) {
    await upsertArticle(article)
  }

  console.log(`Upserted ${all.length} articles.`)
}

async function fetchJustBaseball() {
  const res = await fetch(JUST_BASEBALL_FEED)
  if (!res.ok) {
    console.warn(`Just Baseball feed request failed: ${res.status}`)
    return []
  }
  const xml = await res.text()
  return parseRssItems(xml).map((item) => ({
    title: item.title,
    url: item.link,
    company: 'Just Baseball',
    category: item.category ?? null,
    content_type: 'Article',
    published_date: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null,
    source: 'scraped',
  }))
}

async function fetchBravesToday() {
  const res = await fetch(BRAVES_TODAY_FEED)
  if (!res.ok) {
    console.warn(`Braves Today feed request failed: ${res.status}`)
    return []
  }
  const xml = await res.text()
  return parseRssItems(xml)
    .filter((item) => (item.creator ? AUTHOR_NAME_MATCH.test(item.creator) : false))
    .map((item) => ({
      title: item.title,
      url: item.link,
      company: 'Braves Today',
      category: item.category ?? null,
      content_type: 'Article',
      published_date: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : null,
      source: 'scraped',
    }))
}

/**
 * Minimal RSS 2.0 <item> parser using regex rather than a full XML
 * library — RSS is simple/regular enough that this is reliable, and it
 * avoids adding a dependency just for this. Handles CDATA-wrapped fields,
 * which both WordPress and Substack use for title/creator.
 */
function parseRssItems(xml) {
  const items = []
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  for (const block of itemBlocks) {
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      pubDate: extractTag(block, 'pubDate'),
      category: extractTag(block, 'category'),
      creator: extractTag(block, 'dc:creator'),
    })
  }
  return items.filter((i) => i.title && i.link)
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  if (!match) return null
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .trim()
}

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
