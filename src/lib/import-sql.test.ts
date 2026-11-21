import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const sql = await readFile(new URL('../../data/public-recipes/import-to-supabase.sql',import.meta.url),'utf8')
const schema=`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE ingredient_master(id uuid PRIMARY KEY,ingredient_name text NOT NULL);
CREATE TABLE external_recipes(recipe_id text PRIMARY KEY,recipe_name_ko text NOT NULL);
CREATE TABLE external_recipe_ingredients(recipe_id text REFERENCES external_recipes,ingredient_seq integer,ingredient_name text NOT NULL,ingredient_quantity text,ingredient_type_code text,ingredient_type_name text,PRIMARY KEY(recipe_id,ingredient_seq));
CREATE TABLE external_ingredient_master_mapping(source_ingredient_name text PRIMARY KEY,ingredient_id uuid REFERENCES ingredient_master,mapping_status text NOT NULL,notes text);
ALTER TABLE external_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_ingredient_master_mapping ENABLE ROW LEVEL SECURITY;
INSERT INTO ingredient_master VALUES
('00000000-0000-0000-0000-000000000001','칵테일새우'),
('00000000-0000-0000-0000-000000000002','다진 마늘'),
('00000000-0000-0000-0000-000000000003','다진마늘');
`
test('PostgreSQL import is idempotent and grants public read without public writes',async()=>{
  const db=new PGlite()
  try {
    await db.exec(schema)
    await db.exec(sql)
    await db.exec(sql)
    const counts=await db.query<{recipes:number;ingredients:number;sources:number}>(`SELECT (SELECT count(*)::int FROM external_recipes) AS recipes,(SELECT count(*)::int FROM external_recipe_ingredients) AS ingredients,(SELECT count(*)::int FROM kfood_public_recipe_sources) AS sources`)
    assert.deepEqual(counts.rows[0],{recipes:5,ingredients:36,sources:5})
    const mappings=await db.query<{ingredient_id:string;mapping_status:string}>(`SELECT ingredient_id,mapping_status FROM external_ingredient_master_mapping WHERE source_ingredient_name='다진 마늘'`)
    assert.equal(mappings.rows[0].ingredient_id,'00000000-0000-0000-0000-000000000002')
    assert.equal(mappings.rows[0].mapping_status,'needs_review')
    const unknown=await db.query<{ingredient_id:null}>(`SELECT ingredient_id FROM external_ingredient_master_mapping WHERE source_ingredient_name='연두부'`)
    assert.equal(unknown.rows[0].ingredient_id,null)
    await db.exec('SET ROLE anon')
    const read=await db.query<{count:number}>('SELECT count(*)::int FROM external_recipes')
    assert.equal(read.rows[0].count,5)
    await assert.rejects(db.exec(`INSERT INTO external_recipes VALUES('evil','write')`),/permission denied/)
    await db.exec('RESET ROLE')
  } finally { await db.close() }
})
test('required unknown columns stop import before any source or recipe data is inserted',async()=>{
  const db=new PGlite()
  try {
    await db.exec(schema+`ALTER TABLE external_recipes ADD COLUMN required_unknown text NOT NULL;`)
    await assert.rejects(db.exec(sql),/Required columns need values/)
    await db.exec('ROLLBACK')
    const count=await db.query<{count:number}>('SELECT count(*)::int FROM external_recipes')
    assert.equal(count.rows[0].count,0)
  } finally { await db.close() }
})
test('existing conflicting recipe IDs abort without changing user data',async()=>{
  const db=new PGlite()
  try {
    await db.exec(schema+`INSERT INTO external_recipes VALUES('mfds:28','Existing custom recipe');`)
    await assert.rejects(db.exec(sql),/Recipe ID collision/)
    await db.exec('ROLLBACK')
    const rows=await db.query<{recipe_name_ko:string}>('SELECT recipe_name_ko FROM external_recipes')
    assert.deepEqual(rows.rows,[{recipe_name_ko:'Existing custom recipe'}])
    const ingredients=await db.query<{count:number}>('SELECT count(*)::int FROM external_recipe_ingredients')
    assert.equal(ingredients.rows[0].count,0)
  } finally { await db.close() }
})
