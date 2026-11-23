import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec=importlib.util.spec_from_file_location('prepare_mafra_import',Path(__file__).with_name('prepare-mafra-import.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PrepareTests(unittest.TestCase):
    def archive(self,root,duplicate=False):
        recipes=[{'RECIPE_ID':1,'RECIPE_NM_KO':'밥','NATION_NM':'한식'}]
        parts=[{'RECIPE_ID':1,'IRDNT_SN':1,'IRDNT_NM':'쌀','IRDNT_CPCTY':'1컵','IRDNT_TY_CODE':'3060001','IRDNT_TY_NM':'주재료'},
               {'RECIPE_ID':99,'IRDNT_SN':1,'IRDNT_NM':'우유','IRDNT_CPCTY':'1컵','IRDNT_TY_CODE':'','IRDNT_TY_NM':''}]
        if duplicate:parts.append(copy.deepcopy(parts[0]))
        archive=Path(root)/'input.zip'
        with zipfile.ZipFile(archive,'w') as z:
            for name,data in [('manifest.json',{'recipes':1,'recipe_ingredients':len(parts),'unlinked_recipe_ingredient_rows':1,'downloaded_at':'2026-11-23T00:00:00Z'}),('recipes.json',recipes),('recipe_ingredients.json',parts)]:z.writestr(name,json.dumps(data))
        return archive
    def test_orphans_are_quarantined_and_source_qualified_ids_used(self):
        with tempfile.TemporaryDirectory() as d:
            report=m.prepare(self.archive(d),Path(d)/'output',[{'id':'uuid','ingredient_name':'쌀'}])
            self.assertEqual(report['ingredient_rows_imported'],1)
            self.assertEqual(report['ingredient_rows_quarantined'],1)
            self.assertEqual(report['name_matches'],{'exact':1})
            sql=(Path(d)/'output/import-to-supabase.sql').read_text()
            self.assertIn('epis:1',sql);self.assertNotIn('epis:99',sql)
            self.assertIn('needs_review',sql)
            self.assertIn('우유',(Path(d)/'output/quarantined-ingredients.csv').read_text())
    def test_duplicate_source_rows_abort(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError,'Duplicate recipe ingredient'):m.validate_export(self.archive(d,True))
    def test_confusable_normalized_names_remain_unmatched(self):
        report=m.match_report(['다진  마늘'],[{'id':'a','ingredient_name':'다진 마늘'},{'id':'b','ingredient_name':'다진마늘'}])
        self.assertEqual(report[0]['proposed_ingredient_id'],'')
        self.assertEqual(report[0]['mapping_status'],'needs_review')
if __name__=='__main__':unittest.main()
