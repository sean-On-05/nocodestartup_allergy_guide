# 전체 공공 레시피 DB 반영

업로드된 `kfood-mafra-20261123-134730-877050.zip`을 검사하고 Supabase 반영 파일을 준비했습니다. **운영 DB에 직접 실행한 것은 아닙니다.** 현재 받은 공개 키로는 관리자 SQL을 실행할 수 없습니다.

## 확인 결과

| 항목 | 결과 |
|---|---:|
| 원본 레시피 | 537개 |
| 한식 레시피 | 385개 |
| 기타 분류 레시피 | 152개 |
| 원본 재료 | 6,104행 |
| 음식과 연결되어 반영할 재료 | 5,933행 |
| 음식 정보가 없어 별도 보관한 재료 | 171행 |
| 반영 대상의 서로 다른 재료명 | 715종 |
| 기존 식재료 DB와 정확히 이름이 일치한 재료명 | 715종 |
| 중복 음식 ID / 중복 재료 키 | 0 / 0 |

한식 외 자료도 원본을 보존하기 위해 저장합니다. 재료 이름 일치는 알레르기 검증 완료가 아니며 모든 신규 연결은 `needs_review`입니다. 원본에 음식이 없는 재료 171행으로 가짜 음식 레코드를 만들지 않았습니다.

## 지금 할 일 — 작은 SQL 파일 3개를 순서대로 실행

기존 1.4MB 파일은 SQL Editor 크기 제한에 걸립니다. 직접 DB에 접속할 필요 없이 아래 세 파일을 각각 실행하세요. 각 파일은 UTF-8 기준 약 0.5MB이며 하나의 원자적 `DO` 블록으로 데이터를 반영합니다. `kfood_seed_payload` 임시 테이블은 사용하지 않습니다.

1. 파일을 열고 **Raw / View raw**를 눌러 전체 내용을 복사합니다.
2. Supabase → **SQL Editor → New query**에 붙여넣고 **Run**을 누릅니다.
3. 결과를 확인하고 다음 파일도 **새 쿼리**에서 실행합니다. 세 파일을 한 쿼리에 합치면 다시 크기 제한에 걸립니다.

| 순서 | 실행할 파일 | 완료 후 recipes | 완료 후 ingredients |
|---|---|---:|---:|
| 1 | [01-import.sql](../data/mafra-import/sql-editor/01-import.sql) | 179 | 2019 |
| 2 | [02-import.sql](../data/mafra-import/sql-editor/02-import.sql) | 358 | 3971 |
| 3 | [03-import.sql](../data/mafra-import/sql-editor/03-import.sql) | 537 | 5933 |

RLS 선택 창이 나오면 **Run and enable RLS**를 선택하세요. 공공 레시피를 읽는 정책이 포함돼 있습니다.

3번까지 성공한 뒤 웹앱을 새로고침하면 Supabase의 음식 데이터를 읽습니다. 김치찌개·불고기·비빔밥 등을 검색할 수 있습니다.

각 파일은 별도 세션에서 실행할 수 있습니다. 임시 테이블을 아예 만들지 않으며, 파일 사이에 열린 트랜잭션이나 세션 변수를 공유하지 않습니다. 실행 후 집계 쿼리는 저장된 행만 조회합니다. 같은 파일을 다시 실행해도 기존 행을 덮어쓰거나 중복 추가하지 않습니다. 중간 파일이 실패하면 성공한 이전 파일은 그대로 남으며, 오류를 해결한 뒤 실패한 파일부터 재실행할 수 있습니다. 마지막 집계가 537 / 5933이어야 전체 완료입니다.

기존 식약처 샘플 5개가 있다면 전체 음식 수는 542개가 될 수 있습니다. 위 결과는 이번 `epis:` 데이터만 셉니다. 기존 같은 ID의 음식명·재료 내용이 다르거나 알 수 없는 필수 컬럼이 있으면 해당 파일 전체 반영을 중단합니다. 오류 메시지를 공유하면 스키마에 맞게 조정할 수 있습니다.

운영 DB에는 아직 직접 반영하지 않았습니다.

## 무엇이 바뀌는가

