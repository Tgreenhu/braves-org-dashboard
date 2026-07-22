import type { Top30Entry, Top30Snapshot } from '@/types'

// Persistence for the working list and submission history now lives in
// Supabase (top_30_list / top_30_snapshots — see lib/queries.ts), not
// localStorage. This file used to read/write localStorage directly, but
// it shared a key prefix with the app's server-data cache, so clicking
// "Refresh Data" silently deleted a user's real Top 30/50 list along with
// the stale cache it was meant to clear. Moving to Supabase fixes that
// permanently (nothing here is cache, so nothing here should ever be
// cleared) and also means the list finally syncs across devices.

/** Creates a new dated snapshot from the current working list + bucket. */
export function buildSnapshot(list: Top30Entry[], bucket: Top30Entry[]): Omit<Top30Snapshot, 'id'> {
  return {
    submittedAt: new Date().toISOString(),
    list: list.map((e) => ({ ...e })),
    bucket: bucket.map((e) => ({ ...e })),
  } as Omit<Top30Snapshot, 'id'>
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
