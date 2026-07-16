import { useRef, useState, type ReactNode } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadNodeAsImage, slugify } from '@/lib/downloadImage'

interface DownloadableCardProps {
  title: string
  subtitle?: string
  filename?: string
  children: ReactNode
  className?: string
  /** Extra actions rendered next to the download button (filters, toggles, etc.) */
  actions?: ReactNode
}

/**
 * Wraps any table/graphic in a card with a header + "download as image"
 * button. Every stat table and chart in the app should be wrapped in this so
 * everything is shareable to social media per the brief.
 */
export default function DownloadableCard({
  title,
  subtitle,
  filename,
  children,
  className = '',
  actions,
}: DownloadableCardProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!nodeRef.current) return
    setDownloading(true)
    try {
      await downloadNodeAsImage(nodeRef.current, filename || slugify(title))
    } catch (err) {
      console.error('Failed to export image', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-navy-950/5 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-navy-900 sm:text-base">{title}</h3>
          {subtitle && <p className="truncate text-[11px] text-navy-900/50">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-label={`Download ${title} as image`}
            className="pill-button !px-2.5"
            title="Download as image"
          >
            {downloading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </header>
      {/* nodeRef wraps only the exportable content, not the header buttons */}
      <div ref={nodeRef} className="bg-white">
        {children}
      </div>
    </section>
  )
}
