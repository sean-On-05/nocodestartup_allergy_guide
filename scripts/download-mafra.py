#!/usr/bin/env python3
"""Download approved MAFRA recipe datasets from the registered computer.
Python 3.9+, standard library only. API key is prompted, never saved.
"""
import argparse
import csv
import getpass
import io
import json
import re
from pathlib import Path
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone

BASE_URL = 'http://211.237.50.150:7080/openapi'
DATASETS = {
    'recipes': ('Grid_20150827000000000226_1', ('RECIPE_ID',), 'https://www.data.go.kr/data/15057205/openapi.do'),
    'recipe_ingredients': ('Grid_20150827000000000227_1', ('RECIPE_ID', 'IRDNT_SN'), 'https://www.data.go.kr/data/15058981/openapi.do'),
}


class DownloadError(Exception):
    pass


def request_json(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'KFoodRecipeDownloader/1.0', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        raise DownloadError('HTTP %s: data provider request failed. Please retry later.' % error.code) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise DownloadError('Network request failed. Check your connection and try again.') from None
    try:
        return json.loads(raw.decode('utf-8-sig'))
    except (UnicodeError, ValueError):
        raise DownloadError('The provider did not return valid JSON. Please retry later.') from None


def download_dataset(key, grid, identity_fields, fetch=request_json, page_size=1000, progress=print):
    if not 1 <= page_size <= 1000:
        raise ValueError('page_size must be between 1 and 1000')
    result, seen = [], set()
    expected_total = None
    start = 1
    while True:
        end = start + page_size - 1
        # This is the HTTP endpoint published by MAFRA. The URL is never printed.
        url = '%s/%s/json/%s/%d/%d' % (BASE_URL, urllib.parse.quote(key, safe=''), grid, start, end)
        payload = fetch(url)
        data = payload.get(grid) if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise DownloadError('Unexpected provider response; no files were created.')
        status = data.get('result', {})
        code = status.get('code') if isinstance(status, dict) else None
        if code != 'INFO-000':
            if code == 'INFO-100':
                raise DownloadError('API authentication failed. Check your key, API approval and registered public IP.')
            if code == 'ERROR-335':
                raise DownloadError('A sample key cannot download the full dataset. Enter your own approved API key.')
            raise DownloadError('Provider returned an error (%s). Check the portal application status.' % (code if isinstance(code, str) and re.fullmatch(r'(INFO|ERROR)-[0-9]{3}',code) else 'unknown'))
        try:
            total = int(data['totalCnt'])
        except (KeyError, ValueError, TypeError):
            raise DownloadError('Missing provider record count.') from None
        if total < 0:
            raise DownloadError('Invalid provider record count.')
        if expected_total is None:
            expected_total = total
        elif total != expected_total:
            raise DownloadError('Dataset changed during download. Please rerun to get a consistent export.')
        rows = data.get('row', [])
        if isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise DownloadError('Invalid provider row format.')
        if not rows and len(result) < total:
            raise DownloadError('Download stopped before all records were received. No complete export was created.')
        if len(rows) > page_size:
            raise DownloadError('Provider returned more rows than requested.')
        for row in rows:
            identity = tuple(str(row.get(field, '')).strip() for field in identity_fields)
            if any(not value for value in identity) or identity in seen:
                raise DownloadError('Missing or duplicate record identifiers. Download aborted.')
            seen.add(identity)
            result.append(row)
        progress('  %s: %d / %d' % (grid, len(result), total))
        if len(result) == total:
            return result
        if len(result) > total:
            raise DownloadError('Provider record count mismatch.')
        start = end + 1


def csv_text(rows):
    fields = list(dict.fromkeys(k for row in rows for k in row))
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return '\ufeff' + output.getvalue()


def write_export(recipes, ingredients, output_dir):
    recipe_ids = {str(row['RECIPE_ID']) for row in recipes}
    orphans = [row for row in ingredients if str(row['RECIPE_ID']) not in recipe_ids]
    manifest = {
        'provider': '농림수산식품교육문화정보원 / 농림축산식품 공공데이터포털',
        'downloaded_at': datetime.now(timezone.utc).isoformat(),
        'recipes': len(recipes), 'recipe_ingredients': len(ingredients),
        'unlinked_recipe_ingredient_rows': len(orphans),
        'datasets': {name: info[2] for name, info in DATASETS.items()},
        'note': 'Source rows preserved. No allergen safety claims or automatic mappings have been added.',
    }
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    target = output_dir / ('kfood-mafra-%s.zip' % stamp)
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
        for name, rows in [('recipes', recipes), ('recipe_ingredients', ingredients)]:
            archive.writestr(name+'.json', json.dumps(rows, ensure_ascii=False, indent=2))
            archive.writestr(name+'.csv', csv_text(rows))
    return target


def main():
    parser = argparse.ArgumentParser(description='Download approved MAFRA recipe datasets without saving your API key.')
    parser.add_argument('--output', default=str(Path(__file__).resolve().parent / 'kfood-downloads'), help='Folder for the completed ZIP')
    args = parser.parse_args()
    print('K-Food recipe downloader / 공공 레시피 다운로드')
    print('Run on the PC whose public IP is registered with MAFRA.')
    print('등록한 IP의 PC에서 실행하세요. 인증키는 저장하지 않습니다.')
    print('Uses the provider-published HTTP endpoint. The key is sent to that provider, not to GitHub or Supabase.')
    key = getpass.getpass('MAFRA API key / 인증키 입력 (화면에 표시되지 않음): ').strip()
    if not key or key.lower() == 'sample':
        print('Enter your own approved API key, not the sample key.', file=sys.stderr)
        return 1
    try:
        recipes = download_dataset(key, *DATASETS['recipes'][:2])
        ingredients = download_dataset(key, *DATASETS['recipe_ingredients'][:2])
        target = write_export(recipes, ingredients, args.output)
    except DownloadError as error:
        print('ERROR: '+str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError, KeyError):
        print('Export could not be completed. Check the output folder and try again. Your API key was not saved.', file=sys.stderr)
        return 1
    print('\nSaved / 저장 완료: '+str(target))
    print('Upload this ZIP in our chat. It contains data, not the API key.')
    print('이 ZIP 파일을 채팅에 첨부해 주세요. 인증키는 포함되지 않습니다.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled. / 취소했습니다.', file=sys.stderr)
        sys.exit(1)
