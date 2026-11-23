import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec=importlib.util.spec_from_file_location('download_mafra',Path(__file__).with_name('download-mafra.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class DownloadTests(unittest.TestCase):
    def test_paginate_and_preserve_ids(self):
        urls=[]
        def fetch(url):
            urls.append(url)
            start=int(url.split('/')[-2])
            rows=[{'RECIPE_ID':str(i),'RECIPE_NM_KO':'밥'} for i in range(start,min(start+2,6))]
            return {'grid':{'totalCnt':5,'result':{'code':'INFO-000'},'row':rows}}
        rows=module.download_dataset('private-test-key','grid',('RECIPE_ID',),fetch=fetch,page_size=2,progress=lambda _:None)
        self.assertEqual([r['RECIPE_ID'] for r in rows],['1','2','3','4','5'])
        self.assertEqual(len(urls),3)
    def test_error_does_not_echo_provider_message_or_key(self):
        def fetch(_): return {'grid':{'result':{'code':'INFO-100','message':'private-test-key'}}}
        with self.assertRaises(module.DownloadError) as caught:
            module.download_dataset('private-test-key','grid',('RECIPE_ID',),fetch=fetch)
        self.assertNotIn('private-test-key',str(caught.exception))
    def test_duplicate_or_incomplete_export_is_rejected(self):
        for rows in [[{'RECIPE_ID':'1'},{'RECIPE_ID':'1'}],[]]:
            with self.assertRaises(module.DownloadError):
                module.download_dataset('key','grid',('RECIPE_ID',),fetch=lambda _: {'grid':{'totalCnt':2,'result':{'code':'INFO-000'},'row':rows}},progress=lambda _:None)
    def test_changing_total_is_rejected(self):
        count=[0]
        def fetch(_):
            count[0]+=1
            return {'grid':{'totalCnt':2+count[0],'result':{'code':'INFO-000'},'row':[{'RECIPE_ID':str(count[0])}]}}
        with self.assertRaises(module.DownloadError):module.download_dataset('key','grid',('RECIPE_ID',),fetch=fetch,page_size=1,progress=lambda _:None)
    def test_zip_contains_source_data_and_no_key(self):
        with tempfile.TemporaryDirectory() as output:
            target=module.write_export([{'RECIPE_ID':'1','RECIPE_NM_KO':'밥'}],[{'RECIPE_ID':'1','IRDNT_SN':'1','IRDNT_NM':'쌀'}],output)
            with zipfile.ZipFile(target) as archive:
                self.assertEqual(len(archive.namelist()),5)
                manifest=json.loads(archive.read('manifest.json'))
                self.assertEqual(manifest['recipes'],1)
                self.assertEqual(manifest['unlinked_recipe_ingredient_rows'],0)
                for name in archive.namelist():self.assertNotIn('private-test-key',archive.read(name).decode('utf-8-sig'))

if __name__=='__main__':unittest.main()
