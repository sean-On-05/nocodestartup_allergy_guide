import type { Catalog, Ingredient, VerificationStatus } from './types'
import { connectBundledRecipes, connectRecipeRecords, type RecipeRecord, type RecipeIngredientRecord, type IngredientNameMapping, type RecipeSourceRecord } from './recipes'
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
  const catalog = normalizeIngredients(rows)
  async function table<T>(name: string, columns: string, order: string): Promise<T[]> {
    const result: T[] = []
    const recipeSignal = signal ? AbortSignal.any([signal,AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000)
    let offset=0, expectedTotal: number | null=null
    while(true) {
      const response = await fetch(`${url}/rest/v1/${name}?select=${columns}&order=${order}&limit=1000&offset=${offset}`, { headers:{ apikey:key!, Accept:'application/json', Prefer:'count=exact' }, signal:recipeSignal })
      if (!response.ok) throw new Error('Recipe catalog read failed')
      const page: unknown = await response.json()
      if (!Array.isArray(page) || page.some(r=>!r || typeof r !== 'object')) throw new Error('Invalid recipe data')
      const range=response.headers.get('Content-Range')
      const match=range?.match(/\/(\d+)$/)
      const total=match?Number(match[1]):null
      if (total!==null) {
        if(expectedTotal!==null&&expectedTotal!==total) throw new Error('Recipe dataset changed while loading')
        expectedTotal=total
      }
      if(!page.length) {
        if(expectedTotal!==null&&result.length!==expectedTotal) throw new Error('Incomplete recipe response')
        return result
      }
      result.push(...page);offset+=page.length
      if(expectedTotal!==null&&result.length===expectedTotal) return result
      if(expectedTotal!==null&&result.length>expectedTotal) throw new Error('Recipe response count mismatch')
      if(offset>100000) throw new Error('Recipe page limit exceeded')
    }
  }
  try {
    const recipes = await table<RecipeRecord>('external_recipes','recipe_id,recipe_name_ko','recipe_id.asc')
    if (!recipes.length) return connectBundledRecipes(catalog)
    const [parts,mappings] = await Promise.all([
      table<RecipeIngredientRecord>('external_recipe_ingredients','recipe_id,ingredient_seq,ingredient_name,ingredient_quantity','recipe_id.asc,ingredient_seq.asc'),
      table<IngredientNameMapping>('external_ingredient_master_mapping','source_ingredient_name,ingredient_id,mapping_status','source_ingredient_name.asc')
    ])
    if (new Set(recipes.map(r=>r.recipe_id)).size!==recipes.length || recipes.some(r=>typeof r.recipe_id !== 'string' || typeof r.recipe_name_ko !== 'string') || parts.some(p=>typeof p.recipe_id !== 'string' || typeof p.ingredient_name !== 'string' || !Number.isInteger(p.ingredient_seq) || !(p.ingredient_quantity === null || typeof p.ingredient_quantity === 'string')) || mappings.some(m=>typeof m.source_ingredient_name !== 'string' || !(m.ingredient_id === null || typeof m.ingredient_id === 'string'))) throw new Error('Invalid recipe fields')
    // Source metadata is optional for older imports; missing metadata never fabricates attribution.
    let sources: RecipeSourceRecord[] = []
    try {
      const records=await table<RecipeSourceRecord>('kfood_public_recipe_sources','recipe_id,provider,dataset_url,raw_ingredients,retrieved_on,source_record','recipe_id.asc')
      sources=records.filter(r=>typeof r.recipe_id==='string'&&typeof r.provider==='string'&&typeof r.dataset_url==='string'&&typeof r.raw_ingredients==='string'&&typeof r.retrieved_on==='string')
    } catch (error) { if(signal?.aborted) throw error }
    return connectRecipeRecords(catalog,recipes,parts,mappings,'supabase',sources)
  } catch (error) {
    if (signal?.aborted) throw error
    return { ...connectBundledRecipes(catalog), recipe_load_issue:true }
  }
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
