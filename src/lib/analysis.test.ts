import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeDish, restaurantMessage } from './analysis'
import { demoCatalog } from '../data/demo'
import { normalizeIngredients } from './supabase'
import { assertCatalog } from './catalog'
import type { Catalog, Dish, Profile } from './types'
const profile: Profile = { language:'en', allergens:['shrimp'], other:'', completed:true }
const stew = demoCatalog.dishes.find(d=>d.id==='kimchi-jjigae')!
const copy = (): Catalog => structuredClone(demoCatalog)
test('unreviewed external mapping preserves possible shrimp finding and staff question', () => {
  const result = analyzeDish(stew,profile,demoCatalog)
  assert.equal(result.state,'possible')
  const kimchi = result.findings.find(f=>f.ingredient.id==='kimchi')!
  assert.equal(kimchi.reviewed,false)
  assert.equal(kimchi.externalUncertain,true)
  assert.match(restaurantMessage(profile,demoCatalog,result),/새우젓/)
})
test('empty separate mapping table does not erase global allergen tags',()=>{
  const c=copy();c.ingredient_allergen_mapping=[]
  assert.equal(analyzeDish(stew,profile,c).state,'possible')
})
test('a matching external ingredient identity does not verify allergen evidence',()=>{
  const c=copy();c.external_ingredient_master_mapping[0].match_status='matched'
  assert.equal(analyzeDish(stew,profile,c).findings[0].reviewed,false)
})
test('no selected allergen found is unconfirmed, never safe, even for a complete recipe',()=>{
  const dish={...demoCatalog.dishes[5],ingredients_complete:true}
  assert.equal(analyzeDish(dish,profile,demoCatalog).state,'unconfirmed')
})
test('unknown free text remains insufficient and is included literally in staff card',()=>{
  const p={...profile,allergens:[],other:'pineapple'}
  assert.equal(analyzeDish(stew,p,demoCatalog).state,'insufficient')
  assert.match(restaurantMessage(p,demoCatalog),/pineapple/)
})
test('missing recipe references are marked missing and do not fabricate ingredients',()=>{
  const dish: Dish={...stew,ingredient_ids:['unknown'],external_ingredient_ids:['missing'],ingredients_complete:true}
  const result=analyzeDish(dish,profile,demoCatalog)
  assert.equal(result.missing,true);assert.equal(result.state,'insufficient');assert.equal(result.ingredients.length,0)
})
test('unknown saved allergen IDs prevent an unconfirmed absence interpretation',()=>{
  assert.equal(analyzeDish(stew,{...profile,allergens:['retired-tag']},demoCatalog).state,'insufficient')
})
test('an empty profile gets setup guidance and no empty personal staff claim',()=>{
  const p={...profile,allergens:[]}
  assert.equal(analyzeDish(stew,p,demoCatalog).state,'no-profile')
  assert.equal(restaurantMessage(p,demoCatalog),'')
})
test('nullable Supabase source is normalized; dietary label does not erase allergen tags',()=>{
  const c=normalizeIngredients([{id:'kimchi-live',ingredient_name:'김치',global_allergens:['Crustacean','Fish'],vegan_level:'Vegan',verification_status:'needs_review',source_note:null,staff_request_ko:'새우젓을 확인해 주세요.'}])
  assert.equal(c.ingredient_master[0].source_note,'')
  assert.equal(c.dishes.length,0)
  assert.equal(c.ingredient_allergen_mapping.length,0)
  assert.equal(c.allergen_master.find(a=>a.id==='Crustacean')?.name_ko,'갑각류 (새우 등)')
  assert.equal(c.ingredient_master[0].vegan_level,'Vegan')
  const result=analyzeDish({...stew,ingredient_ids:['kimchi-live'],external_ingredient_ids:[]},{...profile,allergens:['Crustacean']},c)
  assert.equal(result.state,'possible');assert.equal(result.findings[0].reviewed,false)
})
test('unsupported verification statuses become unknown rather than trusted',()=>{
  const c=normalizeIngredients([{id:'x',ingredient_name:'재료',verification_status:'approved'}])
  assert.equal(c.ingredient_master[0].verification_status,'unknown')
})
test('duplicate ingredient identity is rejected',()=>{
  assert.throws(()=>normalizeIngredients([{id:'x',ingredient_name:'A'},{id:'x',ingredient_name:'B'}]),/Duplicate/)
})
test('catalog rejects malformed arrays and misleading nutrition values',()=>{
  assert.throws(()=>assertCatalog({ingredient_master:[]}),/Missing/)
  const c=copy(); c.dishes[0].nutrition={kcal:-1,protein_g:2,carbs_g:3,source:'test'}
  assert.throws(()=>assertCatalog(c),/Invalid nutrition/)
  assert.doesNotThrow(()=>assertCatalog(demoCatalog))
})
