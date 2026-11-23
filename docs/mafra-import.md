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

## 지금 할 일 — SQL 한 번 실행

1. [전체 데이터 반영 SQL](../data/mafra-import/import-to-supabase.sql)을 엽니다. GitHub가 큰 파일을 표시하지 않으면 **Raw** 또는 **View raw**를 누르세요.
2. 전체 내용을 복사해 Supabase → **SQL Editor → New query**에 붙여넣고 **Run**을 누릅니다.
3. 마지막 결과가 `recipes = 537`, `ingredients = 5933`인지 확인합니다. 이 숫자는 이번 `epis:` 데이터만 셉니다.
4. 웹앱을 새로고침합니다. Supabase의 음식 데이터를 우선 읽고, 음식 검색에서 김치찌개·불고기·비빔밥 등을 찾을 수 있습니다.

기존 식약처 샘플 5개를 이미 반영했다면 전체 음식 수는 542개가 될 수 있습니다. SQL 결과의 537은 그 샘플과 구분한 이번 반영 건수입니다.

SQL은 중복 실행해도 같은 ID를 추가하지 않습니다. 기존 같은 ID의 음식명·재료 내용이 다르거나 알 수 없는 필수 컬럼이 있으면 전체 반영을 중단합니다. 오류가 나면 키나 비밀번호가 아닌 **오류 메시지**를 공유하면 됩니다.

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
| `data/mafra-import/import-to-supabase.sql` | 실제 반영용 SQL |
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
npm test
npm run build
```

스크립트는 DB에 쓰지 않습니다. 데이터 검증을 통과한 뒤 파일을 생성합니다. SQL은 기존 5개 샘플용 SQL 구조를 재사용해 만듭니다. PostgreSQL 호환 테스트 환경에서 전체 537개·5,933행 반영, 재실행 시 무중복, 기존 5개 샘플 보존, 재료 분류값 보존, 공개 읽기/쓰기 거부를 검증했습니다. 실제 프로젝트의 숨겨진 제약조건은 조회할 수 없으므로 운영 DB 실행은 별도 단계입니다.

## 출처

- [농림수산식품교육문화정보원 레시피 기본정보](https://www.data.go.kr/data/15057205/openapi.do)
- [농림수산식품교육문화정보원 레시피 재료정보](https://www.data.go.kr/data/15058981/openapi.do)

사용자가 승인된 API로 내려받은 원본을 사용합니다. 공공데이터포털의 이용허락범위는 제한 없음으로 확인한 자료입니다. 웹앱의 개인별 안내는 원본 레시피와 기존 검토 전 식재료 데이터를 결합한 참고 정보이며 식당별 실제 원재료나 교차 접촉의 안전을 보장하지 않습니다.