- `external_recipes`: `epis:` 접두어가 있는 음식 537개 추가. `mfds:` 샘플과 구별합니다.
- `external_recipe_ingredients`: 연결 가능한 재료 5,933행 추가. 원본 순번·이름·분량·재료 분류 코드/이름을 보존합니다.
- `external_ingredient_master_mapping`: 신규 재료명에 대해 이름 일치 후보를 추가합니다. 기존 매핑은 덮어쓰지 않습니다. 실행 시점의 DB로 다시 비교하므로 나중에 DB가 바뀌어 유일한 일치가 없으면 null로 남습니다.
- `kfood_public_recipe_sources`: 각 음식의 출처·원본 기본정보·원본 재료 문구·식재료 목록·이용 조건을 보존합니다. 기존 테이블이 있으면 `source_record` JSONB 컬럼만 추가합니다.
- 이번 공공 데이터에 한정한 익명/로그인 사용자 **SELECT 정책**을 추가합니다. 공개 쓰기 정책은 추가하지 않으며 기존 테이블의 RLS를 끄지 않습니다.
- 기존 `ingredient_master`나 알레르기 근거 테이블은 변경하지 않습니다. 영양 수치는 분량 기준이 확정되지 않아 앱의 영양값으로 계산하지 않습니다.

## 파일

| 파일 | 용도 |
|---|---|
| `data/mafra-import/sql-editor/01-import.sql` ~ `03-import.sql` | SQL Editor에서 실행할 분할 SQL |
| `data/mafra-import/import-to-supabase.sql` | 전체 단일 파일. SQL Editor에는 붙여넣지 않음 |
| `external_recipes.csv` | 신규 음식 행, 수동 가져오기 참고용 |
| `external_recipe_ingredients.csv` | 신규 재료 행, 수동 가져오기 참고용 |
| `mapping-candidates.csv` | 정확한 이름 일치 후보 715종. 내부 UUID는 제외 |
| `quarantined-ingredients.csv` | 음식 정보가 없는 원본 재료 171행, 미반영 |
| `validation-report.json` | 검증 수치·원본 파일 SHA256·출처·다운로드 시각 |
| `recipes.json`, `recipe-ingredients.json` | 반영 대상의 원본 자료 |

수동 CSV 가져오기는 출처 저장과 조회 정책을 포함하지 않으므로 이번에는 SQL 실행을 권장합니다.

## 재현 및 검증

```sh
python scripts/prepare-mafra-import.py path/to/kfood-mafra.zip
# 현재 식재료 DB 스냅샷을 갖고 있다면 후보 보고서도 생성
python scripts/prepare-mafra-import.py path/to/kfood-mafra.zip --master path/to/ingredient-master.json
python -m unittest discover -s scripts -p 'test_*.py'
python scripts/split-mafra-sql.py
npm test
npm run build
```

스크립트는 DB에 쓰지 않습니다. 데이터 검증을 통과한 뒤 파일을 생성합니다. SQL은 기존 5개 샘플용 SQL 구조를 재사용해 만듭니다. PostgreSQL 호환 테스트 환경에서 전체 537개·5,933행 반영, 재실행 시 무중복, 기존 5개 샘플 보존, 재료 분류값 보존, 공개 읽기/쓰기 거부를 검증했습니다. 실제 프로젝트의 숨겨진 제약조건은 조회할 수 없으므로 운영 DB 실행은 별도 단계입니다.

## 출처

- [농림수산식품교육문화정보원 레시피 기본정보](https://www.data.go.kr/data/15057205/openapi.do)
- [농림수산식품교육문화정보원 레시피 재료정보](https://www.data.go.kr/data/15058981/openapi.do)

사용자가 승인된 API로 내려받은 원본을 사용합니다. 공공데이터포털의 이용허락범위는 제한 없음으로 확인한 자료입니다. 웹앱의 개인별 안내는 원본 레시피와 기존 검토 전 식재료 데이터를 결합한 참고 정보이며 식당별 실제 원재료나 교차 접촉의 안전을 보장하지 않습니다.

SQL Editor 크기 제한은 [Supabase 공식 소스](https://github.com/supabase/supabase/blob/4a73166675642dc3c1d1fc767a65adbee746d894/apps/studio/data/sql/execute-sql-mutation.ts)에서 확인했습니다. 분할 파일은 각각 600,000바이트 이하인지 검사하며, 세 파일 실행·세션 초기화·재실행·공개 읽기/쓰기 거부를 PostgreSQL 호환 환경에서 검증합니다.

임시 테이블 오류 수정: 이전 방식이 문장별 자동 커밋 실행에서 임시 테이블을 잃는 상황을 테스트로 재현했습니다. 수정 파일은 반영 `DO` 블록과 집계를 서로 다른 자동 커밋 요청으로 실행하고, 중간에 세션을 초기화해도 결과가 유지되는지 검증합니다. 실제 사용자 환경에서 어떤 문장들이 분리됐는지는 단정하지 않습니다.
