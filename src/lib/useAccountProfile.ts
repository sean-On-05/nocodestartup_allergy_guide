import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from './types'
import { authClient, accountProfileSchema, authRedirect, AUTH_STORAGE_KEY } from './auth'
import { emptyProfile, loadProfile, saveProfile } from './profile'

type CloudStatus = 'guest' | 'loading' | 'ready' | 'saving' | 'saved' | 'error'
export function useAccountProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!authClient)
  const [authError, setAuthError] = useState(() => new URLSearchParams(location.search).has('error') || new URLSearchParams(location.hash.slice(1)).has('error') ? 'signin_failed' : '')
  const [snapshot, setSnapshot] = useState<{ owner: string | null; profile: Profile }>(() => ({ owner: null, profile: loadProfile() }))
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('guest')
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const [authBusy, setAuthBusy] = useState(false)
  const identity = useRef<string | null>(null)
  const sequence = useRef(0)
  const queue = useRef<Promise<boolean>>(Promise.resolve(true))
  const requests = useRef(new Set<AbortController>())
  const owner = user?.id || null
  const profile = snapshot.owner === owner ? snapshot.profile : { ...emptyProfile, language: loadProfile().language }
  const canEdit = authReady && (!owner || (loaded && snapshot.owner === owner)) && !authBusy

  useEffect(() => {
    if (!authClient) return
    let alive = true; let events = 0
    const apply = (next: User | null) => {
      if (!alive) return
      const id = next?.id || null
      if (identity.current !== id) {
        sequence.current++
        requests.current.forEach(c => c.abort()); requests.current.clear()
        identity.current = id; setLoaded(false)
      }
      setUser(next); setAuthReady(true)
    }
    // Keep this callback synchronous: SDK auth events hold an internal lock.
    const { data } = authClient.auth.onAuthStateChange((_event, session) => { events++; apply(session?.user || null) })
    authClient.auth.getSession().then(({ data, error }) => {
      if (!alive || events) return
      if (error) setAuthError('session_failed')
      apply(data.session?.user || null)
    }).catch(() => { if (alive) { setAuthError('session_failed'); setAuthReady(true) } })
    return () => { alive = false; data.subscription.unsubscribe(); requests.current.forEach(c => c.abort()) }
  }, [])

  useEffect(() => {
    if (!authReady) return
    const version = ++sequence.current
    if (!owner || !authClient) {
      setSnapshot({ owner: null, profile: loadProfile() }); setCloudStatus('guest'); setLoaded(true)
      return
    }
    const client = authClient
    const controller = new AbortController(); requests.current.add(controller)
    setCloudStatus('loading'); setLoaded(false)
    setSnapshot({ owner, profile: { ...emptyProfile, language: loadProfile().language } })
    Promise.resolve(client.from('kfood_user_profiles').select('language,allergens,other,completed').eq('user_id', owner).abortSignal(controller.signal).maybeSingle()).then(({ data, error }) => {
      if (controller.signal.aborted || identity.current !== owner || sequence.current !== version) return
      const parsed = data ? accountProfileSchema.safeParse(data) : null
      if (error || (parsed && !parsed.success)) { setCloudStatus('error'); return }
      setSnapshot({ owner, profile: parsed?.success ? parsed.data : { ...emptyProfile, language: loadProfile().language } })
      setLoaded(true); setCloudStatus('ready')
    }).catch(() => { if (!controller.signal.aborted && identity.current === owner) setCloudStatus('error') }).finally(() => requests.current.delete(controller))
    return () => { controller.abort(); requests.current.delete(controller) }
  }, [owner, authReady, retry])

  const update = (next: Profile): Promise<boolean> => {
    if (!canEdit) return Promise.resolve(false)
    const parsed = accountProfileSchema.safeParse(next)
    if (!parsed.success) return Promise.resolve(false)
    setSnapshot({ owner, profile: parsed.data })
    if (!owner || !authClient) return Promise.resolve(saveProfile(parsed.data))
    const client = authClient; const version = ++sequence.current
    setCloudStatus('saving')
    // Serialize this browser's edits; never apply an old account's completion to a new one.
    queue.current = queue.current.catch(() => false).then(async () => {
      if (identity.current !== owner) return false
      const controller = new AbortController(); requests.current.add(controller)
      let ok = false
      try {
        const { data, error } = await client.from('kfood_user_profiles').upsert({ user_id: owner, ...parsed.data, updated_at: new Date().toISOString() }).select('user_id').abortSignal(controller.signal).single()
        ok = !error && data?.user_id === owner
      } catch { ok = false } finally { requests.current.delete(controller) }
      if (!controller.signal.aborted && identity.current === owner && sequence.current === version) setCloudStatus(ok ? 'saved' : 'error')
      return ok
    })
    return queue.current
  }
  const signIn = async () => {
    if (!authClient || authBusy) return
    setAuthBusy(true); setAuthError('')
    try {
      const { error } = await authClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect(location.origin), queryParams: { prompt: 'select_account' } } })
      if (error) setAuthError('signin_failed')
    } catch { setAuthError('signin_failed') } finally { setAuthBusy(false) }
  }
  const signOut = async () => {
    if (!authClient || authBusy) return
    setAuthBusy(true); setAuthError('')
    try {
      const { error } = await authClient.auth.signOut({ scope: 'local' })
      if (error) setAuthError('signout_failed')
    } catch { setAuthError('signout_failed') } finally { setAuthBusy(false) }
  }
  const deleteAccount = async (): Promise<boolean> => {
    if (!authClient || !owner || authBusy) return false
    setAuthBusy(true); setAuthError('')
    try {
      await queue.current
      if (identity.current !== owner) return false
      const { error } = await authClient.rpc('kfood_delete_my_account')
      if (error) { setAuthError('delete_failed'); return false }
      await authClient.auth.signOut({ scope: 'local' })
      // Deletion has succeeded. Remove a stale local session even if network logout failed.
      try { localStorage.removeItem(AUTH_STORAGE_KEY); localStorage.removeItem(AUTH_STORAGE_KEY+'-code-verifier') } catch { /* blocked storage */ }
      location.replace(location.origin + '/#account')
      return true
    } catch { setAuthError('delete_failed'); return false } finally { setAuthBusy(false) }
  }
  return { user, profile, authReady, authBusy, authError, cloudStatus, canEdit, loaded, update, signIn, signOut, deleteAccount, reload: () => setRetry(n => n + 1), configured: Boolean(authClient) }
}
export type AccountState = ReturnType<typeof useAccountProfile>
