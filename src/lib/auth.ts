import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const url = import.meta.env?.VITE_SUPABASE_URL
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
export const AUTH_STORAGE_KEY = 'kfood-auth-session-v1'
export const authClient = url && key ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
}) : null

export const accountProfileSchema = z.object({
  language: z.enum(['en', 'ko']),
  allergens: z.array(z.string().min(1).max(100)).max(100),
  other: z.string().max(120),
  completed: z.boolean(),
})
export function authRedirect(origin: string) {
  // Fixed same-origin destination. Never use a return URL from query parameters.
  return new URL('/?auth=callback', origin).href
}
export async function emailAvailable(signal?: AbortSignal): Promise<boolean> {
  if (!url || !key) return false
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal, cache: 'no-store' })
  if (!res.ok) throw new Error('settings_unavailable')
  return (await res.json()).external?.email === true
}

export function authErrorCode(error: unknown): string {
  const e = error as { code?: string; status?: number } | null
  if (e?.status === 429) return 'rate_limited'
  const known = ['invalid_credentials','email_not_confirmed','weak_password','email_address_invalid','email_address_not_authorized','signup_disabled','email_provider_disabled','over_email_send_rate_limit','over_request_rate_limit']
  return e?.code && known.includes(e.code) ? e.code : 'auth_failed'
}
