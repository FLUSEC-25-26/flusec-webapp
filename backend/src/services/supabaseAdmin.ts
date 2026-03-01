import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase env vars')
}

// Admin client — bypasses RLS (for server-side operations)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

// Anon client — used to verify user JWTs
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
