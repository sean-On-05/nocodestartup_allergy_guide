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

`VITE_API_BASE_URL`은 지금 비워 두세요. Gemini 키도 이 단계에는 필요하지 않습니다.

5. **Deploy**를 누릅니다. 성공 후 발급된 `.vercel.app` 주소를 확인합니다.
6. 해당 주소에서 음식 검색에 `김치찌개`를 입력해 참고 레시피가 표시되는지 확인합니다.

환경 변수를 나중에 추가/변경했다면 재배포해야 Vite 빌드에 반영됩니다. URL의 `#home`, `#search` 등 해시 기반 이동을 사용하므로 광범위한 SPA rewrite가 필요하지 않습니다. 향후 `/api/recognize-food` 서버 함수 경로를 가리지 않도록 임의의 전체 경로 rewrite를 추가하지 마세요.

현재 작업 환경에는 사용자의 Vercel 계정 연결이 없어 프로젝트 생성·실제 배포를 대신 실행하지 않았습니다. GitHub의 설정을 준비하고 로컬 빌드를 검증한 상태입니다.

## 다음 단계: Gemini 사진 인식

Vercel 배포 후 서버 함수 `/api/recognize-food`를 추가하여 Gemini에 사진을 전달하는 방식으로 연결할 예정입니다. 아직 Gemini 호출 코드가 구현되거나 활성화된 것은 아닙니다.

- Google AI Studio에서 **Free tier** 프로젝트를 사용합니다. 무료 사용을 유지하려면 그 프로젝트에 유료 결제 계정을 연결하지 마세요. 모델·지역·계정별 무료 접근 및 할당량은 AI Studio에서 확인합니다.
- 이미지 입력과 무료 등급을 모두 지원하는 모델을 연결 시점에 확인해 선택합니다. 모든 Gemini 모델이 무료인 것은 아닙니다.
- 서버용 키는 Vercel 환경 변수 `GEMINI_API_KEY`에 저장합니다. **`VITE_GEMINI_API_KEY`로 만들지 마세요.** `VITE_` 변수는 브라우저 빌드에 공개됩니다.
- 무료 할당량 초과/429 응답에서는 사진 인식을 중단하고 재시도 안내를 표시하도록 구현합니다. 유료 모델로 자동 전환하지 않습니다.
- 사진 AI는 음식명 후보만 제안합니다. 사용자가 후보를 확인한 뒤 실제 DB의 참고 레시피와 연결합니다. 사진만으로 숨은 재료나 알레르기 안전 여부를 확정하지 않습니다.
- 실제 연동 시 사진 전송 대상과 사용자 동의를 화면에 반영해야 합니다. 현재 버전은 사진을 전송하지 않습니다.

Gemini 모델의 입력 비용과 별개로 Vercel의 배포·함수 실행, Supabase의 트래픽은 각 서비스 요금제의 한도를 따릅니다. 전체 서비스 비용이 항상 0원이라고 보장하는 설정은 아닙니다.

공식 참고:

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Gemini 이미지 입력](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini 무료/유료 등급](https://ai.google.dev/gemini-api/docs/billing)
- [모델별 가격 및 무료 제공 여부](https://ai.google.dev/gemini-api/docs/pricing)
