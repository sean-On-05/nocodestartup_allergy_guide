#!/usr/bin/env python3
"""Generate three independent SQL Editor-sized recipe imports. No database writes."""
import collections
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('prepare_mafra_import',ROOT/'scripts/prepare-mafra-import.py')
prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)

def generate(root=ROOT):
    data=root/'data/mafra-import'
    recipes=json.loads((data/'recipes.json').read_text())
    rows=json.loads((data/'recipe-ingredients.json').read_text())
    report=json.loads((data/'validation-report.json').read_text())
    by_recipe=collections.defaultdict(list)
    for row in rows:by_recipe[prepare.identity(row['RECIPE_ID'])].append(row)
    payload=prepare.normalize_payload(recipes,by_recipe,report['source_manifest']['downloaded_at'][:10])
    if len(payload)!=537 or sum(len(r['ingredients']) for r in payload)!=5933:
        raise ValueError('Expected this validated 537-recipe / 5933-ingredient export. Recheck batching for a different export.')
    output=data/'sql-editor';output.mkdir(parents=True,exist_ok=True)
    full_ids=','.join(prepare.quote(r['recipe_id']) for r in payload)
    total_sql=f"""\n-- Cumulative totals for this validated import (all three files together).
SELECT 'recipes' AS item,count(*) AS rows FROM public.external_recipes WHERE recipe_id IN ({full_ids})
UNION ALL SELECT 'ingredients',count(*) FROM public.external_recipe_ingredients WHERE recipe_id IN ({full_ids});
"""
    manifest=[]
    cumulative=0
    for index in range(3):
        batch=payload[index*179:(index+1)*179]
        count=sum(len(r['ingredients']) for r in batch);cumulative+=count
        sql=prepare.sql_import(batch,root/'data/public-recipes/import-to-supabase.sql')
        # Replace the final batch-only query with cumulative totals. Each file owns its BEGIN/COMMIT and temp table.
        sql=sql[:sql.index('-- Counts for just these source-qualified recipes;')]+total_sql
        sql=f"-- FILE {index+1} OF 3. Execute this entire file independently.\n-- Expected cumulative result after files 1..{index+1}: recipes={(index+1)*179}, ingredients={cumulative}.\n"+sql
        filename=f'{index+1:02d}-import.sql'
        size=len(sql.encode('utf-8'))
        if size>600000:raise ValueError('Batch exceeds conservative 600KB SQL Editor target.')
        (output/filename).write_text(sql)
        manifest.append({'file':filename,'bytes':size,'recipes_this_file':len(batch),'ingredients_this_file':count,'cumulative_recipes':(index+1)*179,'cumulative_ingredients':cumulative})
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    return manifest

if __name__=='__main__':print(json.dumps(generate(),indent=2))
