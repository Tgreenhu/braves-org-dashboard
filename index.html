import { useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Archive,
  Loader2,
  FileText,
  Users,
} from 'lucide-react'
import { supabase, supabaseConfigured } from '@/lib/supabaseClient'
import { cacheClear } from '@/lib/cache'
import { tagTotalRows, tagTotalRowsBySeason } from '@/lib/detectTotals'
import { detectPlayerType, findColumnKey, extractYearFromFilename } from '@/lib/csvUpload'
import { mapRow, HITTER_COLUMNS, PITCHER_COLUMNS, COMP_HITTER_COLUMNS, COMP_PITCHER_COLUMNS } from '@/lib/columnMapping'
import { slugify } from '@/lib/downloadImage'

interface UploadSource {
  id: string
  label: string
  fangraphsUrl: string
  supabaseTable: string
  detectTotals?: boolean
  totalsStatKeys?: string[]
  /** Fangraphs' single-team MLB leaderboards don't include a Level column
   * at all (every row is obviously MLB) — fill it in ourselves rather than
   * leaving it null, since the app relies on Level for filtering elsewhere. */
  defaultLevel?: string
}

interface UploadGroup {
  id: string
  title: string
  description: string
  sources: UploadSource[]
}

const HITTER_TOTALS_STAT_KEYS = ['PA', 'pa']
const PITCHER_TOTALS_STAT_KEYS = ['IP', 'ip']
const SEASON_COLUMN_CANDIDATES = ['Season', 'season', 'Year', 'year']

