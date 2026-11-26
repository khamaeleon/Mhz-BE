# 메가헤르츠 (MHz) — Backend

메가헤르츠 앱([MHz-FE](https://github.com/khamaeleon/MHz-FE))에 편성표·선곡표·검색 데이터를 내려주는 Node.js API 서버입니다.

- 오디오 스트림은 앱이 방송사에서 직접 받고, 서버는 방송 정보만 모아서 나눠줍니다.
- 즐겨찾기·설정은 앱(기기)에 저장하므로 로그인이 없습니다.

## 구성

```
DailyNews 서버 (EC2)                 DB 서버 (EC2-AdPilot-DB)
┌──────────────────────────┐        ┌──────────────────────┐
│ nginx → mhz-api (:4100)  │──VPC──▶│ PostgreSQL 17        │
│ cron  → crawl schedule/songs │    │  DB: mhz / mhz_app   │
└──────────────────────────┘        └──────────────────────┘
```

```
db/migrations/001_init.sql   # 테이블 8개
db/seed.sql                  # 채널 8개, 앱 설정 기본값
scripts/migrate.js           # 마이그레이션 + seed 적용 (여러 번 실행해도 안전)
src/server.js                # API (Fastify)
src/crawl/run.js             # 수집기 (cron 이 실행)
src/crawl/sources/*.js       # 방송사별 수집 로직 (TODO)
deploy/                      # PM2 / systemd / nginx 설정 예시
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

### 2. DailyNews 서버: API 서버 설치

Node.js 20.6 이상이 필요합니다.

```bash
git clone https://github.com/khamaeleon/MHz-BE.git && cd MHz-BE
npm install --omit=dev
cp .env.example .env && vi .env      # DATABASE_URL 비밀번호 입력
npm run migrate                      # 테이블 + 채널 8개 생성
npm start                            # 동작 확인 후 Ctrl+C
curl http://127.0.0.1:4100/channels
```

상시 실행은 DailyNews와 같은 방식으로 합니다.

- PM2: `pm2 start deploy/ecosystem.config.cjs && pm2 save`
- systemd: `deploy/mhz-api.service` 참고

외부(앱)에서 접근하려면 nginx에 `deploy/nginx-mhz.conf`처럼 프록시를 추가하고 HTTPS를 붙입니다.

### 3. 수집 일정 (cron)

`crontab -e`에 추가합니다(경로는 실제 위치로).

```cron
# 편성표: 매일 04:00 (서버 시간대가 UTC면 0 19 * * *)
0 4 * * *   cd /home/ec2-user/MHz-BE && /usr/bin/npm run -s crawl:schedule >> logs/crawl.log 2>&1
# 선곡표: 5분마다
*/5 * * * * cd /home/ec2-user/MHz-BE && /usr/bin/npm run -s crawl:songs >> logs/crawl.log 2>&1
```

(`mkdir -p logs` 먼저)

## 남은 일

- [ ] 방송사별 편성표·선곡표 원본 찾기 → `src/crawl/sources/*.js` 구현 (지금은 빈 배열을 돌려줌)
- [ ] EBS FM 추가
- [ ] API 도메인·HTTPS 연결 후 앱(MHz-FE)에서 `/channels`, `/channels/:id/now` 연결
