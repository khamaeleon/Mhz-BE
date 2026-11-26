# 메가헤르츠 (MHz) — Backend

메가헤르츠 앱([MHz-FE](https://github.com/khamaeleon/MHz-FE))에 편성표·선곡표·검색 데이터를 내려주는 Supabase 백엔드입니다.

스트림(오디오)은 앱이 방송사에서 직접 받고, 서버는 방송 정보만 모아서 나눠줍니다. 즐겨찾기·설정은 앱(기기)에 저장하므로 로그인이 없습니다.

## 구성

```
supabase/
  migrations/20261126000000_init.sql   # 테이블 8개 + 읽기 전용 RLS
  seed.sql                             # 채널 8개, 앱 설정 기본값
  functions/
    api/index.ts                       # 읽기 전용 API (앱이 호출)
    crawl/index.ts                     # 편성표·선곡표 수집기 (pg_cron이 호출)
    crawl/sources/{kbs,mbc,sbs}.ts     # 방송사별 수집 로직 (TODO)
```

| 테이블 | 내용 |
| --- | --- |
| `channels` | 채널 목록, 방송사 스트림 API 정보(`resolver_params`) |
| `programs` | 프로그램 정보 (제목, 썸네일, 진행자, 장르) |
| `schedule_slots` | 편성표 한 칸 (채널, 시작·종료 시각, KST 날짜) |
| `songs` | 선곡표 |
| `notices`, `faqs` | 공지사항, FAQ |
| `app_config` | 최소 앱 버전, 긴급 공지 |
| `crawl_runs` | 수집기 실행 기록 (외부 비공개) |

## API (`/functions/v1/api/...`)

| 엔드포인트 | 응답 | 캐시 |
| --- | --- | --- |
| `GET /channels` | 채널 목록 + 현재 프로그램 + 최근 선곡 | 1분 |
| `GET /channels/:id/now` | 현재·다음 프로그램, 최근 선곡 1건 | 1분 |
| `GET /schedule?channel=&date=` | 하루 편성표 (date 생략 시 오늘, KST) | 10분 |
| `GET /programs/:id` | 프로그램 상세 + 다음 방송 시각 | 10분 |
| `GET /songs?channel=&date=` | 선곡표 | 1분 |
| `GET /search?q=` | 채널 + 프로그램 검색 | 없음 |
| `GET /config` | 앱 설정 | 5분 |
| `GET /notices`, `GET /faqs` | 공지사항, FAQ | 5분 |

앱은 요청에 `apikey` / `Authorization: Bearer <anon key>` 헤더를 붙여 호출합니다.

## 로컬 실행

준비물: [Supabase CLI](https://supabase.com/docs/guides/cli), Docker Desktop

```bash
git clone https://github.com/khamaeleon/MHz-BE.git
cd MHz-BE
supabase init            # supabase/config.toml 생성 (처음 한 번)
supabase start           # 로컬 Postgres·API 실행
supabase db reset        # 마이그레이션 + seed 적용
supabase functions serve # Edge Functions 실행

curl -H "Authorization: Bearer <anon key>" http://127.0.0.1:54321/functions/v1/api/channels
```

`supabase init`이 만든 `config.toml`은 커밋해 두세요.

## 배포

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase secrets set CRAWL_SECRET=<임의의 긴 문자열>
supabase functions deploy api
supabase functions deploy crawl
```

### 수집 일정 (pg_cron)

Supabase 대시보드 > Database > Extensions 에서 `pg_cron`, `pg_net`을 켠 뒤 SQL Editor에서 실행합니다.

```sql
-- 편성표: 매일 새벽 4시(KST) = 19:00 UTC
select cron.schedule('crawl-schedule', '0 19 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/crawl?job=schedule',
    headers := jsonb_build_object('x-crawl-secret', '<CRAWL_SECRET>', 'Authorization', 'Bearer <anon key>')
  );
$$);

-- 선곡표: 5분마다
select cron.schedule('crawl-songs', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/crawl?job=songs',
    headers := jsonb_build_object('x-crawl-secret', '<CRAWL_SECRET>', 'Authorization', 'Bearer <anon key>')
  );
$$);
```

## 남은 일

- [ ] 방송사별 편성표·선곡표 원본 찾기 → `crawl/sources/*.ts` 구현 (지금은 빈 배열을 돌려줌)
- [ ] EBS FM 추가
- [ ] 앱(MHz-FE)에서 `/channels`, `/channels/:id/now` 연결
