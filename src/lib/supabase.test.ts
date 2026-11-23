import test from 'node:test'
import assert from 'node:assert/strict'
import { loadSupabaseCatalog } from './supabase'
test('Supabase recipe pagination respects actual returned rows when the server caps pages below the requested limit',async()=>{
  const original=globalThis.fetch
  const offsets:number[]=[]
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input)),name=url.pathname.split('/').pop()
    if(name==='ingredient_master')return new Response(JSON.stringify([{id:'rice',ingredient_name:'쌀',global_allergens:[],verification_status:'needs_review'}]))
    const all=name==='external_recipes'?Array.from({length:3},(_,n)=>({recipe_id:'epis:'+n,recipe_name_ko:'밥'+n})):name==='external_recipe_ingredients'?Array.from({length:3},(_,n)=>({recipe_id:'epis:'+n,ingredient_seq:1,ingredient_name:'쌀',ingredient_quantity:'1컵'})):[]
    const offset=Number(url.searchParams.get('offset'))
    if(name==='external_recipes')offsets.push(offset)
    const page=all.slice(offset,offset+1)
    return new Response(JSON.stringify(page),{headers:{'Content-Range':page.length?`${offset}-${offset}/${all.length}`:'*/0'}})
  }
  try {
    const catalog=await loadSupabaseCatalog(undefined,{url:'https://example.test',publishableKey:'test-key'})
    assert.equal(catalog.dishes.length,3)
    assert.equal(catalog.recipe_data_origin,'supabase')
    assert.deepEqual(offsets,[0,1,2])
  } finally {globalThis.fetch=original}
})
