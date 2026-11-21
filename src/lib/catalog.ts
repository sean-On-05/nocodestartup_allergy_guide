import { demoCatalog } from '../data/demo'
import type { Catalog } from './types'
import { loadSupabaseCatalog, supabaseConfigured } from './supabase'
// Public read-only API only. Database credentials must stay on your backend.
export async function loadCatalog(signal?: AbortSignal): Promise<{ catalog: Catalog; source: 'demo' | 'api' | 'supabase' }> {
  if (supabaseConfigured()) return { catalog: await loadSupabaseCatalog(signal), source: 'supabase' }
  const base = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!base) return { catalog: demoCatalog, source: 'demo' }
  const response = await fetch(`${base.replace(/\/$/, '')}/catalog`, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Catalog request failed')
  const value: unknown = await response.json()
  assertCatalog(value)
  return { catalog: value, source: 'api' }
}
export function assertCatalog(value: unknown): asserts value is Catalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid catalog')
  const c = value as Record<string, unknown>
  const fields = ['ingredient_master','allergen_master','ingredient_allergen_mapping','external_ingredient_master_mapping','dishes']
  for (const field of fields) if (!Array.isArray(c[field])) throw new Error(`Missing ${field}`)
  const records = (key: string) => c[key] as Record<string, unknown>[]
  const str = (v: unknown) => typeof v === 'string'
  const strings = (v: unknown) => Array.isArray(v) && v.every(str)
  const statuses = ['verified','needs_review','unknown']
  for (const field of fields) {
    const rows = records(field)
    if (rows.some(row => !row || typeof row !== 'object')) throw new Error(`Invalid ${field}`)
    if (['ingredient_master','allergen_master','dishes'].includes(field) && new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Duplicate IDs')
  }
  for (const i of records('ingredient_master')) {
    if (!['id','ingredient_name','vegan_level','hidden_warning_en','staff_request_ko','user_notice_en','source_note'].every(k => str(i[k])) || !strings(i.global_allergens) || !strings(i.diet_categories) || !statuses.includes(String(i.verification_status)) || (i.ingredient_name_en !== undefined && !str(i.ingredient_name_en))) throw new Error('Invalid ingredient')
  }
  for (const a of records('allergen_master')) if (!['id','name_en','name_ko'].every(k => str(a[k]))) throw new Error('Invalid allergen')
  for (const m of records('ingredient_allergen_mapping')) if (!str(m.ingredient_id) || !str(m.allergen_id) || !statuses.includes(String(m.evidence_status))) throw new Error('Invalid allergen mapping')
  for (const m of records('external_ingredient_master_mapping')) if (!str(m.external_id) || !str(m.external_name) || !(m.ingredient_id === null || str(m.ingredient_id)) || !['matched','manually_matched','needs_review'].includes(String(m.match_status))) throw new Error('Invalid external mapping')
  for (const d of records('dishes')) {
    if (!['id','name_en','name_ko','description_en','description_ko','source_note'].every(k => str(d[k])) || !strings(d.ingredient_ids) || !strings(d.external_ingredient_ids) || typeof d.ingredients_complete !== 'boolean' || !['rice','stew','noodles','street'].includes(String(d.category))) throw new Error('Invalid dish')
    if (d.nutrition !== undefined) {
      const n = d.nutrition as Record<string, unknown>
      if (!n || typeof n !== 'object' || !['kcal','protein_g','carbs_g'].every(k => typeof n[k] === 'number' && Number.isFinite(n[k]) && Number(n[k]) >= 0) || !str(n.source)) throw new Error('Invalid nutrition')
    }
  }
}
