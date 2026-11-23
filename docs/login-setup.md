# Google 로그인 켜기

로그인 화면·Supabase Auth PKCE 로그인 복귀·계정별 알레르기 저장·로그아웃·설정 삭제·탈퇴 코드는 준비되어 있습니다. Supabase 관리 권한과 Google OAuth 클라이언트 설정은 계정 소유자가 아래에서 완료해야 합니다. **Gemini API 키와 Google 로그인용 OAuth 클라이언트는 서로 다릅니다.** OAuth 비밀키를 채팅이나 GitHub에 올리지 마세요.

## 1. 개인 설정 테이블 만들기

1. [테이블 생성 SQL](../supabase/migrations/202611230001_account_profiles.sql)을 열고 전체 내용을 복사합니다.
2. [Supabase SQL Editor](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/sql/new)에 붙여 넣고 Run을 누릅니다.
3. 이 SQL은 `kfood_user_profiles` 테이블, 본인 행에만 접근하는 RLS 정책, 본인 계정 탈퇴 함수만 만듭니다. 기존 음식·식재료 데이터는 변경하지 않습니다. 탈퇴 함수는 생성만으로 실행되지 않습니다.

## 2. Google 로그인용 클라이언트 만들기

1. [Google Cloud Console](https://console.cloud.google.com/auth/overview)에 로그인합니다. 서비스에 사용할 프로젝트를 선택합니다. Gemini 프로젝트와 같아도 되고 별도여도 됩니다.
2. Google Auth Platform에서 앱 이름 `K-Food Allergy Guide`, 지원 이메일, 개발자 연락 이메일을 설정합니다. 일반 방문객을 받으려면 Audience는 **External**로 설정합니다.
3. **Clients → Create client → Web application(웹 애플리케이션)**을 선택합니다.
4. 아래 값을 등록합니다.

| Google 설정 | 등록 값 |
|---|---|
| Authorized JavaScript origins | `https://kfood-allergy-guide.vercel.app` |
| Authorized redirect URIs | `https://nxtfzuocofncnzfcfuel.supabase.co/auth/v1/callback` |

5. 생성된 Client ID와 Client Secret을 아래 Supabase Google 제공자 설정에 직접 입력합니다. **Gemini API 키를 넣는 칸이 아닙니다.**
6. Testing 상태에서는 Audience에 등록한 Test users만 로그인할 수 있습니다. 먼저 본인 이메일을 Test users에 추가해 확인하고, 모든 방문객에게 제공할 때는 앱의 게시 상태를 Production으로 전환합니다. Google이 요구하는 앱·도메인 정보를 실제 서비스에 맞춰 작성합니다.

## 3. Supabase에서 Google 제공자 켜기

[Supabase Authentication](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/auth/providers) → Sign In / Providers → Google:

- Enable Sign in with Google을 켭니다.
- Client IDs에 Google에서 발급한 웹 Client ID를 입력합니다.
- Client Secret에 해당 OAuth Client Secret을 입력하고 저장합니다.
- 추가 Google API 권한은 필요 없습니다. 기본 로그인용 `openid`, `email`, `profile`만 사용합니다.

## 4. 로그인 후 돌아올 주소 등록

[Supabase URL Configuration](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/auth/url-configuration)에서:

| 항목 | 값 |
|---|---|
| Site URL | `https://kfood-allergy-guide.vercel.app` |
| Redirect URLs에 추가 | `https://kfood-allergy-guide.vercel.app/?auth=callback` |

다른 도메인이나 Vercel 미리보기에서 로그인도 테스트하려면 해당 주소의 `/?auth=callback`을 개별 등록해야 합니다. 무분별한 와일드카드는 사용하지 않습니다. Google의 redirect URI와 Supabase의 Redirect URL은 목적이 다른 주소입니다.

## 5. 확인

1. [운영 계정 화면](https://kfood-allergy-guide.vercel.app/#account)에서 **다시 확인**을 누릅니다. 전송 동의 후 Google 로그인이 활성화됩니다.
2. Google로 로그인하고 내 알레르기를 설정·저장합니다.
3. 새 시크릿 창에서 같은 계정으로 로그인해 저장한 설정이 불러와지는지 확인합니다.
4. 다른 계정은 빈 설정으로 시작하는지 확인합니다. 로그인 전 비로그인 설정은 자동 업로드하지 않으며, 계정 화면에서 명시적으로 가져올 수 있습니다.
5. 로그아웃하면 계정 설정은 화면에서 제거되고 기존 비로그인 설정으로 돌아갑니다. 계정 알레르기는 앱의 guest localStorage 키에 저장하지 않습니다. 로그인 세션 토큰은 SDK가 브라우저에 저장하므로 공용 기기에서는 로그아웃합니다.

Google 제공자 설정이 꺼져 있으면 앱은 준비 중 안내를 표시합니다. 설정 테이블을 읽지 못하면 계정 프로필을 빈 정보로 덮어쓰지 않고 오류와 재시도를 표시합니다. 계정 프로필 저장에 실패하면 저장 완료 메시지나 홈 이동을 하지 않습니다.

## 데이터 및 탈퇴

- `kfood_user_profiles`에는 사용자 UUID, 언어, 알레르기 태그, 메모, 설정 완료 여부, 갱신 시각만 저장합니다. Google 비밀번호와 음식 사진을 저장하지 않습니다.
- 로그인한 상태에서 설정의 **내 프로필과 세션 지우기**를 누르면 해당 계정의 알레르기 설정을 비웁니다. 비로그인 상태에서는 이 브라우저의 비로그인 설정만 지웁니다.
- 계정 화면의 **계정 탈퇴 → 계정 영구 삭제**는 사용자 JWT로 본인 계정만 삭제하는 RPC를 호출합니다. 계정 삭제 시 개인 설정 행도 FK cascade로 삭제됩니다. 다른 사용자 ID를 인자로 받지 않습니다.
- 앱에서 이미 받은 JWT는 만료 전까지 형식상 유효할 수 있으므로, 이후 개인 테이블을 추가할 때도 반드시 RLS와 `auth.users` FK/삭제 처리를 함께 적용합니다. 현재 개인 설정은 계정 삭제와 함께 제거됩니다.

공식 참고: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
