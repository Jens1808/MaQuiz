import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // hilft beim Debuggen auf Vercel
  console.error('[Supabase ENV missing]', { hasUrl: !!url, keyLen: key?.length ?? 0 })
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
