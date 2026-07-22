import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Trash2,
  Search,
  Link2,
  UserPlus,
  Database,
  Save,
  History,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
} from 'lucide-react'
import DownloadableCard from '@/components/shared/DownloadableCard'
import {
  fetchCombinedPlayerPool,
  fetchTop30List,
  saveTop30List,
  fetchTop30Snapshots,
  createTop30Snapshot,
  deleteTop30Snapshot,
  type PoolPlayer,
} from '@/lib/queries'
import { supabaseConfigured } from '@/lib/supabaseClient'
import { useClickOutside } from '@/lib/useClickOutside'
import { getPreviousRank, formatSnapshotDate, formatSnapshotTime } from '@/lib/top30History'
import type { Position, Top30Entry, Top30Snapshot } from '@/types'

const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'IF', 'DH', 'SP', 'RP']

const RANK_CAP = 50
const SPLIT = 25 // left column = ranks 1-25, right column = ranks 26-50

const LIST_CONTAINER = 'top50'

export default function Top30() {
  // Working list + submission history both live in Supabase now (see
  // lib/queries.ts) — not localStorage, which used to get wiped by the
  // "Refresh Data" button since it shared a cache-key prefix.
  const [list, setList] = useState<Top30Entry[] | null>(null)
  const [snapshots, setSnapshots] = useState<Top30Snapshot[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<'database' | 'manual'>('database')
  const [manualForm, setManualForm] = useState({ name: '', position: 'SS' as Position, age: '' })
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    fetchTop30List().then(setList)
    fetchTop30Snapshots().then(setSnapshots)
  }, [])

  // Fetched once here (not per-row) so both the "Add from database" search
  // and every manual entry's auto-link check share one Supabase round trip.
  const [dbPool, setDbPool] = useState<PoolPlayer[] | null>(null)
  useEffect(() => {
    fetchCombinedPlayerPool().then(setDbPool)
  }, [])

  const latestSnapshot = snapshots?.[0] // fetchTop30Snapshots() returns newest-first

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const usedPlayerIds = useMemo(
    () => new Set((list ?? []).filter((e) => e.playerId).map((e) => e.playerId as string)),
    [list],
  )

  const activeEntry = activeId ? (list ?? []).find((e) => e.id === activeId) ?? null : null

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || !list) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)
    if (activeIdStr === overIdStr) return

    const oldIndex = list.findIndex((i) => i.id === activeIdStr)
    const newIndex = list.findIndex((i) => i.id === overIdStr)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = renumber(arrayMove(list, oldIndex, newIndex))
    setList(reordered)
    saveTop30List(reordered, [])
  }

  const renumber = (items: Top30Entry[]) => items.map((item, i) => ({ ...item, rank: i + 1 }))

  const addEntry = (entry: Omit<Top30Entry, 'id' | 'rank'>) => {
    if (!list || list.length >= RANK_CAP) return // full — remove someone first
    const withMeta: Top30Entry = {
      ...entry,
      id: crypto.randomUUID(), // must be a real UUID — top_30_list.id is a uuid column
      rank: list.length + 1,
    }
    const next = [...list, withMeta]
    setList(next)
    saveTop30List(next, [])
  }

  const addFromDatabase = (player: PoolPlayer) => {
    addEntry({ name: player.name, position: player.position as Position, age: player.age, playerId: player.playerId, source: 'database' })
  }

  const addManualPlayer = () => {
    if (!manualForm.name.trim()) return
    addEntry({
      name: manualForm.name.trim(),
      position: manualForm.position,
      age: Number(manualForm.age) || 0,
      playerId: null,
      source: 'manual',
    })
    setManualForm({ name: '', position: 'SS', age: '' })
  }

  const removeEntry = (id: string) => {
    if (!list) return
    const next = renumber(list.filter((p) => p.id !== id))
    setList(next)
    saveTop30List(next, [])
  }

  const linkEntry = (id: string, match: PoolPlayer) => {
    if (!list) return
    const next = list.map((item) =>
      item.id === id
        ? { ...item, playerId: match.playerId, position: match.position as Position, age: match.age, source: 'database' as const }
        : item,
    )
    setList(next)
    saveTop30List(next, [])
  }

  const handleSubmit = async () => {
    if (!list) return
    const snapshot = await createTop30Snapshot(list, [])
    if (snapshot) setSnapshots((prev) => [snapshot, ...(prev ?? [])])
    setJustSubmitted(true)
    setTimeout(() => setJustSubmitted(false), 2500)
  }

  const deleteSnapshot = async (id: string) => {
    await deleteTop30Snapshot(id)
    setSnapshots((prev) => (prev ?? []).filter((s) => s.id !== id))
  }

  const leftHalf = (list ?? []).slice(0, SPLIT)
  const rightHalf = (list ?? []).slice(SPLIT, RANK_CAP)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-900 sm:text-xl">My Top 50 List</h2>
          <p className="text-xs text-navy-900/50 sm:text-sm">
            Edit freely — nothing is saved to history until you hit Submit.
            {latestSnapshot && (
              <> Last submitted {formatSnapshotDate(latestSnapshot.submittedAt)} at {formatSnapshotTime(latestSnapshot.submittedAt)}.</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="pill-button"
            data-active={showHistory}
          >
            <History size={14} /> History
            {(snapshots?.length ?? 0) > 0 && (
              <span className="ml-0.5 rounded-full bg-navy-950/10 px-1.5 text-[10px]">{snapshots?.length}</span>
            )}
          </button>
          <button onClick={handleSubmit} className="pill-button !bg-brave-red !text-white !border-brave-red">
            {justSubmitted ? <Check size={14} /> : <Save size={14} />}
            {justSubmitted ? 'Saved!' : 'Submit'}
          </button>
        </div>
      </div>

      {list === null || snapshots === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-navy-900/40">
          <Loader2 size={16} className="animate-spin" /> Loading your list…
        </div>
      ) : (
        <>
      {showHistory && <HistoryPanel snapshots={snapshots} onDelete={deleteSnapshot} />}

      {/* Add player panel */}
      <div className="card p-3 sm:p-4">
        <div className="mb-3 flex w-fit overflow-hidden rounded-full border border-navy-950/10">
          <button
            onClick={() => setAddMode('database')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition ${
              addMode === 'database' ? 'bg-navy text-white' : 'bg-white text-navy-800'
            }`}
          >
            <Database size={13} /> Add from database
          </button>
          <button
            onClick={() => setAddMode('manual')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition ${
              addMode === 'manual' ? 'bg-navy text-white' : 'bg-white text-navy-800'
            }`}
          >
            <UserPlus size={13} /> Add manually
          </button>
        </div>

        {list.length >= RANK_CAP && (
          <p className="mb-2 text-xs font-medium text-brave-red">
            List is full at {RANK_CAP} — remove someone before adding another.
          </p>
        )}

        {addMode === 'database' ? (
          !supabaseConfigured ? (
            <p className="text-xs text-navy-900/40">
              Supabase isn't connected — see <code>.env.example</code>. Switch to "Add manually"
              in the meantime.
            </p>
          ) : dbPool === null ? (
            <p className="flex items-center gap-1.5 text-xs text-navy-900/40">
              <Loader2 size={12} className="animate-spin" /> Loading players…
            </p>
          ) : dbPool.length === 0 ? (
            <p className="text-xs text-navy-900/40">
              No current-season players uploaded yet — upload stats in Tab 6 first, or switch to
              "Add manually" for a draft pick or signee who isn't in the database yet.
            </p>
          ) : (
            <DatabaseSearch pool={dbPool} usedPlayerIds={usedPlayerIds} onSelect={addFromDatabase} />
          )
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-navy-900/45">
              For players not in the database yet — draft picks, international signees, etc. Once
              they record stats and show up via a Tab 6 upload, you'll get a prompt here to link
              this entry to their real record.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-navy-900/40">Name</label>
                <input
                  value={manualForm.name}
                  onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Player name"
                  className="w-full rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="w-24">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-navy-900/40">Position</label>
                <select
                  value={manualForm.position}
                  onChange={(e) => setManualForm((f) => ({ ...f, position: e.target.value as Position }))}
                  className="w-full rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-navy-900/40">Age</label>
                <input
                  type="number"
                  value={manualForm.age}
                  onChange={(e) => setManualForm((f) => ({ ...f, age: e.target.value }))}
                  className="w-full rounded-lg border border-navy-950/10 px-2.5 py-1.5 text-sm"
                />
              </div>
              <button onClick={addManualPlayer} className="pill-button !bg-navy !text-white h-[34px]">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* One SortableContext spanning the full 1-50 list — split into two
            visual columns purely for readability. Dragging a card from the
            right column into the left (or vice versa) reorders it into that
            rank range, since under the hood it's still one continuous list. */}
        <SortableContext id={LIST_CONTAINER} items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DownloadableCard title="Rank 1–25" subtitle={`${leftHalf.length} / ${SPLIT}`} filename="braves-top-50-rank-1-25">
              <RankColumn
                items={leftHalf}
                emptyLabel="Drag or add players here"
                onRemove={removeEntry}
                onLink={linkEntry}
                latestSnapshot={latestSnapshot}
                dbPool={dbPool}
              />
            </DownloadableCard>
            <DownloadableCard title="Rank 26–50" subtitle={`${rightHalf.length} / ${RANK_CAP - SPLIT}`} filename="braves-top-50-rank-26-50">
              <RankColumn
                items={rightHalf}
                emptyLabel="Ranks 26-50 fill in as you add more players"
                onRemove={removeEntry}
                onLink={linkEntry}
                latestSnapshot={latestSnapshot}
                dbPool={dbPool}
              />
            </DownloadableCard>
          </div>
        </SortableContext>

        <DragOverlay>{activeEntry ? <PlayerCardVisual entry={activeEntry} dragging /> : null}</DragOverlay>
      </DndContext>
        </>
      )}
    </div>
  )
}

function HistoryPanel({ snapshots, onDelete }: { snapshots: Top30Snapshot[]; onDelete: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (snapshots.length === 0) {
    return (
      <div className="card p-4 text-center text-xs text-navy-900/40">
        No submissions yet — hit Submit to save today's Top 50 as your first dated snapshot.
      </div>
    )
  }

  return (
    <div className="card divide-y divide-navy-950/5">
      {snapshots.map((snap) => {
        const expanded = expandedId === snap.id
        return (
          <div key={snap.id}>
            <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
              <button onClick={() => setExpandedId(expanded ? null : snap.id)} className="flex flex-1 items-center gap-2 text-left">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="text-sm font-medium text-navy-950">{formatSnapshotDate(snap.submittedAt)}</span>
                <span className="text-xs text-navy-900/40">{formatSnapshotTime(snap.submittedAt)}</span>
                <span className="ml-auto text-xs text-navy-900/40 sm:ml-2">{snap.list.length} ranked</span>
              </button>
              {confirmingId === snap.id ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-navy-900/50">Delete?</span>
                  <button
                    onClick={() => {
                      onDelete(snap.id)
                      setConfirmingId(null)
                    }}
                    className="rounded-full bg-brave-red px-2 py-0.5 font-medium text-white"
                  >
                    Yes
                  </button>
                  <button onClick={() => setConfirmingId(null)} className="rounded-full bg-navy-950/10 px-2 py-0.5 font-medium text-navy-800">
                    No
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmingId(snap.id)} className="text-navy-950/25 hover:text-brave-red">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {expanded && (
              <div className="overflow-x-auto px-3 pb-3 sm:px-4">
                <table className="stat-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th className="text-left">Name</th>
                      <th>Pos</th>
                      <th>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.list.map((e) => (
                      <tr key={e.id}>
                        <td>{e.rank}</td>
                        <td>{e.name}</td>
                        <td>{e.position}</td>
                        <td>{e.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DatabaseSearch({
  pool,
  usedPlayerIds,
  onSelect,
}: {
  pool: PoolPlayer[]
  usedPlayerIds: Set<string>
  onSelect: (player: PoolPlayer) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, () => setFocused(false), focused)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return pool.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, pool])

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-950/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search players already in the database…"
          className="w-full rounded-lg border border-navy-950/10 py-2 pl-8 pr-3 text-sm sm:max-w-md"
        />
      </div>
      {focused && query.trim() && (
        <div className="mt-1.5 max-h-64 space-y-1 overflow-auto rounded-lg border border-navy-950/10 bg-white p-1.5 shadow-sm sm:max-w-md">
          {results.length === 0 && (
            <p className="px-2 py-2 text-xs text-navy-900/40">No match. Switch to "Add manually" if this player isn't in the database yet.</p>
          )}
          {results.map((p) => {
            const alreadyAdded = usedPlayerIds.has(p.playerId)
            return (
              <button
                key={p.playerId}
                disabled={alreadyAdded}
                onClick={() => {
                  onSelect(p)
                  setQuery('')
                  setFocused(false)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-brave-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-navy-950">{p.name}</span>
                  <span className="ml-1.5 text-navy-900/45">
                    {p.position} · {p.level} · Age {p.age}
                  </span>
                </span>
                {alreadyAdded && <span className="shrink-0 text-navy-900/30">Added</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RankColumn({
  items,
  emptyLabel,
  onRemove,
  onLink,
  latestSnapshot,
  dbPool,
}: {
  items: Top30Entry[]
  emptyLabel: string
  onRemove: (id: string) => void
  onLink: (id: string, match: PoolPlayer) => void
  latestSnapshot: Top30Snapshot | undefined
  dbPool: PoolPlayer[] | null
}) {
  return (
    <div className="min-h-[80px] space-y-1.5 p-3 sm:p-4">
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-navy-950/15 py-6 text-center text-xs text-navy-900/35">{emptyLabel}</p>
      )}
      {items.map((entry) => (
        <SortablePlayerCard
          key={entry.id}
          entry={entry}
          onRemove={onRemove}
          onLink={onLink}
          previousRank={getPreviousRank(entry, latestSnapshot)}
          dbPool={dbPool}
        />
      ))}
    </div>
  )
}

function SortablePlayerCard({
  entry,
  onRemove,
  onLink,
  previousRank,
  dbPool,
}: {
  entry: Top30Entry
  onRemove: (id: string) => void
  onLink: (id: string, match: PoolPlayer) => void
  previousRank: number | null
  dbPool: PoolPlayer[] | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <PlayerCardVisual
        entry={entry}
        dragHandleProps={{ ...attributes, ...listeners }}
        onRemove={onRemove}
        onLink={onLink}
        previousRank={previousRank}
        dbPool={dbPool}
      />
    </div>
  )
}

function PlayerCardVisual({
  entry,
  dragging = false,
  dragHandleProps,
  onRemove,
  onLink,
  previousRank,
  dbPool,
}: {
  entry: Top30Entry
  dragging?: boolean
  dragHandleProps?: Record<string, any>
  onRemove?: (id: string) => void
  onLink?: (id: string, match: PoolPlayer) => void
  previousRank?: number | null
  dbPool?: PoolPlayer[] | null
}) {
  const match =
    entry.source === 'manual' && dbPool
      ? dbPool.find((p) => p.name.trim().toLowerCase() === entry.name.trim().toLowerCase())
      : undefined

  // For display purposes only (not the "link" logic above) — look up this
  // player's stat line whether they're already linked or not, so both
  // database and not-yet-linked-but-matching manual entries show it.
  const poolEntry = entry.playerId
    ? dbPool?.find((p) => p.playerId === entry.playerId)
    : dbPool?.find((p) => p.name.trim().toLowerCase() === entry.name.trim().toLowerCase())

  const statLine = poolEntry
    ? poolEntry.playerType === 'Hitter'
      ? `${poolEntry.age} yo · ${poolEntry.level} · ${poolEntry.position} · AVG ${poolEntry.avg?.toFixed(3) ?? '—'} · OPS ${poolEntry.ops?.toFixed(3) ?? '—'} · wRC+ ${poolEntry.wrcPlus ?? '—'} · BB:K ${poolEntry.bbPct?.toFixed(1) ?? '—'}:${poolEntry.kPct?.toFixed(1) ?? '—'}`
      : `${poolEntry.age} yo · ${poolEntry.level} · ${poolEntry.throws ?? '?'}HP · ERA ${poolEntry.era?.toFixed(2) ?? '—'} · FIP ${poolEntry.fip?.toFixed(2) ?? '—'} · SIERA ${poolEntry.siera?.toFixed(2) ?? '—'} · K:BB ${poolEntry.kbbPct?.toFixed(1) ?? '—'}%`
    : `${entry.position} · Age ${entry.age}`

  const rankDelta = previousRank != null && entry.rank != null ? previousRank - entry.rank : null

  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border border-navy-950/8 bg-white px-2.5 py-2 shadow-sm ${dragging ? 'ring-2 ring-brave-red' : ''}`}>
      <div className="flex items-center gap-2">
        <button {...dragHandleProps} className="cursor-grab touch-none text-navy-950/25 active:cursor-grabbing" aria-label="Drag to reorder">
          <GripVertical size={16} />
        </button>
        <span className="w-6 shrink-0 text-center font-display text-sm font-semibold text-navy-950/70">{entry.rank ?? '—'}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <span className="truncate text-sm font-medium text-navy-950">{entry.name}</span>
            {entry.source === 'manual' && (
              <span className="shrink-0 rounded-full bg-brave-gold/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brave-gold">
                Not in DB
              </span>
            )}
          </div>
          <div className="text-[11px] text-navy-900/45">{statLine}</div>
        </div>
        {previousRank !== undefined && (
          <div className="shrink-0 text-right">
            <div className="text-[9px] uppercase tracking-wide text-navy-900/35">Prev</div>
            <div
              className={`text-xs font-semibold ${
                previousRank === null
                  ? 'text-navy-900/35'
                  : rankDelta && rankDelta > 0
                  ? 'text-emerald-600'
                  : rankDelta && rankDelta < 0
                  ? 'text-brave-red'
                  : 'text-navy-900/60'
              }`}
            >
              {previousRank === null ? 'NR' : `#${previousRank}`}
            </div>
          </div>
        )}
        {onRemove && (
          <button onClick={() => onRemove(entry.id)} className="text-navy-950/25 hover:text-brave-red">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {match && onLink && (
        <button
          onClick={() => onLink(entry.id, match)}
          className="ml-8 flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <Link2 size={12} />
          Stats found for {match.name} ({match.level}) — link now
        </button>
      )}
    </div>
  )
}
