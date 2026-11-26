# 메가헤르츠(MHz) — Backend (Node.js API 서버)

메가헤르츠 라디오 앱([MHz-FE](https://github.com/khamaeleon/MHz-FE))에 편성표·선곡표·검색 데이터를 내려주는 API 서버.

- 기획서: https://claude.ai/artifact/X23WWAswXHuJ1cTNDRHcHt (10장 백엔드 구조, 11장 DB 구조)
- 사용자는 한국어로 소통한다. 답변·커밋 메시지·주석은 한국어.

## 인프라 (2026-11-26 결정)

- DB: AWS EC2 `EC2-AdPilot-DB`의 PostgreSQL 17 (`mhz` DB / `mhz_app` 계정). 같은 서버에 DailyNews(`daily_news`)도 있고, AdPilot은 MariaDB를 쓴다. 다른 DB에는 손대지 않는다.
- PostgreSQL은 `localhost`와 VPC 사설 IP로만 열려 있다. 인터넷에 열지 않는다.
- API 서버: DailyNews 앱이 돌고 있는 EC2에 docker-compose로 띄운다(같은 VPC). 컨테이너 2개: `api`(127.0.0.1:4100), `crawler`(src/crawl/scheduler.js — 선곡 5분·MBC 선곡 1분, 편성 매일 04:00 KST).
- Supabase는 쓰지 않기로 했다.

## 원칙

- 오디오 스트림은 서버를 거치지 않는다. 앱이 방송사에서 직접 받는다.
- 서버 DB에는 공용 방송 데이터만. 즐겨찾기·설정은 앱 기기에 저장, 로그인 없음.
- 비밀번호·접속 정보는 `.env`에만. 커밋하지 않는다.
- 스키마 변경은 `db/migrations/`에 새 번호 파일을 추가하고 `npm run migrate`로 적용한다(기존 파일 수정 금지).

## 현재 상태

- API·마이그레이션·수집기 뼈대 완료. SQL은 로컬 PostgreSQL 16으로 검증했다.
- 2026-11-26 배포 완료: DB 서버에 mhz DB·mhz_app 계정·pg_hba 설정, DailyNews 서버(172.31.7.62)에서 docker-compose 로 api·crawler 실행 중.
- API 도메인·HTTPS(nginx)는 아직 미정. 앱은 아직 API 를 호출하지 않는다.
- 채널 30개(3사 + EBS·CBS·TBS·TBN·종교·공영 등). `002_more_channels.sql` 로 방송사 제약을 넓히고 `frequency` null 허용·`frequency_band`(FM/AM) 추가. seed 는 앱 `channels.ts` 와 같은 값으로 덮어쓴다. SQL은 PGlite(Postgres WASM)로 검증했다.
- 수집 원본은 kbs·mbc·sbs 만 있다. 나머지 방송사는 `getSource()` 가 빈 결과를 돌려준다.
- 편성표·선곡표 수집기 구현(2026-11-26): KBS 6채널·MBC 3채널·SBS 러브/파워. 원본과 주의점은 `docs/data-sources.md`.
  - 편성: 7일치, 선곡: 최근 1시간 안의 프로그램만 조회. MBC 선곡은 "지금 나오는 곡" API라 스케줄러가 `songs mbc` 를 1분마다 따로 돌린다.
  - PGlite(Postgres WASM) 소켓 서버로 migrate → schedule → songs → API(/channels/:id/now, /schedule) 까지 확인. 실서버 배포는 아직.
  - 프로그램 이미지는 iOS ATS 때문에 https 로 바꿔 저장한다. songs.program_id 는 아직 채우지 않는다.
  - 고릴라디오M·그 외 방송사는 수집 원본이 없어 빈 결과.
- 다음: 서버에 배포(git pull → docker compose up -d --build) → 앱 연결
