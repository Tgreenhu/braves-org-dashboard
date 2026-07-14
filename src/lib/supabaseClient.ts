import { createClient } from '@supabase/supabase-js'

// These come from GitHub/Vite env vars at build time. Set them in a local
// `.env.local` file (see `.env.example`) and, for deployment, as repository/
// hosting secrets (e.g. Vercel/Netlify project env vars, or GitHub Actions
// secrets if you build via CI). Never commit real keys.
//
// .trim() + stripping a trailing slash guards against a common, silent
// failure mode: pasting a secret into GitHub's UI sometimes carries a
// trailing space or newline, which breaks the URL Supabase builds
// internally and surfaces as a cryptic "Invalid path specified in request
// URL" error with no obvious cause.
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabaseUrl = rawSupabaseUrl?.trim().replace(/\/+$/, '')
const supabaseAnonKey = rawSupabaseAnonKey?.trim()

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'The dashboard will run on local mock data until you connect Supabase. ' +
      'See .env.example and supabase/schema.sql.',
  )
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl!)) {
  // Doesn't match the expected shape (https://<ref>.supabase.co) — still
  // try to use it, but warn loudly so a malformed secret is easy to spot
  // in the browser console instead of silently causing upload failures.
  // eslint-disable-next-line no-console
  console.warn(
    `[supabase] VITE_SUPABASE_URL doesn't look like a standard Supabase project URL: "${supabaseUrl}". ` +
      'Expected something like "https://abcdefghijk.supabase.co" with no trailing slash or extra characters.',
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: { persistSession: true },
    // All reads are cached client-side (see lib/cache.ts) so stat pages don't
    // re-fetch on every tab switch. Data only changes when you re-run the
    // Tab 6 upload flow.
  },
)
