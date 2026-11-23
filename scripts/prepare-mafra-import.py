#!/usr/bin/env python3
"""Validate a downloader ZIP and prepare an additive Supabase import. No DB writes."""
import argparse
import collections
import csv
import hashlib
import io
import json
from pathlib import Path
import unicodedata
import zipfile

BASIC_SOURCE='https://www.data.go.kr/data/15057205/openapi.do'
PART_SOURCE='https://www.data.go.kr/data/15058981/openapi.do'


def quote(value):
    return "'"+value.replace("'","''")+"'"


def identity(value):
    if isinstance(value,bool) or not isinstance(value,(int,str)) or not str(value).isdigit() or int(value)<=0:
        raise ValueError('Source identifiers must be positive integers.')
    return str(int(value))


def text(value):
    if not isinstance(value,str) or '\x00' in value:
        raise ValueError('Invalid source text.')
    return value


def validate_export(archive):
    with zipfile.ZipFile(archive) as z:
        names=z.namelist()
        for name in ['manifest.json','recipes.json','recipe_ingredients.json']:
            if names.count(name)!=1 or z.getinfo(name).file_size>20*1024*1024:
                raise ValueError('Missing, duplicated or oversized JSON file.')
        manifest=json.loads(z.read('manifest.json'))
        recipes=json.loads(z.read('recipes.json'))
        ingredients=json.loads(z.read('recipe_ingredients.json'))
    if not isinstance(manifest,dict) or not isinstance(recipes,list) or not isinstance(ingredients,list):
        raise ValueError('Invalid export structure.')
    if not recipes or manifest.get('recipes')!=len(recipes) or manifest.get('recipe_ingredients')!=len(ingredients):
        raise ValueError('Export counts do not agree with the manifest.')
    ids=set()
    for r in recipes:
        rid=identity(r['RECIPE_ID'])
        if rid in ids or not text(r['RECIPE_NM_KO']).strip():
            raise ValueError('Duplicate recipe ID or empty recipe name.')
        ids.add(rid)
        for k,v in r.items():
            if k!='RECIPE_ID' and not isinstance(v,(str,int,float,type(None))):raise ValueError('Invalid recipe field.')
    keys=set();valid=[];orphans=[]
    for row in ingredients:
        rid,seq=identity(row['RECIPE_ID']),identity(row['IRDNT_SN'])
        if (rid,seq) in keys:raise ValueError('Duplicate recipe ingredient key.')
        keys.add((rid,seq))
        if not text(row['IRDNT_NM']).strip():raise ValueError('Empty ingredient name.')
        text(row.get('IRDNT_CPCTY',''))
        for k in ['IRDNT_TY_CODE','IRDNT_TY_NM']:text(row.get(k,''))
        (valid if rid in ids else orphans).append(row)
    if manifest.get('unlinked_recipe_ingredient_rows')!=len(orphans):
        raise ValueError('Orphan count does not agree with manifest.')
    by_recipe=collections.defaultdict(list)
    for row in valid:by_recipe[identity(row['RECIPE_ID'])].append(row)
    missing=[rid for rid in ids if not by_recipe[rid]]
    if missing:raise ValueError('Recipes with no ingredient records: '+', '.join(sorted(missing)))
    return manifest,recipes,valid,orphans,by_recipe


def normalize_payload(recipes,by_recipe,retrieved_on):
    payload=[]
    for recipe in recipes:
        rid=identity(recipe['RECIPE_ID'])
        parts=[{'ingredient_seq':int(p['IRDNT_SN']),'ingredient_name':p['IRDNT_NM'],
                'ingredient_quantity':p.get('IRDNT_CPCTY',''),
                'ingredient_type_code':p.get('IRDNT_TY_CODE',''),
                'ingredient_type_name':p.get('IRDNT_TY_NM','')}
               for p in sorted(by_recipe[rid],key=lambda p:int(p['IRDNT_SN']))]
        payload.append({'recipe_id':'epis:'+rid,'recipe_name_ko':recipe['RECIPE_NM_KO'],
                        'provider':'농림수산식품교육문화정보원','source_url':BASIC_SOURCE,
                        'source_dataset_url':BASIC_SOURCE,'license':'이용허락범위 제한 없음',
                        'retrieved_on':retrieved_on,'raw_ingredients':'\n'.join(p['ingredient_name']+' '+p['ingredient_quantity'] for p in parts),
                        'source_recipe':recipe,'ingredients':parts})
    return payload


def match_report(names,master):
    norm=lambda s:''.join(unicodedata.normalize('NFKC',s).split())
    report=[]
    for name in names:
        exact=[m for m in master if m.get('ingredient_name')==name]
        equivalent=exact if exact else [m for m in master if norm(str(m.get('ingredient_name','')))==norm(name)]
        matched=equivalent[0] if len(equivalent)==1 else None
        report.append({'source_ingredient_name':name,'proposed_ingredient_id':matched['id'] if matched else '',
                       'name_match':'exact' if matched and exact else 'whitespace_only' if matched else 'unmatched_or_ambiguous',
                       'mapping_status':'needs_review'})
    return report


def csv_output(path,rows,fields=None):
    fields=fields or list(dict.fromkeys(k for row in rows for k in row))
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');w.writeheader();w.writerows(rows)


