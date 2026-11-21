import type { Catalog, Dish, Ingredient, Profile } from './types'
export interface Finding { ingredient: Ingredient; allergenIds: string[]; reviewed: boolean; externalUncertain: boolean }
export interface Analysis { state: 'possible' | 'unconfirmed' | 'insufficient' | 'no-profile'; findings: Finding[]; ingredients: Ingredient[]; missing: boolean; requests: string[]; unknownAllergenIds: string[] }
export function analyzeDish(dish: Dish, profile: Profile, catalog: Catalog): Analysis {
  const ids = new Set(dish.ingredient_ids)
  const uncertain = new Set<string>()
  let missing = !dish.ingredients_complete
  for (const externalId of dish.external_ingredient_ids) {
    const mapping = catalog.external_ingredient_master_mapping.find(m => m.external_id === externalId)
    if (!mapping?.ingredient_id) { missing = true; continue }
    ids.add(mapping.ingredient_id)
    if (mapping.match_status === 'needs_review') { uncertain.add(mapping.ingredient_id); missing = true }
  }
  const ingredients = [...ids].map(id => catalog.ingredient_master.find(i => i.id === id)).filter((i): i is Ingredient => !!i)
  if (ingredients.length !== ids.size) missing = true
  const known = new Set(catalog.allergen_master.map(a => a.id))
  const unknownAllergenIds = profile.allergens.filter(id => !known.has(id))
  const findings = ingredients.flatMap(ingredient => {
    const mappings = catalog.ingredient_allergen_mapping.filter(m => m.ingredient_id === ingredient.id)
    const tags = new Set([...ingredient.global_allergens, ...mappings.map(m => m.allergen_id)])
    const allergenIds = profile.allergens.filter(id => tags.has(id))
    if (!allergenIds.length) return []
    return [{ ingredient, allergenIds, externalUncertain: uncertain.has(ingredient.id), reviewed: ingredient.verification_status === 'verified' && !uncertain.has(ingredient.id) && allergenIds.every(id => mappings.some(m => m.allergen_id === id && m.evidence_status === 'verified')) }]
  })
  const hasProfile = profile.allergens.length > 0 || !!profile.other.trim()
  const state = !hasProfile ? 'no-profile' : findings.length ? 'possible' : !ingredients.length || unknownAllergenIds.length > 0 || !!profile.other.trim() ? 'insufficient' : 'unconfirmed'
  const requests = [...new Set(findings.map(f => f.ingredient.staff_request_ko).filter(Boolean))]
  return { state, findings, ingredients, missing, requests, unknownAllergenIds }
}
export function restaurantMessage(profile: Profile, catalog: Catalog, analysis?: Analysis): string {
  const allergens = profile.allergens.map(id => catalog.allergen_master.find(a => a.id === id)?.name_ko || id)
  if (profile.other.trim()) allergens.push(profile.other.trim())
  if (!allergens.length) return ''
  return ['저는 다음 식품에 알레르기가 있습니다: '+allergens.join(', ')+'.',
    '이 음식의 재료, 양념, 소스, 육수에 해당 성분이 들어가거나 포함될 가능성이 있나요?',
    ...(analysis?.requests || []),
    '같은 조리 도구나 기름을 사용해 교차 접촉이 일어날 수 있는지도 확인해 주세요.',
    '확인이 어려우시면 모른다고 알려 주세요.'].join('\n\n')
}
