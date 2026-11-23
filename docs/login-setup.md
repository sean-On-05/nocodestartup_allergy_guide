# 이메일 로그인 설정

현재 앱은 **이메일·비밀번호 회원가입과 로그인**을 사용합니다. Google OAuth 클라이언트, Client ID, Client Secret은 필요 없습니다.

## 사용 흐름

1. [계정 화면](https://kfood-allergy-guide.vercel.app/#account)에서 회원가입을 선택합니다.
2. 이메일과 8자 이상의 비밀번호를 입력하고 계정 저장 안내에 동의합니다.
3. 받은편지함/스팸함의 가입 확인 메일에서 링크를 누릅니다.
4. 계정 화면에서 이메일과 비밀번호로 로그인합니다. 확인 직후 로그인 세션이 생성되는 설정이면 바로 계정 화면이 열립니다.
5. 알레르기를 수정·저장하면 같은 계정으로 다른 기기에서도 불러옵니다.

기존 사용자는 로그인 탭을 이용합니다. 확인 메일 재발송과 비밀번호 재설정 링크 요청도 계정 화면에서 할 수 있습니다. 비밀번호는 앱의 알레르기 DB나 localStorage에 저장하지 않으며 Supabase Auth가 처리합니다. 로그인 세션은 SDK가 브라우저에 저장하므로 공용 기기에서는 로그아웃합니다.

## Supabase 설정

### 1. 계정별 설정 테이블

아직 실행하지 않았다면 [개인 설정 SQL](../supabase/migrations/202611230001_account_profiles.sql)을 전체 복사해 [SQL Editor](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/sql/new)에서 한 번 실행합니다. 이미 실행했다면 다시 만들 필요 없습니다. SQL은 재실행할 수 있습니다.

`kfood_user_profiles`에는 본인만 조회·수정할 수 있는 RLS 정책이 적용됩니다. 기존 음식·식재료 데이터는 변경하지 않습니다. 탈퇴 함수는 생성만으로 실행되지 않습니다.

### 2. 이메일 제공자

[Authentication → Sign In / Providers](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/auth/providers)에서 Email을 켭니다. Google 제공자는 사용하지 않습니다. 이메일 확인은 켜진 상태를 기준으로 안내합니다. 비밀번호 복잡도 정책은 Supabase에서 강화할 수 있으며 앱은 회원가입·재설정에 최소 8자를 요구합니다.

### 3. 메일에서 돌아올 주소

[URL Configuration](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/auth/url-configuration)에 다음을 등록합니다.

| 항목 | 값 |
|---|---|
| Site URL | `https://kfood-allergy-guide.vercel.app` |
| Redirect URLs | `https://kfood-allergy-guide.vercel.app/?auth=callback` |

가입 확인·비밀번호 재설정 메일 모두 이 주소를 사용합니다. 복귀 후 인증 코드는 Supabase SDK의 PKCE 흐름으로 교환하며, 비밀번호 재설정 링크는 새 비밀번호 입력 화면으로 연결합니다. 링크를 요청한 브라우저에서 여는 것을 권장합니다. 다른 브라우저나 기기에서 확인해 세션 교환이 되지 않으면 원래 화면에서 이메일·비밀번호 로그인을 시도합니다. 재설정 링크의 세션 교환이 안 되면 사용할 브라우저에서 링크를 다시 요청합니다.

### 4. 메일이 오지 않는 경우

- 스팸함과 Supabase Auth 로그를 확인합니다. 여러 번 연속 요청하면 발송 제한에 걸릴 수 있습니다.
- Supabase 기본 메일 발송 서비스는 테스트용으로 발송 횟수와 수신 대상에 제한이 있습니다. 일반 방문객에게 가입 메일을 발송하려면 [Custom SMTP](https://supabase.com/dashboard/project/nxtfzuocofncnzfcfuel/auth/smtp)에서 발송 서비스를 연결해야 할 수 있습니다. 제공자 활성화만으로 모든 주소에 메일이 도달한다고 보장되지는 않습니다.
- SMTP 비밀번호/API 키는 Supabase 대시보드에 직접 입력합니다. 채팅·GitHub·프런트엔드에 넣지 않습니다.
- 메일 제목/본문은 기본 가입 확인·비밀번호 재설정 템플릿으로 사용할 수 있습니다. 인증 코드용 템플릿 변경은 필요 없습니다.

## 검증과 데이터 처리

- 실제 이메일 제공자가 켜져 있는지 공개 Auth 설정 API로 확인합니다.
- 브라우저 테스트에서는 인증 서버 응답을 모의하여 로그인·회원가입·인증 대기·오류 처리·비밀번호 재설정 요청·계정 저장·로그아웃을 확인합니다. 실제 메일 수신과 확인 링크는 사용자가 본인 이메일로 확인해야 합니다.
- 비로그인 알레르기는 자동 업로드하지 않습니다. 계정 화면에서 가져오기를 선택한 경우에만 기존 계정 설정을 바꿉니다.
- 계정 프로필 조회 실패 시 빈 설정으로 덮어쓰지 않습니다. 저장 실패 시 완료 메시지를 표시하지 않습니다.
- 로그아웃하면 계정 정보는 화면에서 제거되고 기존 비로그인 설정으로 돌아갑니다. 사진은 계정에 저장하지 않습니다.
- 설정 초기화와 본인 계정 탈퇴를 지원합니다. 탈퇴 RPC는 사용자 ID 인자를 받지 않고 검증된 JWT의 본인만 삭제하며 개인 설정도 함께 삭제합니다.

공식 참고: [이메일·비밀번호 인증](https://supabase.com/docs/guides/auth/passwords), [메일 발송 설정](https://supabase.com/docs/guides/auth/auth-smtp), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