def sql_import(payload,template):
    # Reuse the already-tested additive sample importer, replacing only data and EPIS-specific fields.
    ids=','.join(quote(r['recipe_id']) for r in payload)
    names=sorted({i['ingredient_name'] for r in payload for i in r['ingredients']})
    old=json.loads((template.parent/'mfds-sample.json').read_text())['recipes']
    old_ids=','.join(quote(r['recipe_id']) for r in old)
    old_names=list(dict.fromkeys(i['ingredient_name'] for r in old for i in r['ingredients']))
    s=template.read_text()
    start=s.index('INSERT INTO kfood_seed_payload VALUES (')
    end=s.index(';',start)+1
    # Existing payload is one SQL literal; locate the terminator safely rather than splitting source text.
    end=s.index('::jsonb);',start)+len('::jsonb);')
    s=s[:start]+'INSERT INTO kfood_seed_payload VALUES ('+quote(json.dumps(payload,ensure_ascii=False,separators=(',',':')))+'::jsonb);'+s[end:]
    s=s.replace('official MFDS sample, 5 recipes / 36 ingredient rows.',f'EPIS import: {len(payload)} recipes / {sum(len(r["ingredients"]) for r in payload)} ingredient rows. Orphan rows are quarantined separately.')
    s=s.replace('https://www.data.go.kr/data/15060073/openapi.do',BASIC_SOURCE)
    s=s.replace('MFDS COOKRCP01 sample;','EPIS recipe name identity only;')
    s=s.replace(",i->>'ingredient_quantity',NULL,NULL", ",i->>'ingredient_quantity',NULLIF(i->>'ingredient_type_code',''),NULLIF(i->>'ingredient_type_name','')")
    s=s.replace(old_ids,ids)
    s=s.replace(','.join(quote(n) for n in old_names),','.join(quote(n) for n in names))
    policy='kfood_epis_'+hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:10]+'_read'
    s=s.replace('kfood_public_seed_read',policy)
    source_insert='INSERT INTO public.kfood_public_recipe_sources(recipe_id,provider,source_url,dataset_url,license_note,raw_ingredients,retrieved_on)'
    s=s.replace(source_insert,"ALTER TABLE public.kfood_public_recipe_sources ADD COLUMN IF NOT EXISTS source_record jsonb;\n"+source_insert[:-1]+',source_record)')
    s=s.replace("r->>'raw_ingredients',(r->>'retrieved_on')::date", "r->>'raw_ingredients',(r->>'retrieved_on')::date,jsonb_build_object('recipe',r->'source_recipe','ingredients',r->'ingredients')")
    s=s.replace('recipe=5, ingredients=36 on an empty target.',f'recipe={len(payload)}, ingredients={sum(len(r["ingredients"]) for r in payload)} on an empty EPIS namespace.')
    return s


def prepare(archive,output_dir,master=None,template=None):
    manifest,recipes,valid,orphans,by_recipe=validate_export(archive)
    date=manifest['downloaded_at'][:10]
    payload=normalize_payload(recipes,by_recipe,date)
    names=sorted({p['IRDNT_NM'] for p in valid})
    report=match_report(names,master) if master is not None else []
    output=Path(output_dir);output.mkdir(parents=True,exist_ok=True)
    source_hash=hashlib.sha256(Path(archive).read_bytes()).hexdigest()
    summary={'source_sha256':source_hash,'source_manifest':manifest,'recipes':len(recipes),
             'korean_recipes':sum(r.get('NATION_NM')=='한식' for r in recipes),
             'other_cuisine_recipes':sum(r.get('NATION_NM')!='한식' for r in recipes),
             'ingredient_rows_imported':len(valid),'ingredient_rows_quarantined':len(orphans),
             'unique_ingredient_names':len(names),'duplicate_recipe_ids':0,'duplicate_ingredient_keys':0,
             'name_matches':dict(collections.Counter(m['name_match'] for m in report)),
             'all_mapping_status':'needs_review','database_writes_performed':False,
             'raw_source_counts':{'recipes':len(recipes),'ingredients':len(valid)+len(orphans)},
             'cuisines':dict(collections.Counter(r.get('NATION_NM','') for r in recipes)),
             'quarantined_recipe_ids':sorted({int(p['RECIPE_ID']) for p in orphans})}
    for name,value in [('validation-report.json',summary),('recipes.json',recipes),('recipe-ingredients.json',valid)]:
        (output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    csv_output(output/'quarantined-ingredients.csv',orphans,['ROW_NUM','RECIPE_ID','IRDNT_SN','IRDNT_NM','IRDNT_CPCTY','IRDNT_TY_CODE','IRDNT_TY_NM'])
    csv_output(output/'external_recipes.csv',[{'recipe_id':r['recipe_id'],'recipe_name_ko':r['recipe_name_ko']} for r in payload])
    csv_output(output/'external_recipe_ingredients.csv',[{'recipe_id':r['recipe_id'],**i} for r in payload for i in r['ingredients']])
    if report:csv_output(output/'mapping-candidates.csv',[{k:r[k] for k in ['source_ingredient_name','name_match','mapping_status']} for r in report])
    template=template or Path(__file__).resolve().parent.parent/'data/public-recipes/import-to-supabase.sql'
    (output/'import-to-supabase.sql').write_text(sql_import(payload,Path(template)))
    return summary


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive',type=Path);p.add_argument('--output',type=Path,default=Path(__file__).resolve().parent.parent/'data/mafra-import')
    p.add_argument('--master',type=Path,help='Optional read-only ingredient_master snapshot for candidate report')
    args=p.parse_args()
    try:
        master=json.loads(args.master.read_text()) if args.master else None
        result=prepare(args.archive,args.output,master)
    except (ValueError,KeyError,TypeError,zipfile.BadZipFile,OSError) as error:
        p.exit(1,'Import preparation failed: '+str(error)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
