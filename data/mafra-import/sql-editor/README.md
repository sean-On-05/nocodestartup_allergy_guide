# Supabase SQL Editor에서 실행할 파일 — 임시 테이블 제거 버전

기존 파일의 `kfood_seed_payload does not exist` 오류를 피하도록 임시 테이블을 완전히 제거했습니다. 각 파일의 반영은 JSON 변수와 쓰기 작업이 같은 `DO` 블록 안에서 실행됩니다.

기존 전체 SQL은 약 1.4MB로 SQL Editor 크기 제한을 넘습니다. 아래 파일은 각각 약 0.5MB입니다.

**기존 쿼리 내용을 모두 지우고, 아래 수정 파일을 Raw로 열어 전체 복사 → Supabase SQL Editor의 새 쿼리에 붙여넣기 → Run**을 누르세요. 세 파일을 하나로 합치지 마세요.

| 실행 순서 | 파일 | 결과 recipes | 결과 ingredients |
|---|---|---:|---:|
| 1 | [01-import.sql](01-import.sql) | 179 | 2019 |
| 2 | [02-import.sql](02-import.sql) | 358 | 3971 |
| 3 | [03-import.sql](03-import.sql) | 537 | 5933 |

RLS 안내 창이 나오면 **Run and enable RLS**를 선택하세요.

마지막 결과가 537 / 5933이면 전체 완료입니다. 기존 식약처 샘플 5개는 이 집계에 포함되지 않습니다. 같은 파일을 다시 실행해도 중복 추가하지 않습니다. 중간 오류가 나면 실패한 파일부터 다시 실행할 수 있습니다. 성공한 이전 파일의 반영은 유지됩니다.

[상세 안내와 검증 결과](../../../docs/mafra-import.md)
