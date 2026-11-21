import type { Profile } from './types'
const key = 'kfood-allergy-profile-v1'
export const emptyProfile: Profile = { language: 'en', allergens: [], other: '', completed: false }
export function loadProfile(): Profile {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null')
    if (!value || typeof value !== 'object') return { ...emptyProfile }
    const p = value as Record<string, unknown>
    return { language: p.language === 'ko' ? 'ko' : 'en', allergens: Array.isArray(p.allergens) ? [...new Set(p.allergens.filter((x): x is string => typeof x === 'string'))] : [], other: typeof p.other === 'string' ? p.other.slice(0, 120) : '', completed: p.completed === true }
  } catch { return { ...emptyProfile } }
}
export function saveProfile(profile: Profile): boolean {
  try { localStorage.setItem(key, JSON.stringify(profile)); return true } catch { return false }
}
export function deleteProfile() { try { localStorage.removeItem(key) } catch { /* Storage may be blocked. */ } }