const UPLOAD_GROUPS: UploadGroup[] = [
  {
    id: 'milb-hitters',
    title: 'MiLB Hitters',
    description: 'Braves system minor league hitting leaderboards. Players who moved between levels this season get one row per level plus a combined total row, detected automatically.',
    sources: [
      { id: 'milb-hit-standard', label: 'Standard', supabaseTable: 'hitter_stats', detectTotals: true, totalsStatKeys: HITTER_TOTALS_STAT_KEYS, fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
      { id: 'milb-hit-advanced', label: 'Advanced', supabaseTable: 'hitter_stats', detectTotals: true, totalsStatKeys: HITTER_TOTALS_STAT_KEYS, fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=1&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
      { id: 'milb-hit-batted', label: 'Batted', supabaseTable: 'hitter_stats', detectTotals: true, totalsStatKeys: HITTER_TOTALS_STAT_KEYS, fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=bat&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&type=2&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
    ],
  },
  {
    id: 'milb-pitchers',
    title: 'MiLB Pitchers',
    description: 'Braves system minor league pitching leaderboards. Players who moved between levels this season get one row per level plus a combined total row, detected automatically.',
    sources: [
      { id: 'milb-pit-standard', label: 'Standard', supabaseTable: 'pitcher_stats', detectTotals: true, totalsStatKeys: PITCHER_TOTALS_STAT_KEYS, fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=' },
      { id: 'milb-pit-advanced', label: 'Advanced', supabaseTable: 'pitcher_stats', detectTotals: true, totalsStatKeys: PITCHER_TOTALS_STAT_KEYS, fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=&type=1' },
      { id: 'milb-pit-batted', label: 'Batted', supabaseTable: 'pitcher_stats', detectTotals: true, totalsStatKeys: PITCHER_TOTALS_STAT_KEYS, fangraphsUrl: 'https://www.fangraphs.com/leaders/minor-league?pos=all&stats=pit&lg=2%2C4%2C5%2C6%2C7%2C8%2C9%2C10%2C11%2C14%2C12%2C13%2C15%2C16%2C17%2C18%2C30%2C32&qual=0&season=2026&level=0&team=&seasonEnd=2026&org=16&ind=0&splitTeam=false&startdate=&enddate=&type=2' },
    ],
  },
  {
    id: 'mlb-hitters',
    title: 'MLB Hitters',
    description: 'Atlanta Braves major league hitting leaderboards',
    sources: [
      { id: 'mlb-hit-standard', label: 'Standard', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=0&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-batted', label: 'Batted Ball', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=2&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-advanced', label: 'Advanced', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=1&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-statcast', label: 'Statcast', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=24&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
      { id: 'mlb-hit-battrack', label: 'Bat Tracking', supabaseTable: 'hitter_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&type=80&season=2026&season1=2026&ind=0&month=0&qual=0&team=16' },
    ],
  },
  {
    id: 'mlb-pitchers',
    title: 'MLB Pitchers',
    description: 'Atlanta Braves major league pitching leaderboards',
    sources: [
      { id: 'mlb-pit-standard', label: 'Standard', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=0&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-advanced', label: 'Advanced', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=1&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-batted', label: 'Batted Ball', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=2&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-statcast', label: 'Statcast', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=24&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-battrack', label: 'Bat Tracking', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=80&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-pitchpct', label: 'Pitch %', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=9&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-velo', label: 'Pitch Velo', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=10&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-hmove', label: 'H Movement', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=11&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-vmove', label: 'V Movement', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=12&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-spin', label: 'Spin', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=82&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-stuffplus', label: 'Stuff+', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=36&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-locationplus', label: 'Location+', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=37&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
      { id: 'mlb-pit-pitchingplus', label: 'Pitching+', supabaseTable: 'pitcher_stats', defaultLevel: 'MLB', fangraphsUrl: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=pit&lg=all&type=38&season=2026&season1=2026&ind=0&qual=0&team=16&startdate=&enddate=&month=0' },
    ],
  },
]

type RowStatus = 'idle' | 'parsing' | 'uploading' | 'success' | 'error'

export default function Upload() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">Upload Center</h2>
        <p className="text-xs text-navy-900/50 sm:text-sm">
          Open the Fangraphs export, download the CSV, then drop it here -- it's parsed and pushed
          straight into Supabase so every other tab updates.
        </p>
        {!supabaseConfigured && (
          <p className="mt-1.5 rounded-lg bg-brave-gold/10 px-2.5 py-1.5 text-[11px] text-brave-gold">
            Supabase isn't connected yet (see <code>.env.example</code>), so uploads will parse and
            preview locally but won't be written to the database until you add your project keys.
          </p>
        )}
      </div>

      <MassUploadSection />

      <CompPoolUploadSection />

      {UPLOAD_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2.5">
          <div>
            <h3 className="text-sm font-semibold text-navy-900 sm:text-base">{group.title}</h3>
            <p className="text-[11px] text-navy-900/45">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.sources.map((source) => (
              <UploadRow key={source.id} source={source} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// =====================================================================
// Mass Upload (Historical Archive) — drop in any number of CSVs at once,
// nothing to configure first. Each file is inspected on its own:
//   - Hitter vs Pitcher: guessed from its columns (IP/ERA = pitcher,
//     PA/AVG/OBP = hitter).
//   - Season: read from a Season/Year column if the file has one
//     (typical for a multi-year export); otherwise pulled from a 4-digit
//     year in the filename (e.g. "2019_hitters.csv").
// Total-row detection runs on the RAW Fangraphs columns (before mapping)
// since it needs the original PA/IP header names; only after that are
// rows run through columnMapping to translate them into our schema's
// column names and drop anything unrecognized (Fangraphs' extra columns
// like 1B, 2B, wSB, etc., which would otherwise make Supabase reject the
// whole row).
//
// Parsing runs on the main thread (no Web Worker) -- PapaParse's worker
// mode looks for its own script at a URL that doesn't exist in a bundled
// Vite build, which silently hangs instead of erroring. Fine here since
// we need the whole file in memory anyway for total detection.
// =====================================================================

const BATCH_SIZE = 500

interface FileUploadState {
  id: string
  fileName: string
  status: RowStatus
  detectedType: 'Hitter' | 'Pitcher' | null
  seasons: number[]
  rowsProcessed: number
  totalRows: number
  error?: string
}

function MassUploadSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileUploadState[]>([])

  const updateFile = (id: string, patch: Partial<FileUploadState>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const processFile = (file: File, id: string) =>
    new Promise<void>((resolve) => {
      updateFile(id, { status: 'parsing' })

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const headers = results.meta.fields ?? []
            const detectedType = detectPlayerType(headers)
            if (!detectedType) {
              updateFile(id, {
                status: 'error',
                error: "Couldn't tell hitter vs pitcher from the columns in this file.",
              })
              return
            }

            let rows = results.data as Record<string, any>[]
            const seasonKey = findColumnKey(headers, SEASON_COLUMN_CANDIDATES)

            if (seasonKey) {
              rows = rows.map((r) => ({ ...r, season: Number(r[seasonKey]) || null }))
            } else {
              const yearFromName = extractYearFromFilename(file.name)
              if (!yearFromName) {
                updateFile(id, {
                  status: 'error',
                  detectedType,
                  error: 'No Season/Year column, and no 4-digit year in the filename. Rename it, e.g. "2019_hitters.csv".',
                })
                return
              }
              rows = rows.map((r) => ({ ...r, season: yearFromName }))
            }

            rows = rows.filter((r) => r.season != null)
            const seasons = Array.from(new Set(rows.map((r) => r.season as number))).sort()

            const statKeys = detectedType === 'Hitter' ? HITTER_TOTALS_STAT_KEYS : PITCHER_TOTALS_STAT_KEYS
            tagTotalRowsBySeason(rows, statKeys, 'season')

            const columnSpec = detectedType === 'Hitter' ? HITTER_COLUMNS : PITCHER_COLUMNS
            const mappedRows: Record<string, any>[] = rows
              .map(
                (r) =>
                  ({ ...mapRow(r, columnSpec), season: r.season, is_total: r.is_total }) as Record<string, any>,
              )
              .filter((r) => r.name)

            const table = detectedType === 'Hitter' ? 'historical_hitter_stats' : 'historical_pitcher_stats'
            updateFile(id, { status: 'uploading', detectedType, seasons, totalRows: mappedRows.length })

            if (supabaseConfigured) {
              for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
                const batch = mappedRows.slice(i, i + BATCH_SIZE)
                const { error: upsertError } = await supabase
                  .from(table)
                  .upsert(batch, { onConflict: 'season,name,team,level' })
                if (upsertError) throw upsertError
                updateFile(id, { rowsProcessed: Math.min(i + BATCH_SIZE, mappedRows.length) })
              }
            } else {
              updateFile(id, { rowsProcessed: mappedRows.length })
            }

            cacheClear()
            updateFile(id, { status: 'success' })
          } catch (e: any) {
            updateFile(id, { status: 'error', error: e.message ?? 'Upload failed' })
          } finally {
            resolve()
          }
        },
        error: (err) => {
          updateFile(id, { status: 'error', error: err.message })
          resolve()
        },
      })
    })

  const handleFiles = async (fileList: FileList) => {
    const incoming = Array.from(fileList).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
    }))
    setFiles((prev) => [
      ...prev,
      ...incoming.map(({ id, file }) => ({
        id,
        fileName: file.name,
        status: 'parsing' as RowStatus,
        detectedType: null,
        seasons: [] as number[],
        rowsProcessed: 0,
        totalRows: 0,
      })),
    ])
    for (const { id, file } of incoming) {
      await processFile(file, id)
    }
  }

  return (
    <div className="card border-l-4 border-navy-600 p-3.5 sm:p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <Archive size={18} className="mt-0.5 shrink-0 text-navy-600" />
        <div>
          <h3 className="text-sm font-semibold text-navy-950 sm:text-base">
            Historical Archive — Mass Upload
          </h3>
          <p className="text-[11px] text-navy-900/50 sm:text-xs">
            Drop in as many CSVs as you want at once. Hitter/pitcher and season are detected
            automatically per file — nothing to select first. Goes into its own tables that
            nothing else in the app touches, so it's a fixed reference point that won't change
            when you refresh the current season below.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-3 text-xs font-medium text-navy-900/60 hover:border-navy-600 hover:text-navy-900"
      >
        <UploadCloud size={16} /> Select CSVs (any number at once)
      </button>

      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {files.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileRow({ file }: { file: FileUploadState }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-navy-950/8 bg-white px-3 py-2 text-xs">
      <FileText size={14} className="shrink-0 text-navy-900/40" />
      <span className="min-w-0 flex-1 truncate font-medium text-navy-950">{file.fileName}</span>

      {file.detectedType && (
        <span className="shrink-0 rounded-full bg-navy-950/5 px-2 py-0.5 text-[10px] font-medium text-navy-900/60">
          {file.detectedType}
          {file.seasons.length > 0 &&
            ` · ${file.seasons.length === 1 ? file.seasons[0] : `${file.seasons[0]}–${file.seasons[file.seasons.length - 1]}`}`}
        </span>
      )}

      <span className="shrink-0">
        {(file.status === 'parsing' || file.status === 'uploading') && (
          <span className="flex items-center gap-1 text-navy-900/50">
            <Loader2 size={12} className="animate-spin" />
            {file.status === 'uploading' && file.totalRows > 0
              ? `${file.rowsProcessed.toLocaleString()}/${file.totalRows.toLocaleString()}`
              : 'Reading...'}
          </span>
        )}
        {file.status === 'success' && (
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle2 size={12} /> {file.rowsProcessed.toLocaleString()} rows
          </span>
        )}
        {file.status === 'error' && (
          <span className="flex items-center gap-1 text-brave-red" title={file.error}>
            <AlertCircle size={12} /> {file.error}
          </span>
        )}
      </span>
    </div>
  )
}

// =====================================================================
// Comp Pool Upload (Tab 4) — the "notable" MiLB player pool used purely
// for similarity comps. Deliberately separate from every other table:
// nothing else in the app reads prospect_comp_pool_hitters/pitchers, so
// this data will never show up in Players, All-Org Team, or anywhere
// else — it exists only to be compared against, never displayed as a
// Braves org player.
//
// Same auto-detection as the Historical Archive (type + season/year per
// file), but maps to a narrower column set (no team, no counting stats —
// just the rate stats the similarity score in lib/prospectComps.ts uses)
// and generates a stable player_id client-side by slugifying
// name+level+years, since Fangraphs exports don't include one. That way
// re-uploading a different report for the same player merges into their
// existing row instead of creating a duplicate.
// =====================================================================

function CompPoolUploadSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileUploadState[]>([])

  const updateFile = (id: string, patch: Partial<FileUploadState>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const processFile = (file: File, id: string) =>
    new Promise<void>((resolve) => {
      updateFile(id, { status: 'parsing' })

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const headers = results.meta.fields ?? []
            const detectedType = detectPlayerType(headers)
            if (!detectedType) {
              updateFile(id, { status: 'error', error: "Couldn't tell hitter vs pitcher from the columns in this file." })
              return
            }

            let rows = results.data as Record<string, any>[]
            const seasonKey = findColumnKey(headers, SEASON_COLUMN_CANDIDATES)

            if (seasonKey) {
              rows = rows.map((r) => ({ ...r, season: Number(r[seasonKey]) || null }))
            } else {
              const yearFromName = extractYearFromFilename(file.name)
              if (!yearFromName) {
                updateFile(id, {
                  status: 'error',
                  detectedType,
                  error: 'No Season/Year column, and no 4-digit year in the filename. Rename it, e.g. "2019_top_hitters.csv".',
                })
                return
              }
              rows = rows.map((r) => ({ ...r, season: yearFromName }))
            }

            rows = rows.filter((r) => r.season != null)
            const seasons = Array.from(new Set(rows.map((r) => r.season as number))).sort()

            const statKeys = detectedType === 'Hitter' ? HITTER_TOTALS_STAT_KEYS : PITCHER_TOTALS_STAT_KEYS
            tagTotalRowsBySeason(rows, statKeys, 'season')

            const columnSpec = detectedType === 'Hitter' ? COMP_HITTER_COLUMNS : COMP_PITCHER_COLUMNS
            const mappedRows: Record<string, any>[] = rows
              .filter((r) => r.is_total !== false) // one row per player per season — skip level splits, keep the combined line
              .map((r) => {
                const mapped = mapRow(r, columnSpec)
                const years = String(r.season)
                return {
                  ...mapped,
                  years,
                  player_id: slugify(`${mapped.name ?? 'unknown'}-${years}`),
                } as Record<string, any>
              })
              .filter((r) => r.name)

            const table = detectedType === 'Hitter' ? 'prospect_comp_pool_hitters' : 'prospect_comp_pool_pitchers'
            updateFile(id, { status: 'uploading', detectedType, seasons, totalRows: mappedRows.length })

            if (supabaseConfigured) {
              for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
                const batch = mappedRows.slice(i, i + BATCH_SIZE)
                const { error: upsertError } = await supabase.from(table).upsert(batch, { onConflict: 'player_id' })
                if (upsertError) throw upsertError
                updateFile(id, { rowsProcessed: Math.min(i + BATCH_SIZE, mappedRows.length) })
              }
            } else {
              updateFile(id, { rowsProcessed: mappedRows.length })
            }

            cacheClear()
            updateFile(id, { status: 'success' })
          } catch (e: any) {
            updateFile(id, { status: 'error', error: e.message ?? 'Upload failed' })
          } finally {
            resolve()
          }
        },
        error: (err) => {
          updateFile(id, { status: 'error', error: err.message })
          resolve()
        },
      })
    })

  const handleFiles = async (fileList: FileList) => {
    const incoming = Array.from(fileList).map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
    }))
    setFiles((prev) => [
      ...prev,
      ...incoming.map(({ id, file }) => ({
        id,
        fileName: file.name,
        status: 'parsing' as RowStatus,
        detectedType: null,
        seasons: [] as number[],
        rowsProcessed: 0,
        totalRows: 0,
      })),
    ])
    for (const { id, file } of incoming) {
      await processFile(file, id)
    }
  }

  return (
    <div className="card border-l-4 border-brave-gold p-3.5 sm:p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <Users size={18} className="mt-0.5 shrink-0 text-brave-gold" />
        <div>
          <h3 className="text-sm font-semibold text-navy-950 sm:text-base">
            Prospect Comp Pool (Tab 4 only)
          </h3>
          <p className="text-[11px] text-navy-900/50 sm:text-xs">
            League-wide "notable" MiLB player exports — not Braves-specific — used only to
            generate similarity comps on the Prospect Comps tab. This never appears in Players,
            All-Org Team, or any org-facing view. Drop in Fangraphs leaderboards with the org
            filter removed, one file per season is fine.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-3 text-xs font-medium text-navy-900/60 hover:border-brave-gold hover:text-navy-900"
      >
        <UploadCloud size={16} /> Select comp pool CSVs (any number at once)
      </button>

      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {files.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function UploadRow({ source }: { source: UploadSource }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<RowStatus>('idle')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File) => {
    setStatus('parsing')
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let rows = results.data as Record<string, any>[]
          if (source.detectTotals && source.totalsStatKeys) {
            rows = tagTotalRows(rows, source.totalsStatKeys)
          }

          const columnSpec = source.supabaseTable === 'hitter_stats' ? HITTER_COLUMNS : PITCHER_COLUMNS
          const mappedRows: Record<string, any>[] = rows
            .map((r) => {
              const mapped = mapRow(r, columnSpec)
              return {
                ...mapped,
                level: mapped.level ?? source.defaultLevel ?? null,
                is_total: (r as any).is_total ?? false,
              } as Record<string, any>
            })
            .filter((r) => r.name)

          setRowCount(mappedRows.length)
          if (supabaseConfigured) {
            const { error: upsertError } = await supabase
              .from(source.supabaseTable)
              .upsert(mappedRows, { onConflict: 'name,team,level' })
            if (upsertError) throw upsertError
          }
          cacheClear() // invalidate cached reads so other tabs re-fetch fresh data
          setStatus('success')
        } catch (e: any) {
          setError(e.message ?? 'Upload failed')
          setStatus('error')
        }
      },
      error: (err) => {
        setError(err.message)
        setStatus('error')
      },
    })
  }

  return (
    <div className="card flex flex-col gap-2.5 p-3.5">
      <h4 className="text-sm font-semibold text-navy-950">{source.label}</h4>

      <a href={source.fangraphsUrl} target="_blank" rel="noreferrer" className="pill-button justify-center">
        Open Fangraphs table <ExternalLink size={12} />
      </a>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-950/15 py-2.5 text-xs font-medium text-navy-900/60 hover:border-navy-600 hover:text-navy-900"
      >
        <UploadCloud size={14} /> Upload CSV
      </button>

      {status === 'parsing' && <p className="text-[11px] text-navy-900/50">Parsing...</p>}
      {status === 'success' && (
        <p className="flex items-center gap-1 text-[11px] text-emerald-600">
          <CheckCircle2 size={12} /> Loaded {rowCount} rows
          {!supabaseConfigured && ' (local preview only)'}
        </p>
      )}
      {status === 'error' && (
        <p className="flex items-center gap-1 text-[11px] text-brave-red">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  )
}
