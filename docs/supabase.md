# Supabase 연동 현황과 다음 단계

## 확인한 API 범위

공개 키로 `GET /rest/v1/ingredient_master`를 실제 조회했습니다. 앱은 아래 필드만 요청합니다.

```
id, ingredient_name, global_allergens, vegan_level, diet_categories,
hidden_warning_en, staff_request_ko, user_notice_en, verification_status, source_note
```

- `id`는 UUID 문자열입니다.
- `source_note`는 null일 수 있으므로 빈 문자열로 정규화합니다.
- 태그 배열은 대소문자를 보존합니다. 예: `Crustacean`, `Peanuts`, `Tree Nuts`, `Gluten`.
- 모든 반환 데이터는 검토 전 상태로 확인되었습니다. 확인하지 못한 상태값은 `unknown`으로 처리합니다.
- API 조회 실패나 0건 반환을 정상적인 “알레르기 없음”으로 해석하지 않습니다.
- 음식 테이블은 사용자가 비어 있다고 확인했습니다. 추가 권한 문제라고 단정하지 않습니다. 공공 샘플 5개로 화면을 우선 연결하고 반영용 SQL을 준비했습니다.

## 음식 데이터 위치를 모를 때

Supabase SQL Editor에서 아래 쿼리를 실행해 테이블과 컬럼 목록을 공유하면 됩니다. 데이터는 변경하지 않습니다.

```sql
select table_name,
       string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;
```

상세 타입·관계·RLS가 필요하면 `inspect-schema.sql`을 실행하세요. 키·비밀번호·개인정보를 포함하지 않습니다.

캡처로 확인한 `external_recipes`, `external_recipe_ingredients`, `external_ingredient_master_mapping`을 읽는 어댑터를 추가했습니다. 이들이 비어 있으면 공식 공공 샘플을 명시해 보여줍니다. 실제 식재료 DB와 이름을 대조하며 레시피를 만들어내지 않습니다. [공공데이터 반영 안내](public-data.md)를 참고하세요. 운영 DB에는 테이블 생성이나 정책 변경을 실행하지 않았습니다.

## 공개 조회 정책

현재 `ingredient_master` 조회는 성공했습니다. 다른 테이블이 필요한 경우 소유자가 Table Editor/Authentication Policies에서 테이블의 역할 권한과 RLS SELECT 정책을 확인해야 합니다. 서비스 키로 우회하거나 RLS를 일괄 해제하지 마세요. 사용자에게 공개해도 되는 데이터만 SELECT할 수 있도록 범위를 정하세요.

## 선택적 백엔드 계약

추후 서버 어댑터를 사용하는 경우 `GET {VITE_API_BASE_URL}/catalog`는 `src/lib/types.ts`의 `Catalog` 구조를 반환합니다. UUID·외부 ID를 보존하고 상태를 검토 완료로 임의 승격하지 마세요. 음식 레코드의 `ingredients_complete`는 실제 근거가 있을 때만 true로 설정하며, true여도 교차 접촉과 식당별 레시피의 안전을 보장하지 않습니다.

사진 인식은 별도 서버 API로 연결해야 합니다. 모델 키는 서버 환경 변수로 보관하고, 사용자 확인 단계를 유지하세요. 현재는 업로드하지 않고 브라우저 미리보기만 제공합니다.
