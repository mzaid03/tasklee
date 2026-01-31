import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function getSupabaseClient() {
	if (browserClient) return browserClient

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error(
			'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
		)
	}

	browserClient = createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	})

	return browserClient
}

export async function ensureGuestSession() {
	const supabase = getSupabaseClient()
	const { data: existing } = await supabase.auth.getSession()
	if (existing.session) return existing.session

	const { data, error } = await supabase.auth.signInAnonymously()
	if (error) throw error
	return data.session
}
