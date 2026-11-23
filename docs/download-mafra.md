# 승인된 API로 전체 레시피 내려받기

승인받은 API는 `레시피 기본정보`와 `레시피 재료정보` 두 개입니다. 등록한 공인 IP의 PC에서 실행하세요. 이 도구는 데이터를 읽어 ZIP으로 저장하며 Supabase에는 쓰지 않습니다.

## 준비

- Python 3.9 이상이 설치된 PC (추가 패키지 설치 불필요)
- 농림축산식품 공공데이터포털 → 마이페이지의 내 정보에서 확인한 **오픈API 인증키**. Supabase 키가 아닙니다.
- 승인받을 때 등록한 IP와 같은 인터넷 연결

[공식 신청 안내](https://data.mafra.go.kr/apply/indexApiPrcuseReqst.do)에 따르면 인증키는 회원가입 시 발급되고, 신청 API와 신청 IP를 등록하여 사용합니다.

## 실행

1. GitHub의 [다운로드 도구](../scripts/download-mafra.py)를 열고 **Download raw file** 버튼으로 `download-mafra.py`를 저장합니다.
2. 저장한 폴더에서 터미널을 엽니다. Windows는 폴더 주소창에 `powershell`을 입력하면 됩니다.
3. 실행합니다.

Windows:

```powershell
py download-mafra.py
```

macOS / Linux:

```sh
python3 download-mafra.py
```

`py` 또는 `python3` 명령을 찾을 수 없다면 [Python](https://www.python.org/downloads/) 설치가 먼저 필요합니다.

4. `MAFRA API key` 입력란에 인증키를 붙여넣고 Enter를 누릅니다. 입력 내용이 보이지 않는 것이 정상입니다.
5. 완료되면 스크립트 옆 `kfood-downloads` 폴더에 ZIP 파일이 생깁니다. 그 **ZIP 하나를 채팅에 첨부**해 주세요.

스크립트는 인증키를 파일·ZIP·오류 메시지에 넣지 않습니다. 제공기관 공식 명세의 HTTP 요청 주소를 사용하므로 키는 해당 기관에 전송됩니다. GitHub나 Supabase로 보내지 않습니다. Supabase 서비스 키나 비밀번호를 입력하지 마세요.

## ZIP 내용

- `recipes.json`, `recipes.csv`: 원본 레시피 기본정보 전체
- `recipe_ingredients.json`, `recipe_ingredients.csv`: 원본 재료정보 전체
- `manifest.json`: 출처·다운로드 시각·행 수·연결되지 않는 레시피 참조 수

총건수는 API 응답에서 읽습니다. 고정된 537개 또는 6,104개로 가정하지 않으며, 한 요청에 1,000행씩 허용 범위 내에서 받습니다. 실제 데이터가 바뀌거나 ID 중복·조기 종료가 발생하면 완료된 데이터라고 표시하지 않습니다. 수집한 자료는 이후 음식별 연결·중복 검토·이용 조건 확인을 거쳐 Supabase 저장용으로 정리합니다.

## 오류가 나면

- `API authentication failed`: 키가 맞는지, 두 API가 모두 승인됐는지, 등록 IP가 현재 PC의 공인 IP와 같은지 확인하세요.
- `Network request failed`: 제공기관 접속 또는 인터넷 연결을 확인하고 나중에 재시도하세요.
- `Dataset changed during download`: 수집 중 자료가 바뀐 경우이므로 다시 실행하세요.

오류 메시지는 공유해도 되지만 인증키가 보이는 터미널·설정 화면은 가려주세요. 정식 키로 전체 수집하는 동작은 사용자의 등록된 PC에서 실행해야 하므로, 이 저장소에서는 테스트용 응답으로 페이지 수집·누락·중복·인증 실패·ZIP 생성을 검사했습니다.
