// eBay item URLs embed the listing title as a readable slug and the item
// ID as a trailing number, e.g.:
//   https://www.ebay.com/itm/2023-Topps-Chrome-Ronald-Acuna-Jr-Refractor-PSA-10/123456789012
// This gets a usable draft title + item ID purely by parsing the URL
// string client-side — no network request involved, which is the whole
// point: a browser can't read another site's page directly (CORS), so
// this is the honest, real "auto-fill assist" that's actually possible
// without a scraper or an official API integration.
//
// Deliberately named "parse", not "fetch" or "lookup" — it never talks to
// eBay at all, so it can't tell you the actual price, condition, or
// whether the listing is even still live. It's a starting point for the
// title field, nothing more.

export interface ParsedEbayLink {
  itemId: string | null
  draftTitle: string | null
  isValidEbayUrl: boolean
}

export function parseEbayLink(url: string): ParsedEbayLink {
  const trimmed = url.trim()
  if (!trimmed) return { itemId: null, draftTitle: null, isValidEbayUrl: false }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { itemId: null, draftTitle: null, isValidEbayUrl: false }
  }

  const isEbay = /(^|\.)ebay\.[a-z.]+$/i.test(parsed.hostname)
  if (!isEbay) return { itemId: null, draftTitle: null, isValidEbayUrl: false }

  // Matches /itm/<slug>/<itemId> or /itm/<itemId> (no slug)
  const match = parsed.pathname.match(/\/itm\/(?:([^/]+)\/)?(\d+)/)
  if (!match) return { itemId: null, draftTitle: null, isValidEbayUrl: true }

  const [, slug, itemId] = match
  const draftTitle = slug
    ? slug
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  return { itemId, draftTitle, isValidEbayUrl: true }
}
