# K-Food Allergy Guide

외국인을 위한 한국 음식·식재료 알레르기 안내 웹앱. 제공된 모바일 와이어프레임을 기준으로 새로 구현한 React + TypeScript + Vite 프로젝트입니다. 기존 Hansang 프로토타입 소스를 사용하지 않습니다.

## 전체 공공데이터 반영

업로드된 전체 자료를 검사해 **레시피 537개(한식 385개), 연결 재료 5,933행**의 반영용 SQL을 준비했습니다. 부모 음식이 없는 재료 171행은 별도로 보관합니다. 식재료명 715종은 현재 마스터와 정확히 일치하지만 연결은 모두 검토 전입니다. 운영 DB에 직접 쓰지는 않았습니다.

[전체 데이터 반영 안내](docs/mafra-import.md) · [SQL Editor용 분할 파일 3개](data/mafra-import/sql-editor/README.md)

## Vercel 배포

[Vercel 배포 안내](docs/deploy-vercel.md)에 따라 이 저장소를 Import하고 Supabase 공개 환경 변수 두 개를 등록하세요. `vercel.json`에 Vite 빌드 설정이 포함되어 있습니다. 사진 AI는 배포 후 Gemini 무료 등급으로 연결할 예정이며 아직 활성화되지 않았습니다.

## 실행

```sh
npm ci
cp .env.example .env.local
# .env.local에 Supabase Publishable key 입력
npm run dev
```

```sh
npm test
npm run build
npm run preview
# 실제 DB 읽기 연결 검사 (환경 설정 후)
npm run check:connection
```

Node.js 22.12+ 또는 24를 사용하세요. 환경 변수가 없으면 명확히 표시된 예시 모드로 실행합니다. 실제 DB 조회에 실패했을 때는 예시로 자동 대체하지 않습니다.

## Supabase 연결

- `VITE_SUPABASE_URL`: 프로젝트 주소.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_…` 공개 키 또는 기존 anon 키. GitHub에 커밋하지 말고 개발/배포 환경 변수로 설정하세요.
- **service_role, sb_secret 키, DB 비밀번호를 프론트엔드에 넣지 마세요.** 프론트엔드 환경 변수는 빌드 결과에서 공개됩니다.
- 앱은 Supabase REST API로 `ingredient_master`의 필요한 컬럼만 읽습니다. 500개 단위로 페이지네이션하며, DB 쓰기·로그인·사진 업로드 요청은 하지 않습니다.
- 공개 조회에는 적절한 grants/RLS SELECT 정책이 필요합니다. 연결을 위해 RLS를 끄지 마세요. 공개 조회 가능한 안내 정보만 노출하세요.
- `VITE_API_BASE_URL`은 별도 백엔드 `/catalog` 어댑터가 준비된 경우 사용합니다. Supabase 설정이 우선합니다.

## 구현한 화면

- 온보딩: 한국어/영어, 전체 식재료 태그, 기타 알레르기 설정
- 홈: 사진 흐름 시작, 프로필 요약, 식재료 빠른 검색
- 사진: JPG/PNG/WEBP 10MB 제한, 미리보기, 삭제, 직접 입력
- 확인: 사용자가 입력한 음식명과 직접 확인한 식재료 선택
- 결과: 개인 프로필과 식재료 태그 비교, 안내 문구, 검토 상태, 식단 분류, 한국어 직원 카드 및 복사
- 검색: 한국어 이름, 영어 안내 문구/태그 검색, 개인 알레르기·DB 식단 분류 필터
- 설정: 출처·한계·개인정보 안내, 로컬 프로필 초기화

모바일 하단 메뉴와 데스크톱 사이드바를 지원합니다. 프로필은 브라우저 localStorage, 사진·결과는 세션 메모리에 저장됩니다. 사진을 외부로 전송하지 않습니다.

## 데이터의 현재 범위

개발 중 확인한 공개 조회 결과: `ingredient_master` 761개, 모두 `verification_status = needs_review`. 별도 `allergen_master`, `ingredient_allergen_mapping`, `external_ingredient_master_mapping` 조회 결과는 각각 0건입니다. 음식 테이블은 현재 비어 있는 것으로 사용자가 확인했습니다. 이 수치를 UI에 고정하지 않고 매 조회 결과를 사용합니다.

- 실제 모드의 알레르기 선택지는 `global_allergens`의 고유 태그로 구성합니다. 별도 기준 테이블을 조회한 것으로 표시하지 않습니다.
- 갑각류(`Crustacean`)를 새우만으로 축소하지 않습니다. DB 태그 ID를 보존합니다.
- DB의 `user_notice_en`, `hidden_warning_en`, `staff_request_ko`를 사용합니다. DB 내용 자체를 의학적으로 검증하거나 자동 교정하지 않습니다.
- 식약처 공식 샘플 레시피 5개와 재료 36행을 출처와 함께 연결했습니다. Supabase 음식 테이블이 비어 있으면 앱에 포함된 공공 샘플임을 표시합니다. DB 반영용 SQL을 실행하면 같은 화면에서 실제 음식 테이블을 우선 읽습니다. 미연결 재료를 숨기지 않으며 모든 연결은 검토 전입니다.
- Supabase 반영 절차, 이용 조건과 원본은 [공공데이터 안내](docs/public-data.md)에 있습니다. 공개 키만으로 운영 DB에 관리자 SQL을 실행하지 않았습니다.
- **AI 사진 인식은 미연결입니다.** 음식명을 자동 인식한 것처럼 보여주지 않습니다.
- **영양 정보는 실제 출처 데이터가 있을 때만** 표시합니다. 지금 식재료 DB에는 영양값이 없으므로 미제공으로 표시합니다.
- 비건 등 식단 분류는 DB 값이며 검증 전입니다. `Vegan`이면서 갑각류/생선 태그가 있는 등 상충하는 항목도 있으므로 알레르기 판단 근거로 사용하지 않습니다.

`needs_review`는 “포함될 수 있음 + 직원 확인”으로 처리합니다. 안내 문구가 있다는 사실이 검증 완료를 뜻하지는 않습니다. 태그 미발견·미등록 재료·정보 부족은 안전 판정이 아닙니다. 조리 과정의 교차 접촉은 이 앱으로 배제할 수 없습니다.

## 구조

```text
src/App.tsx                 화면 흐름 및 반응형 UI
src/lib/supabase.ts         실제 식재료 조회·정규화·태그 표시명
src/lib/catalog.ts          데이터 소스 선택 및 API 계약 검증
src/lib/analysis.ts         개인별 비교 및 한국어 카드 구성
src/lib/profile.ts          로컬 프로필 저장·복원
src/lib/types.ts            4개 테이블 및 음식 데이터의 내부 계약
src/data/demo.ts            실제 DB와 분리된 체험용 예시
src/lib/analysis.test.ts    불확실성·매핑·분류 충돌 회귀 검사
docs/inspect-schema.sql     스키마·정책 조회용 읽기 전용 SQL
```

공공데이터 반영은 [준비된 SQL](data/public-recipes/import-to-supabase.sql)을 Supabase SQL Editor에서 실행하면 됩니다. 중복·충돌 방지와 공개 읽기 전용 정책이 포함되어 있습니다.

기타 스키마 확인 방법은 [Supabase 연동 문서](docs/supabase.md)를 참고하세요.
