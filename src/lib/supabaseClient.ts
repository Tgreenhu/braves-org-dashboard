import { createClient } from '@supabase/supabase-js'

// These come from GitHub/Vite env vars at build time. Set them in a local
// `.env.local` file (see `.env.example`) and, for deployment, as repository/
// hosting secrets (e.g. Vercel/Netlify project env vars, or GitHub Actions
// secrets if you build via CI). Never commit real keys.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'The dashboard will run on local mock data until you connect Supabase. ' +
      'See .env.example and supabase/schema.sql.',
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
