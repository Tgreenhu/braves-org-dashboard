import { toPng } from 'html-to-image'

/**
 * Renders a DOM node to a PNG and triggers a browser download. Used by every
 * table/card/chart via <DownloadableCard> so the whole dashboard is
 * shareable to social media, per the brief.
 */
export async function downloadNodeAsImage(node: HTMLElement, filename: string) {
  // pixelRatio 2 for crisp exports on retina / social platforms
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
  })
  const link = document.createElement('a')
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`
  link.href = dataUrl
  link.click()
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
