import { cacheGet, cacheSet } from '@/lib/cache'
import type { Top30Entry, Top30Snapshot } from '@/types'

// TODO(supabase): these currently persist to localStorage only (see
// lib/cache.ts) so history survives a refresh on this device. Move to the
// `top_30_snapshots` table in supabase/schema.sql to get real cross-device
// history — submitSnapshot() becomes an insert, loadSnapshots() a select
// ordered by submitted_at desc, deleteSnapshot() a delete by id.

const WORKING_LIST_KEY = 'top30-working-list'
const WORKING_BUCKET_KEY = 'top30-working-bucket'
const SNAPSHOTS_KEY = 'top30-snapshots'

export function loadWorkingList(fallback: Top30Entry[]): Top30Entry[] {
  return cacheGet<Top30Entry[]>(WORKING_LIST_KEY) ?? fallback
}
export function loadWorkingBucket(fallback: Top30Entry[]): Top30Entry[] {
  return cacheGet<Top30Entry[]>(WORKING_BUCKET_KEY) ?? fallback
}
export function saveWorkingState(list: Top30Entry[], bucket: Top30Entry[]) {
  cacheSet(WORKING_LIST_KEY, list)
  cacheSet(WORKING_BUCKET_KEY, bucket)
}

export function loadSnapshots(): Top30Snapshot[] {
  const snaps = cacheGet<Top30Snapshot[]>(SNAPSHOTS_KEY) ?? []
  return [...snaps].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

export function saveSnapshots(snapshots: Top30Snapshot[]) {
  cacheSet(SNAPSHOTS_KEY, snapshots)
}

/** Creates a new dated snapshot from the current working list + bucket. */
export function createSnapshot(list: Top30Entry[], bucket: Top30Entry[]): Top30Snapshot {
  return {
    id: `snap-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    list: list.map((e) => ({ ...e })),
    bucket: bucket.map((e) => ({ ...e })),
  }
}

/**
 * Looks up what rank a player had in the most recent submitted snapshot.
 * Matches on playerId when the entry is linked to the database, otherwise
 * falls back to a case-insensitive name match (for manual entries). Returns
 * null if they weren't in that snapshot's Top 30 (either absent entirely or
 * sitting in that snapshot's bucket) — the UI renders that as "NR".
 */
export function getPreviousRank(entry: Top30Entry, latestSnapshot: Top30Snapshot | undefined): number | null {
  if (!latestSnapshot) return null
  const match = latestSnapshot.list.find((e) =>
    entry.playerId
      ? e.playerId === entry.playerId
      : e.name.trim().toLowerCase() === entry.name.trim().toLowerCase(),
  )
  return match?.rank ?? null
}

export function formatSnapshotDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
export function formatSnapshotTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
