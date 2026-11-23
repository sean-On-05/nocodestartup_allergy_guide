# Vercel로 배포하기

현재 React + Vite 프로젝트를 기존 GitHub 저장소에서 바로 배포합니다. `vercel.json`에 Vite 프리셋, 빌드 명령과 결과 디렉터리를 설정했습니다.

## 배포

1. [Vercel 새 프로젝트](https://vercel.com/new)를 열고 GitHub로 로그인합니다.
2. Import Git Repository에서 `sean-On-05/nocodestartup_allergy_guide`를 선택하고 **Import**를 누릅니다.
   - 저장소가 보이지 않으면 GitHub 연결의 저장소 접근 권한에서 이 저장소를 허용하세요.
3. 설정을 확인합니다.

| 항목 | 값 |
|---|---|
| Framework Preset | Vite |
| Root Directory | 저장소 루트 (`./`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

4. **Environment Variables**에 아래 두 값을 등록합니다. Production과 Preview에 같은 공개 안내 DB를 사용할 경우 둘 다 선택합니다.

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://nxtfzuocofncnzfcfuel.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 현재 프로젝트의 Supabase Publishable key (`sb_publishable_…`) |

이 두 값은 브라우저용 공개 설정입니다. DB 접근은 Supabase의 조회 정책으로 제한합니다. `service_role`, `sb_secret_…`, DB 비밀번호를 사용하지 마세요. 값은 Vercel 설정에 넣으며 GitHub 소스에 커밋하지 않습니다.

`VITE_API_BASE_URL`은 지금 비워 두세요. 사진 인식에는 아래 서버용 Gemini 키도 설정합니다.

5. **Deploy**를 누릅니다. 성공 후 발급된 `.vercel.app` 주소를 확인합니다.
6. 해당 주소에서 음식 검색에 `김치찌개`를 입력해 참고 레시피가 표시되는지 확인합니다.

환경 변수를 나중에 추가/변경했다면 재배포해야 Vite 빌드에 반영됩니다. URL의 `#home`, `#search` 등 해시 기반 이동을 사용하므로 광범위한 SPA rewrite가 필요하지 않습니다. `/api/recognize-food` 서버 함수 경로를 가리지 않도록 임의의 전체 경로 rewrite를 추가하지 마세요.

## 현재 운영 배포

- 공개 주소: https://kfood-allergy-guide.vercel.app
- Vercel 프로젝트: `kfood-allergy-guide` / 팀 `seanon1`
- 사진 인식 경로: `POST /api/recognize-food` (Vercel Node.js Function)
- 서버 환경 변수: **`GEMINI_API_KEY`**, Production에 Sensitive로 등록. 키를 `VITE_` 변수, 브라우저 코드, GitHub에 넣지 않습니다.
- 모델: `gemini-3.5-flash-lite`. 연결 시점의 공식 가격표에서 이미지 입력과 Free tier를 확인한 모델을 고정 사용합니다. Google 직접 호출이며 AI Gateway, 검색 도구, 유료 대체 모델은 사용하지 않습니다.

## 사진 인식 흐름

1. JPG/PNG/WEBP 사진을 선택합니다(원본 최대 10MB).
2. Google 전송과 무료 등급 데이터 이용 안내를 확인하고 동의한 뒤 AI 버튼을 누릅니다. 선택만으로 전송하지 않습니다.
3. 브라우저에서 긴 변 1280px 이하 JPEG로 다시 인코딩해 메타데이터·원본 파일명 없이 전송합니다. 서버는 JSON 크기, 형식, 이미지 시그니처를 확인합니다.
4. Gemini는 음식명 후보를 최대 3개 반환합니다. AI가 재료·알레르기·안전 여부를 결정하지 않습니다.
5. 사용자가 음식명을 수정/확인하고, 이름 검색으로 나온 DB 참고 레시피를 직접 선택합니다. 부분 일치나 중복 이름을 자동으로 레시피와 연결하지 않습니다.
6. 선택한 참고 레시피의 재료로 기존 알레르기 안내를 표시합니다. 직접 입력 흐름에서는 직접 선택한 재료만 비교합니다.

Google 요청은 최대 30초, 자동 재시도 0회입니다. 429 응답이면 인식을 중단하고 직접 입력/나중에 재시도 안내를 표시합니다. 무료 등급 한도는 계정·프로젝트·모델별로 달라 고정 횟수를 보장하지 않습니다. Google 프로젝트에 결제를 활성화하면 같은 모델도 유료로 과금될 수 있으므로 무료 사용을 유지하려면 결제를 연결하지 않습니다. 코드에서 Google 계정의 결제 상태를 판별할 수는 없습니다.

앱은 사진을 DB나 파일 저장소에 저장하거나 요청 내용을 로그로 남기지 않습니다. Google의 무료 등급 처리에는 [Gemini API 약관](https://ai.google.dev/gemini-api/terms)이 적용되며 제품 개선 이용이 포함될 수 있습니다. 알레르기 프로필은 Google에 보내지 않습니다.

## 확인

- `npm test`: 기존 데이터/알레르기 테스트와 사진 API의 입력 검증, 동의, 오류 비노출, 429 1회 중단, SDK 요청 직렬화 검증.
- `npm run build`: 프런트엔드와 서버 TypeScript 검사, Vite 프로덕션 빌드.
- `GET /api/recognize-food`: 키 값 없이 설정 여부와 모델명만 반환(`Cache-Control: no-store`). 실제 인식 성공을 의미하지 않으므로 사진으로 별도 확인합니다.
- Vite 개발 서버만으로는 Vercel API를 실행하지 않습니다. 서버 키를 로컬에 직접 설정하고 `vercel dev`를 사용하거나 Vercel 배포에서 확인하세요.

Gemini 모델의 입력 비용과 별개로 Vercel의 배포·함수 실행, Supabase의 트래픽은 각 서비스 요금제의 한도를 따릅니다. 전체 서비스 비용이 항상 0원이라고 보장하는 설정은 아닙니다.

공식 참고:

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Gemini 이미지 입력](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini 무료/유료 등급](https://ai.google.dev/gemini-api/docs/billing)
- [모델별 가격 및 무료 제공 여부](https://ai.google.dev/gemini-api/docs/pricing)
