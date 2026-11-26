# 메가헤르츠(MHz) — Backend (Supabase)

메가헤르츠 라디오 앱([MHz-FE](https://github.com/khamaeleon/MHz-FE))에 편성표·선곡표·검색 데이터를 내려주는 백엔드.

- 기획서: https://claude.ai/artifact/X23WWAswXHuJ1cTNDRHcHt (10장 백엔드 구조, 11장 DB 구조)
- 사용자는 한국어로 소통한다. 답변·커밋 메시지·주석은 한국어.

## 원칙

- 오디오 스트림은 서버를 거치지 않는다. 앱이 방송사에서 직접 받는다(토큰이 요청자 IP에 묶일 수 있음 — 미확인).
- 서버 DB에는 공용 방송 데이터만. 즐겨찾기·설정은 앱 기기에 저장, 로그인 없음.
- 읽기는 anon(RLS `public read`), 쓰기는 crawl 함수가 service_role로만.
- `crawl` 함수는 `x-crawl-secret` 헤더(`CRAWL_SECRET`)가 맞을 때만 실행. 비밀값은 `supabase secrets`로만 관리하고 커밋하지 않는다.

## 구조

- `supabase/migrations/` 스키마, `supabase/seed.sql` 채널 8개
- `supabase/functions/api` 읽기 API, `supabase/functions/crawl` 수집기
- `supabase/functions/crawl/sources/{kbs,mbc,sbs}.ts` 방송사별 수집 — 아직 빈 배열 반환(TODO)

## 현재 상태 (2026-11-26)

- 스키마·API·수집기 뼈대만 있고, 로컬 실행·배포는 아직 안 했다. `supabase init`도 아직이라 `config.toml`이 없다.
- 다음: 방송사별 편성표·선곡표 원본 찾기 → sources 구현 → 배포 → 앱 연결
