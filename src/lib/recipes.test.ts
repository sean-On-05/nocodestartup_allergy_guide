import test from 'node:test'
import assert from 'node:assert/strict'
import publicData from '../../data/public-recipes/mfds-sample.json'
import { normalizeIngredients } from './supabase'
import { connectBundledRecipes, connectRecipeRecords, resolveIngredient } from './recipes'
import { analyzeDish, restaurantMessage } from './analysis'
import type { Profile } from './types'
const fixture = normalizeIngredients([
  {id:'shrimp',ingredient_name:'칵테일새우',global_allergens:['Crustacean'],verification_status:'needs_review',staff_request_ko:'새우를 확인해 주세요.'},
  {id:'egg',ingredient_name:'달걀',global_allergens:['Egg'],verification_status:'needs_review'},
  {id:'cream',ingredient_name:'생크림',global_allergens:['Milk'],verification_status:'needs_review'},
  {id:'sugar',ingredient_name:'설탕',global_allergens:[],verification_status:'needs_review'}
])
const profile: Profile={language:'en',allergens:['Crustacean'],other:'',completed:true}
test('public sample preserves five actual recipes and all 36 source ingredients',()=>{
  const catalog=connectBundledRecipes(fixture)
  assert.equal(catalog.dishes.length,5)
  assert.equal(catalog.recipe_data_origin,'bundled-public')
  assert.equal(catalog.dishes.reduce((n,d)=>n+(d.reference_ingredients?.length||0),0),36)
  assert.ok(catalog.dishes.every(d=>d.source_kind==='public'&&d.source_url&&d.raw_ingredients&&!d.ingredients_complete))
  assert.ok(catalog.dishes.every(d=>!d.nutrition))
})
test('known shrimp tag triggers a possible finding while unmapped tofu and butter remain visible',()=>{
  const c=connectBundledRecipes(fixture), dish=c.dishes[0]
  const a=analyzeDish(dish,profile,c)
  assert.equal(a.state,'possible')
  assert.ok(dish.unmapped_ingredients?.includes('연두부'))
  assert.ok(dish.unmapped_ingredients?.includes('무염버터'))
  assert.ok(a.findings.every(f=>!f.reviewed))
  assert.match(restaurantMessage(profile,c,a),/무염버터/)
})
test('unmapped peanut ingredient is not erased or interpreted as allergen absence',()=>{
  const c=connectBundledRecipes(fixture), dish=c.dishes.find(d=>d.id==='mfds:32')!
  const a=analyzeDish(dish,{...profile,allergens:['Peanuts']},c)
  assert.equal(a.state,'insufficient')
  assert.ok(dish.reference_ingredients?.some(i=>i.name==='다진 땅콩'&&!i.mapped))
  assert.match(restaurantMessage({...profile,allergens:['Peanuts']},c,a),/다진 땅콩/)
})
test('exact identity takes precedence over whitespace-equivalent duplicate; ambiguous normalization stays unlinked',()=>{
  const c=normalizeIngredients([{id:'a',ingredient_name:'다진 마늘'},{id:'b',ingredient_name:'다진마늘'}])
  assert.equal(resolveIngredient('다진 마늘',c.ingredient_master)?.id,'a')
  assert.equal(resolveIngredient('다진  마늘',c.ingredient_master),undefined)
  assert.equal(resolveIngredient('마늘',c.ingredient_master),undefined)
})
test('an explicit null mapping is respected instead of overwritten by a guessed match',()=>{
  const c=connectRecipeRecords(fixture,[{recipe_id:'x',recipe_name_ko:'test'}],[{recipe_id:'x',ingredient_seq:1,ingredient_name:'달걀',ingredient_quantity:null}],[{source_ingredient_name:'달걀',ingredient_id:null,mapping_status:'needs_review'}])
  assert.deepEqual(c.dishes[0].unmapped_ingredients,['달걀'])
})
test('changing imported recipe ingredients does not borrow stale source text or attribution',()=>{
  const c=connectRecipeRecords(fixture,[{recipe_id:'mfds:28',recipe_name_ko:'새우 두부 계란찜'}],[{recipe_id:'mfds:28',ingredient_seq:1,ingredient_name:'설탕',ingredient_quantity:'20g'}])
  assert.equal(c.dishes[0].source_kind,'reference')
  assert.equal(c.dishes[0].raw_ingredients,undefined)
})
test('prepared data has noncolliding source-qualified IDs and deterministic ingredient sequences',()=>{
  assert.equal(new Set(publicData.recipes.map(r=>r.recipe_id)).size,5)
  for(const r of publicData.recipes) {
    assert.match(r.recipe_id,/^mfds:/)
    assert.deepEqual(r.ingredients.map(i=>i.ingredient_seq),r.ingredients.map((_,n)=>n+1))
    assert.ok(r.ingredients.every(i=>i.ingredient_name.trim()&&i.ingredient_quantity.trim()))
  }
})
