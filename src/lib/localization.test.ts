import test from 'node:test'
import assert from 'node:assert/strict'
import recipes from '../../data/mafra-import/recipes.json'
import parts from '../../data/mafra-import/recipe-ingredients.json'
import samples from '../../data/public-recipes/mfds-sample.json'
import ingredientLabels from '../../data/translations/ingredient-names.en.json'
import { ingredientEnglish, recipeEnglish, quantityEnglish, cuisineEnglish, guidanceEnglish, hasKorean } from './localization'
import { normalizeIngredients } from './supabase'
import { connectRecipeRecords } from './recipes'
import { findRecipeOptions } from './vision'

test('all 537 imported recipe names and source ingredient names have English labels', () => {
  for (const r of recipes) {
    const name = recipeEnglish(r.RECIPE_NM_KO)
    assert.ok(!hasKorean(name) && !name.includes('awaiting translation'), r.RECIPE_NM_KO)
  }
  const names = [...parts.map(i=>i.IRDNT_NM), ...samples.recipes.flatMap(r=>r.ingredients.map(i=>i.ingredient_name))]
  for (const name of names) assert.ok(!hasKorean(ingredientEnglish(name)) && !ingredientEnglish(name).includes('awaiting translation'), name)
  assert.ok(Object.values(ingredientLabels).every(en=>en.trim() && !hasKorean(en)))
})
test('English labels and queries preserve source identity, quantities and unreviewed status', () => {
  const catalog = normalizeIngredients([{ id:'egg', ingredient_name:'달걀', global_allergens:['Egg'], verification_status:'needs_review', staff_request_ko:'달걀을 확인해주세요.' }])
  const linked = connectRecipeRecords(catalog, [{ recipe_id:'test', recipe_name_ko:'김치찌개' }], [{ recipe_id:'test', ingredient_seq:1, ingredient_name:'달걀', ingredient_quantity:'1개' }])
  assert.match(linked.ingredient_master[0].ingredient_name_en!, /^Eggs?$/)
  assert.equal(linked.ingredient_master[0].staff_request_ko, '달걀을 확인해주세요.')
  assert.equal(linked.ingredient_master[0].verification_status, 'needs_review')
  assert.deepEqual(linked.ingredient_master[0].global_allergens, ['Egg'])
  assert.equal(linked.dishes[0].reference_ingredients?.[0].name, '달걀')
  assert.equal(linked.dishes[0].reference_ingredients?.[0].quantity, '1개')
  assert.equal(linked.dishes[0].reference_ingredients?.[0].quantity_en, '1 item')
  assert.equal(findRecipeOptions(linked.dishes,'Kimchi stew')[0].id,'test')
  assert.equal(findRecipeOptions(linked.dishes,'김치찌개')[0].id,'test')
})
test('quantity localization preserves numeric source notation and does not guess malformed units', () => {
  assert.equal(quantityEnglish('1/2큰술'), '1/2 tbsp')
  assert.equal(quantityEnglish('1과1/2컵'), '1 + 1/2 cup')
  assert.equal(quantityEnglish('11/2큰술'), '11/2 tbsp')
  assert.equal(quantityEnglish('1/2물'), 'See original amount')
  assert.equal(quantityEnglish('약간'), 'a little')
  assert.equal(quantityEnglish('적당량'), 'as needed')
  assert.equal(quantityEnglish('2011-01-02'), '2011-01-02')
})
test('unknown future entries do not silently substitute Korean for English', () => {
  assert.equal(recipeEnglish('새로추가한요리'), 'Recipe name awaiting translation')
  assert.equal(ingredientEnglish('새로추가한재료'), 'Ingredient name awaiting translation')
  assert.equal(ingredientEnglish('새로추가한재료','Known English name'), 'Known English name')
  assert.equal(cuisineEnglish('한식'), 'Korean cuisine')
  assert.equal(cuisineEnglish('일본'), 'Japanese cuisine')
  assert.equal(cuisineEnglish('중국'), 'Chinese cuisine')
  assert.equal(guidanceEnglish('Wheat-flour rice cakes (밀떡) may be used.'), 'Wheat-flour rice cakes (wheat-flour tteok) may be used.')
})
