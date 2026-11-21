import type { Catalog, Ingredient, VerificationStatus } from './types'
export const knownAllergenNames: Record<string, [string, string]> = {
  Crustacean: ['Crustaceans (incl. shrimp)', '갑각류 (새우 등)'], Peanuts: ['Peanuts', '땅콩'], Milk: ['Milk', '우유'], Egg: ['Egg', '달걀'], Soy: ['Soy', '대두'], Wheat: ['Wheat', '밀'], Gluten: ['Gluten', '글루텐'], Fish: ['Fish', '생선'], Shellfish: ['Shellfish', '조개류'], Sesame: ['Sesame', '참깨'], 'Tree Nuts': ['Tree nuts', '견과류'], Sulphites: ['Sulphites', '아황산류'], Mustard: ['Mustard', '겨자'], Celery: ['Celery', '셀러리'], Buckwheat: ['Buckwheat', '메밀'], Squid: ['Squid', '오징어'], Peach: ['Peach', '복숭아'], Beef: ['Beef', '소고기'], Pork: ['Pork', '돼지고기'], Chicken: ['Chicken', '닭고기'], Rice: ['Rice', '쌀'], Tomato: ['Tomato', '토마토'], Garlic: ['Garlic', '마늘'], Onion: ['Onion', '양파'], Lupin: ['Lupin', '루핀']
}
export const preferredTags = ['Crustacean','Peanuts','Milk','Egg','Soy','Wheat','Fish','Shellfish','Sesame','Tree Nuts','Gluten','Sulphites']
const ingredientColumns = 'id,ingredient_name,global_allergens,vegan_level,diet_categories,hidden_warning_en,staff_request_ko,user_notice_en,verification_status,source_note'
export function supabaseConfigured() { return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
export async function loadSupabaseCatalog(signal?: AbortSignal, config?: { url: string; publishableKey: string }): Promise<Catalog> {
  const url = (config?.url ?? import.meta.env.VITE_SUPABASE_URL)?.replace(/\/$/, '')
  const key = config?.publishableKey ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key || key.startsWith('sb_secret_')) throw new Error('Missing public Supabase configuration')
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(`${url}/rest/v1/ingredient_master?select=${ingredientColumns}&order=id.asc&limit=500&offset=${offset}`, { headers: { apikey: key, Accept: 'application/json' }, signal: requestSignal })
    if (!response.ok) throw new Error(`Supabase read failed (${response.status})`)
    const page: unknown = await response.json()
    if (!Array.isArray(page) || page.some(row => !row || typeof row !== 'object')) throw new Error('Invalid ingredient response')
    rows.push(...page)
    if (page.length < 500) break
    if (offset >= 100000) throw new Error('Catalog exceeds supported page limit')
  }
  if (!rows.length) throw new Error('No publicly readable ingredients')
  return normalizeIngredients(rows)
}
export function normalizeIngredients(rows: Record<string, unknown>[]): Catalog {
  const text = (v: unknown) => typeof v === 'string' ? v : ''
  const list = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && !!s.trim()) : []
  const ingredients: Ingredient[] = rows.map(row => {
    if (!text(row.id) || !text(row.ingredient_name)) throw new Error('Missing ingredient identity')
    return { id: text(row.id), ingredient_name: text(row.ingredient_name), global_allergens: list(row.global_allergens), vegan_level: text(row.vegan_level), diet_categories: list(row.diet_categories), hidden_warning_en: text(row.hidden_warning_en), staff_request_ko: text(row.staff_request_ko), user_notice_en: text(row.user_notice_en), verification_status: (['verified','needs_review'].includes(text(row.verification_status)) ? row.verification_status : 'unknown') as VerificationStatus, source_note: text(row.source_note) }
  })
  if (new Set(ingredients.map(i => i.id)).size !== ingredients.length) throw new Error('Duplicate ingredient identity')
  const tags = [...new Set(ingredients.flatMap(i => i.global_allergens))].sort((a,b) => {
    const ai = preferredTags.indexOf(a), bi = preferredTags.indexOf(b)
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.localeCompare(b)
  })
  // These options are derived from visible ingredient tags, not asserted to be allergen_master rows.
  // No invisible mapping records or dish-to-ingredient links are fabricated.
  return { ingredient_master: ingredients, allergen_master: tags.map(id => ({ id, name_en: knownAllergenNames[id]?.[0] || id, name_ko: knownAllergenNames[id]?.[1] || id })), ingredient_allergen_mapping: [], external_ingredient_master_mapping: [], dishes: [] }
}
