# 메가헤르츠 (MHz) — Backend

메가헤르츠 앱([MHz-FE](https://github.com/khamaeleon/MHz-FE))에 편성표·선곡표·검색 데이터를 내려주는 Node.js API 서버입니다.

- 오디오 스트림은 앱이 방송사에서 직접 받고, 서버는 방송 정보만 모아서 나눠줍니다.
- 즐겨찾기·설정은 앱(기기)에 저장하므로 로그인이 없습니다.

## 구성

```
DailyNews 서버 (EC2)                 DB 서버 (EC2-AdPilot-DB)
┌──────────────────────────┐        ┌──────────────────────┐
│ nginx → api 컨테이너     │──VPC──▶│ PostgreSQL 17        │
│ crawler 컨테이너(수집기) │        │  DB: mhz / mhz_app   │
└──────────────────────────┘        └──────────────────────┘
```

```
db/migrations/001_init.sql   # 테이블 8개
db/seed.sql                  # 채널 8개, 앱 설정 기본값
scripts/migrate.js           # 마이그레이션 + seed 적용 (여러 번 실행해도 안전)
src/server.js                # API (Fastify)
src/crawl/run.js             # 수집기 1회 실행
src/crawl/scheduler.js       # 수집 일정 (crawler 컨테이너)
Dockerfile, docker-compose.yml
src/crawl/sources/*.js       # 방송사별 수집 로직 (TODO)
deploy/nginx-mhz.conf        # nginx 프록시 예시
```

## API

| 엔드포인트 | 응답 | 캐시 |
| --- | --- | --- |
| `GET /health` | DB 연결 확인 | 없음 |
| `GET /channels` | 채널 목록 + 현재 프로그램 + 최근 선곡 | 1분 |
| `GET /channels/:id/now` | 현재·다음 프로그램, 최근 선곡 1건 | 1분 |
| `GET /schedule?channel=&date=` | 하루 편성표 (date 생략 시 오늘, KST) | 10분 |
| `GET /programs/:id` | 프로그램 상세 + 다음 방송 시각 | 10분 |
| `GET /songs?channel=&date=` | 선곡표 | 1분 |
| `GET /search?q=` | 채널 + 프로그램 검색 | 없음 |
| `GET /config` | 앱 설정 | 5분 |
| `GET /notices`, `GET /faqs` | 공지사항, FAQ | 5분 |

## 설치

### 1. DB 서버: 메가헤르츠 DB 만들기 (한 번만)

Session Manager로 DB 서버에 접속해서:

```bash
sudo -u postgres psql
```
```sql
CREATE ROLE mhz_app LOGIN CONNECTION LIMIT 30;
\password mhz_app
CREATE DATABASE mhz OWNER mhz_app;
REVOKE CONNECT ON DATABASE mhz FROM PUBLIC;
\q
```

DailyNews 서버가 `mhz` DB에 접속할 수 있도록 `pg_hba.conf`에 한 줄 추가합니다. `daily_news` 줄을 참고하면 IP와 인증 방식을 그대로 쓸 수 있어요.

```bash
sudo -u postgres psql -At -c "SHOW hba_file;"     # 파일 위치
sudo grep -n daily /path/to/pg_hba.conf            # daily_news 줄 확인
# 아래 줄을 그 밑에 추가 (IP는 DailyNews 서버 사설 IP)
# host  mhz  mhz_app  <DailyNews 서버 사설 IP>/32  scram-sha-256
sudo -u postgres psql -c "SELECT pg_reload_conf();"
```

보안 그룹은 DailyNews 서버가 이미 5432로 접속하고 있으므로 추가할 필요가 없습니다.

### 2. DailyNews 서버: Docker Compose로 띄우기

Docker와 Docker Compose 플러그인이 필요합니다.

```bash
git clone https://github.com/khamaeleon/MHz-BE.git && cd MHz-BE
cp .env.example .env && vi .env                    # DATABASE_URL 비밀번호 입력
docker compose build
docker compose run --rm api node scripts/migrate.js # 테이블 + 채널 8개 생성 (처음 한 번)
docker compose up -d
curl http://127.0.0.1:4100/health                   # {"ok":true}
curl http://127.0.0.1:4100/channels
```

비밀번호에 `@ : / ? #` 같은 문자가 있으면 `DATABASE_URL`에 넣을 때 URL 인코딩해야 합니다(예: `@` → `%40`).

| 컨테이너 | 하는 일 |
| --- | --- |
| `api` | API 서버. 호스트의 `127.0.0.1:4100`에만 열림 (포트는 `.env`의 `MHZ_PORT`로 변경) |
| `crawler` | 수집기. 선곡표는 5분마다, 편성표는 매일 04:00(KST)과 컨테이너 시작 직후 |

자주 쓰는 명령:

```bash
docker compose logs -f api crawler                 # 로그
git pull && docker compose up -d --build           # 업데이트
docker compose run --rm api node scripts/migrate.js # 스키마가 바뀐 뒤
```

### 3. 외부 공개: `https://mhz.api.adpilot.co.kr`

Route 53 의 `mhz.api.adpilot.co.kr` 은 AdPilot 과 같이 쓰는 AWS ALB 를 가리킨다. ALB 의 ACM 인증서가
`*.api.adpilot.co.kr` 을 포함하므로 HTTPS 는 ALB 가 처리하고, 서버에는 certbot·nginx 가 필요 없다.
ALB 에 "이 호스트 이름은 DailyNews 서버의 MHz API 로" 규칙만 추가한다. AdPilot 기존 규칙은 건드리지 않는다.

1. DailyNews 서버 `.env` 에 `MHZ_BIND=0.0.0.0` 추가 → `docker compose up -d` (API 가 사설 IP:4100 으로도 열림)
2. EC2 → 대상 그룹 생성: 대상 유형 인스턴스, HTTP 4100, 대상 = DailyNews 인스턴스(172.31.7.62),
   상태 검사 경로 `/health`
3. DailyNews 인스턴스 보안 그룹: 인바운드 TCP 4100 을 **ALB 의 보안 그룹에서만** 허용 (0.0.0.0/0 금지)
4. EC2 → 로드 밸런서 → AdPilot ALB → HTTPS:443 리스너 → 규칙 추가:
   조건 `호스트 헤더 = mhz.api.adpilot.co.kr` → 2번 대상 그룹으로 전달. 우선순위는 기존 규칙보다 앞(숫자 작게)
5. 확인: `curl https://mhz.api.adpilot.co.kr/health` → `{"ok":true}`

ALB 를 쓰지 않고 이 서버 nginx 로 받으려면 DNS 를 이 서버 공인 IP 로 바꾸고 `deploy/nginx-mhz.conf` + certbot 을 쓴다.

### 로컬 개발 (도커 없이)

```bash
npm install
cp .env.example .env
npm run migrate && npm run dev
```

## 남은 일

- [x] KBS·MBC·SBS 편성표·선곡표 수집기 (`docs/data-sources.md`)
- [ ] EBS FM 추가
- [ ] ALB 규칙 설정 후 앱 실기기에서 편성·선곡 확인 (앱은 `https://mhz.api.adpilot.co.kr` 로 연결해 둠)
