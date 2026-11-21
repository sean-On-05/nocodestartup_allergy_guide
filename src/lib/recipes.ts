import publicData from '../../data/public-recipes/mfds-sample.json'
import type { Catalog, Dish, ExternalIngredientMapping, Ingredient } from './types'
export interface RecipeRecord { recipe_id: string; recipe_name_ko: string }
export interface RecipeIngredientRecord { recipe_id: string; ingredient_seq: number; ingredient_name: string; ingredient_quantity: string | null }
export interface IngredientNameMapping { source_ingredient_name: string; ingredient_id: string | null; mapping_status: string }
const normalized = (name: string) => name.normalize('NFKC').replace(/\s+/g, '')
export function resolveIngredient(name: string, ingredients: Ingredient[]): Ingredient | undefined {
  const exact = ingredients.filter(i => i.ingredient_name === name)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return undefined
  const similar = ingredients.filter(i => normalized(i.ingredient_name) === normalized(name))
  return similar.length === 1 ? similar[0] : undefined
}
export function connectRecipeRecords(catalog: Catalog, recipes: RecipeRecord[], rows: RecipeIngredientRecord[], mappings: IngredientNameMapping[] = [], origin: 'bundled-public' | 'supabase' = 'supabase'): Catalog {
  const names = [...new Set(rows.map(r => r.ingredient_name))]
  const links: ExternalIngredientMapping[] = names.map(name => {
    const existing = mappings.filter(m => m.source_ingredient_name === name)
    const id = existing.length === 1 ? existing[0].ingredient_id : existing.length > 1 ? null : resolveIngredient(name,catalog.ingredient_master)?.id || null
    const validId = id && catalog.ingredient_master.some(i => i.id === id) ? id : null
    // Identity matches do not verify the recipe or its allergen evidence.
    return { external_id: name, external_name: name, ingredient_id: validId, match_status:'needs_review' }
  })
  const dishes: Dish[] = recipes.map(recipe => {
    const parts = rows.filter(r=>r.recipe_id === recipe.recipe_id).sort((a,b)=>a.ingredient_seq-b.ingredient_seq)
    const metadata = publicData.recipes.find(r => r.recipe_id === recipe.recipe_id && r.recipe_name_ko === recipe.recipe_name_ko && r.ingredients.length === parts.length && r.ingredients.every((i,index)=>i.ingredient_name===parts[index].ingredient_name && i.ingredient_quantity===parts[index].ingredient_quantity && i.ingredient_seq===parts[index].ingredient_seq))
    const unresolved = parts.filter(p=>!links.find(l=>l.external_id===p.ingredient_name)?.ingredient_id).map(p=>p.ingredient_name)
    return {
      id:recipe.recipe_id, name_ko:recipe.recipe_name_ko, name_en:metadata?.recipe_name_en || recipe.recipe_name_ko,
      description_en:'Reference recipe. Actual ingredients vary by restaurant.', description_ko:'참고 레시피이며 실제 사용 재료는 매장마다 달라요.',
      category: metadata?.category === 'stew' ? 'stew' : 'rice', ingredient_ids:[], external_ingredient_ids:[...new Set(parts.map(p=>p.ingredient_name))],
      ingredients_complete:false, unmapped_ingredients:[...new Set(unresolved)],
      reference_ingredients:parts.map(p=>({ name:p.ingredient_name, quantity:p.ingredient_quantity || '', mapped:!!links.find(l=>l.external_id===p.ingredient_name)?.ingredient_id })),
      source_kind:metadata?'public':'reference', source_url:metadata?.source_dataset_url,
      raw_ingredients:metadata?.raw_ingredients,
      source_note:metadata?`식품의약품안전처 COOKRCP01 · ${recipe.recipe_id}. Official sample recipe. Ingredient-name links and allergen guidance need review. English name is an app translation.`:'Imported reference recipe. Recipe ingredients, name links and allergen guidance need review.'
    }
  })
  return { ...catalog, external_ingredient_master_mapping:links, dishes, recipe_data_origin:origin }
}
export function connectBundledRecipes(catalog: Catalog): Catalog {
  return connectRecipeRecords(catalog, publicData.recipes, publicData.recipes.flatMap(r=>r.ingredients.map(i=>({...i,recipe_id:r.recipe_id}))), [], 'bundled-public')
}
