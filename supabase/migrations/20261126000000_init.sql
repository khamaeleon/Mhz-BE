-- 메가헤르츠(MHz) 초기 스키마
-- 서버에는 모든 사용자가 같이 보는 방송 데이터만 둔다. 즐겨찾기·설정은 앱(기기)에 저장한다.

create table public.channels (
  id               text primary key,              -- 예: kbs-1radio
  broadcaster      text not null check (broadcaster in ('kbs', 'mbc', 'sbs', 'ebs')),
  name             text not null,
  short_name       text not null,
  frequency        text not null,                 -- 서울 기준 MHz, 예: 97.3
  logo_url         text,
  colors           text[] not null default '{}',  -- 카드 그라데이션 [시작, 끝]
  resolver_type    text not null check (resolver_type in ('kbs', 'mbc', 'sbs', 'url')),
  resolver_params  jsonb not null default '{}',   -- 방송사 API가 바뀌면 여기만 고친다
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  updated_at       timestamptz not null default now()
);

create table public.programs (
  id             bigint generated always as identity primary key,
  channel_id     text not null references public.channels (id) on delete cascade,
  title          text not null,
  thumbnail_url  text,
  genre          text,
  hosts          text,
  homepage_url   text,
  air_days_text  text,                            -- 예: 월~금 06:15-07:00
  source_key     text,                            -- 방송사 쪽 프로그램 식별자 (크롤러 중복 방지)
  updated_at     timestamptz not null default now(),
  unique (channel_id, source_key)
);
create index programs_title_idx on public.programs using gin (to_tsvector('simple', title));

create table public.schedule_slots (
  id          bigint generated always as identity primary key,
  channel_id  text not null references public.channels (id) on delete cascade,
  program_id  bigint references public.programs (id) on delete set null,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  air_date    date not null,                      -- KST 기준 날짜
  check (ends_at > starts_at),
  unique (channel_id, starts_at)
);
create index schedule_slots_channel_time_idx on public.schedule_slots (channel_id, starts_at);
create index schedule_slots_channel_date_idx on public.schedule_slots (channel_id, air_date);

create table public.songs (
  id          bigint generated always as identity primary key,
  channel_id  text not null references public.channels (id) on delete cascade,
  program_id  bigint references public.programs (id) on delete set null,
  played_at   timestamptz not null,
  title       text not null,
  artist      text,
  unique (channel_id, played_at, title)
);
create index songs_channel_played_idx on public.songs (channel_id, played_at desc);

create table public.notices (
  id            bigint generated always as identity primary key,
  title         text not null,
  body          text not null,
  is_pinned     boolean not null default false,
  published_at  timestamptz not null default now()
);

create table public.faqs (
  id          bigint generated always as identity primary key,
  question    text not null,
  answer      text not null,
  sort_order  int not null default 0
);

create table public.app_config (
  key    text primary key,
  value  jsonb not null
);

create table public.crawl_runs (
  id          bigint generated always as identity primary key,
  job         text not null,                      -- schedule | songs
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'error')),
  detail      jsonb
);

-- 읽기는 누구나(anon), 쓰기는 service_role(크롤러·관리자)만
alter table public.channels       enable row level security;
alter table public.programs       enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.songs          enable row level security;
alter table public.notices        enable row level security;
alter table public.faqs           enable row level security;
alter table public.app_config     enable row level security;
alter table public.crawl_runs     enable row level security;

create policy "public read" on public.channels       for select using (is_active);
create policy "public read" on public.programs       for select using (true);
create policy "public read" on public.schedule_slots for select using (true);
create policy "public read" on public.songs          for select using (true);
create policy "public read" on public.notices        for select using (true);
create policy "public read" on public.faqs           for select using (true);
create policy "public read" on public.app_config     for select using (true);
-- crawl_runs 는 정책 없음 = anon 접근 불가
