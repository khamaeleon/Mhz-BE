# 메가헤르츠(MHz) — Backend (Node.js API 서버)

메가헤르츠 라디오 앱([MHz-FE](https://github.com/khamaeleon/MHz-FE))에 편성표·선곡표·검색 데이터를 내려주는 API 서버.

- 기획서: https://claude.ai/artifact/X23WWAswXHuJ1cTNDRHcHt (10장 백엔드 구조, 11장 DB 구조)
- 사용자는 한국어로 소통한다. 답변·커밋 메시지·주석은 한국어.

## 인프라 (2026-11-26 결정)

- DB: AWS EC2 `EC2-AdPilot-DB`의 PostgreSQL 17 (`mhz` DB / `mhz_app` 계정). 같은 서버에 DailyNews(`daily_news`)도 있고, AdPilot은 MariaDB를 쓴다. 다른 DB에는 손대지 않는다.
- PostgreSQL은 `localhost`와 VPC 사설 IP로만 열려 있다. 인터넷에 열지 않는다.
- API 서버: DailyNews 앱이 돌고 있는 EC2에 docker-compose로 띄운다(같은 VPC). 컨테이너 2개: `api`(127.0.0.1:4100), `crawler`(src/crawl/scheduler.js — 선곡 5분, 편성 매일 04:00 KST).
- Supabase는 쓰지 않기로 했다.

## 원칙

- 오디오 스트림은 서버를 거치지 않는다. 앱이 방송사에서 직접 받는다.
- 서버 DB에는 공용 방송 데이터만. 즐겨찾기·설정은 앱 기기에 저장, 로그인 없음.
- 비밀번호·접속 정보는 `.env`에만. 커밋하지 않는다.
- 스키마 변경은 `db/migrations/`에 새 번호 파일을 추가하고 `npm run migrate`로 적용한다(기존 파일 수정 금지).

## 현재 상태

- API·마이그레이션·수집기 뼈대 완료. SQL은 로컬 PostgreSQL 16으로 검증했다.
- 아직 서버 배포 전. DailyNews 서버의 nginx 구성(호스트/컨테이너)과 API 도메인은 미정.
- package-lock.json 이 아직 없다. 첫 npm install 후 커밋하고 Dockerfile 을 npm ci 로 바꾼다.
- 다음: 방송사별 편성표·선곡표 원본 찾기 → `src/crawl/sources/*.js` 구현 → 배포 → 앱 연결
