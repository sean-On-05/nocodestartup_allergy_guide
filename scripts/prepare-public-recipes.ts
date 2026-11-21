import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data/public-recipes')
const payload=JSON.parse(await readFile(path.join(dir,'mfds-sample.json'),'utf8'))
const recipes=payload.recipes as {recipe_id:string;recipe_name_ko:string;source_url:string;source_dataset_url:string;provider:string;license:string;raw_ingredients:string;retrieved_on:string;ingredients:{ingredient_seq:number;ingredient_name:string;ingredient_quantity:string}[]}[]
const q=(s:string)=>"'"+s.replace(/'/g,"''")+"'"
const ids=recipes.map(r=>q(r.recipe_id)).join(',')
const names=[...new Set(recipes.flatMap(r=>r.ingredients.map(i=>i.ingredient_name)))]
const sql=`-- K-Food: official MFDS sample, 5 recipes / 36 ingredient rows.
-- Run once in Supabase SQL Editor as project owner. Re-running does not overwrite existing rows.
-- Source: https://www.data.go.kr/data/15060073/openapi.do
-- License: 이용허락범위 제한 없음. All ingredient links remain needs_review.
-- Existing ingredient_master and allergen evidence are NOT updated.
-- No DELETE, UPDATE, service key, or public write policy is used.
BEGIN;

-- Fail atomically if a required, unknown column would prevent import.
DO $$
DECLARE r record; unexpected text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('external_recipes',ARRAY['recipe_id','recipe_name_ko']::text[]),
    ('external_recipe_ingredients',ARRAY['recipe_id','ingredient_seq','ingredient_name','ingredient_quantity','ingredient_type_code','ingredient_type_name']::text[]),
    ('external_ingredient_master_mapping',ARRAY['source_ingredient_name','ingredient_id','mapping_status','notes']::text[])
  ) AS t(table_name,cols)
  LOOP
    IF to_regclass('public.'||r.table_name) IS NULL THEN RAISE EXCEPTION 'Missing table: %',r.table_name; END IF;
    SELECT string_agg(c.column_name,', ') INTO unexpected FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=r.table_name AND c.is_nullable='NO'
      AND c.column_default IS NULL AND c.is_identity='NO' AND c.is_generated='NEVER'
      AND NOT(c.column_name=ANY(r.cols));
    IF unexpected IS NOT NULL THEN RAISE EXCEPTION 'Schema check: %. Required columns need values: %',r.table_name,unexpected; END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE kfood_seed_payload(data jsonb) ON COMMIT DROP;
INSERT INTO kfood_seed_payload VALUES (${q(JSON.stringify(recipes))}::jsonb);

-- Refuse collisions rather than mix our seed into an existing, different recipe.
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM kfood_seed_payload p CROSS JOIN LATERAL jsonb_array_elements(p.data) r
    JOIN public.external_recipes e ON e.recipe_id=r->>'recipe_id'
    WHERE e.recipe_name_ko IS DISTINCT FROM r->>'recipe_name_ko'
  ) THEN RAISE EXCEPTION 'Recipe ID collision: existing name differs. No data changed.'; END IF;
  IF EXISTS(
    SELECT 1 FROM kfood_seed_payload p CROSS JOIN LATERAL jsonb_array_elements(p.data) r
    CROSS JOIN LATERAL jsonb_array_elements(r->'ingredients') i
    JOIN public.external_recipe_ingredients e ON e.recipe_id=r->>'recipe_id' AND e.ingredient_seq=(i->>'ingredient_seq')::integer
    WHERE e.ingredient_name IS DISTINCT FROM i->>'ingredient_name'
       OR e.ingredient_quantity IS DISTINCT FROM i->>'ingredient_quantity'
  ) THEN RAISE EXCEPTION 'Recipe ingredient collision: existing content differs. No data changed.'; END IF;
END $$;

INSERT INTO public.external_recipes(recipe_id,recipe_name_ko)
SELECT r->>'recipe_id',r->>'recipe_name_ko'
FROM kfood_seed_payload p CROSS JOIN LATERAL jsonb_array_elements(p.data) r
ON CONFLICT(recipe_id) DO NOTHING;

INSERT INTO public.external_recipe_ingredients(recipe_id,ingredient_seq,ingredient_name,ingredient_quantity,ingredient_type_code,ingredient_type_name)
SELECT r->>'recipe_id',(i->>'ingredient_seq')::integer,i->>'ingredient_name',i->>'ingredient_quantity',NULL,NULL
FROM kfood_seed_payload p CROSS JOIN LATERAL jsonb_array_elements(p.data) r
CROSS JOIN LATERAL jsonb_array_elements(r->'ingredients') i
ON CONFLICT(recipe_id,ingredient_seq) DO NOTHING;

-- Exact name first. Whitespace-only equivalence is accepted only when unique.
-- No synonyms, substring matching, or clinical inference.
WITH names AS (
  SELECT DISTINCT i->>'ingredient_name' AS name
  FROM kfood_seed_payload p CROSS JOIN LATERAL jsonb_array_elements(p.data) r
  CROSS JOIN LATERAL jsonb_array_elements(r->'ingredients') i
), candidates AS (
  SELECT n.name,
    CASE WHEN count(*) FILTER(WHERE im.ingredient_name=n.name)=1
      THEN min(im.id::text) FILTER(WHERE im.ingredient_name=n.name)::uuid
      WHEN count(*) FILTER(WHERE im.ingredient_name=n.name)=0 AND count(im.id)=1
      THEN min(im.id::text)::uuid ELSE NULL END AS ingredient_id
  FROM names n LEFT JOIN public.ingredient_master im
    ON regexp_replace(im.ingredient_name,'[[:space:]]','','g')=regexp_replace(n.name,'[[:space:]]','','g')
  GROUP BY n.name
)
INSERT INTO public.external_ingredient_master_mapping(source_ingredient_name,ingredient_id,mapping_status,notes)
SELECT name,ingredient_id,'needs_review',
  CASE WHEN ingredient_id IS NULL THEN 'No unique name match. Do not infer allergen absence. '
       ELSE 'Name identity match only. Product composition and allergen evidence need review. ' END
  || 'MFDS COOKRCP01 sample; https://www.data.go.kr/data/15060073/openapi.do'
FROM candidates ON CONFLICT(source_ingredient_name) DO NOTHING;

-- Keep raw ingredients, license and attribution alongside imported records.
CREATE TABLE IF NOT EXISTS public.kfood_public_recipe_sources(
  recipe_id text PRIMARY KEY, provider text NOT NULL, source_url text NOT NULL,
  dataset_url text NOT NULL, license_note text NOT NULL, raw_ingredients text NOT NULL,
  retrieved_on date NOT NULL, verification_status text NOT NULL DEFAULT 'needs_review'
);
INSERT INTO public.kfood_public_recipe_sources(recipe_id,provider,source_url,dataset_url,license_note,raw_ingredients,retrieved_on)
SELECT r->>'recipe_id',r->>'provider',r->>'source_url',r->>'source_dataset_url',r->>'license',r->>'raw_ingredients',(r->>'retrieved_on')::date
FROM kfood_seed_payload p CROSS JOIN LATERAL jsonb_array_elements(p.data) r
ON CONFLICT(recipe_id) DO NOTHING;
ALTER TABLE public.kfood_public_recipe_sources ENABLE ROW LEVEL SECURITY;

-- Read only these public seed records. No existing RLS setting is disabled.
DO $$
BEGIN
${['external_recipes','external_recipe_ingredients','kfood_public_recipe_sources'].map(table=>`  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='${table}' AND policyname='kfood_public_seed_read') THEN
    CREATE POLICY kfood_public_seed_read ON public.${table} FOR SELECT TO anon,authenticated USING(recipe_id IN (${ids}));
  END IF;`).join('\n')}
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_ingredient_master_mapping' AND policyname='kfood_public_seed_read') THEN
    CREATE POLICY kfood_public_seed_read ON public.external_ingredient_master_mapping FOR SELECT TO anon,authenticated USING(source_ingredient_name IN (${names.map(q).join(',')}));
  END IF;
END $$;
GRANT SELECT ON public.external_recipes,public.external_recipe_ingredients,public.external_ingredient_master_mapping,public.kfood_public_recipe_sources TO anon,authenticated;
COMMIT;

-- Counts for just these source-qualified recipes; recipe=5, ingredients=36 on an empty target.
SELECT 'recipes' AS item,count(*) AS rows FROM public.external_recipes WHERE recipe_id IN (${ids})
UNION ALL SELECT 'ingredients',count(*) FROM public.external_recipe_ingredients WHERE recipe_id IN (${ids});
`
await writeFile(path.join(dir,'import-to-supabase.sql'),sql)
console.log('Prepared idempotent import SQL for 5 official sample recipes. Database has not been modified.')
