// 메가헤르츠 읽기 전용 API 서버
//
// GET /health                       상태 확인 (DB 연결 포함)
// GET /channels                     채널 목록 + 현재 프로그램 + 최근 선곡
// GET /channels/:id/now             현재·다음 프로그램, 최근 선곡 1건
// GET /schedule?channel=&date=      하루 편성표 (date: YYYY-MM-DD, KST, 없으면 오늘)
// GET /programs/:id                 프로그램 상세 + 다음 방송 시각
// GET /songs?channel=&date=         선곡표
// GET /search?q=                    채널 + 프로그램 검색
// GET /config                       최소 앱 버전, 긴급 공지
// GET /notices, GET /faqs           공지사항, FAQ

import Fastify from 'fastify';

import { pool, query, queryOne } from './db.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-z0-9-]{1,40}$/;

function todayKst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** Cache-Control 헤더를 붙이고 그대로 돌려준다 */
function cached(reply, seconds, body) {
  reply.header('cache-control', `public, max-age=${seconds}`);
  return body;
}

function badRequest(reply, message) {
  return reply.code(400).send({ error: message });
}

const CURRENT_SLOT = `
  select s.title, s.starts_at, s.ends_at,
         p.id as program_id, p.title as program_title, p.thumbnail_url
    from schedule_slots s
    left join programs p on p.id = s.program_id
   where s.channel_id = c.id and s.starts_at <= now() and s.ends_at > now()
   order by s.starts_at desc
   limit 1`;

const LATEST_SONG = `
  select title, artist, played_at
    from songs
   where channel_id = c.id and played_at > now() - interval '3 hours'
   order by played_at desc
   limit 1`;

app.get('/health', async () => {
  await query('select 1');
  return { ok: true };
});

app.get('/channels', async (_req, reply) => {
  const rows = await query(`
    select c.*,
           (select row_to_json(x) from (${CURRENT_SLOT}) x) as now,
           (select row_to_json(y) from (${LATEST_SONG}) y) as latest_song
      from channels c
     where c.is_active
     order by c.sort_order`);
  return cached(reply, 60, rows);
});

app.get('/channels/:id/now', async (req, reply) => {
  const { id } = req.params;
  if (!ID_RE.test(id)) return badRequest(reply, '잘못된 채널 id');

  const row = await queryOne(
    `
    select (select row_to_json(x) from (${CURRENT_SLOT}) x) as current,
           (select row_to_json(n) from (
              select s.title, s.starts_at, s.ends_at,
                     p.id as program_id, p.title as program_title, p.thumbnail_url
                from schedule_slots s
                left join programs p on p.id = s.program_id
               where s.channel_id = c.id and s.starts_at > now()
               order by s.starts_at
               limit 1) n) as next,
           (select row_to_json(y) from (
              select title, artist, played_at from songs
               where channel_id = c.id order by played_at desc limit 1) y) as latest_song
      from channels c
     where c.id = $1`,
    [id],
  );
  if (!row) return reply.code(404).send({ error: '채널이 없어요' });
  return cached(reply, 60, row);
});

app.get('/schedule', async (req, reply) => {
  const { channel, date = todayKst() } = req.query;
  if (!channel || !ID_RE.test(channel)) return badRequest(reply, 'channel 이 필요해요');
  if (!DATE_RE.test(date)) return badRequest(reply, 'date 형식은 YYYY-MM-DD 예요');

  const rows = await query(
    `select s.id, s.title, s.starts_at, s.ends_at,
            p.id as program_id, p.title as program_title, p.thumbnail_url
       from schedule_slots s
       left join programs p on p.id = s.program_id
      where s.channel_id = $1 and s.air_date = $2
      order by s.starts_at`,
    [channel, date],
  );
  return cached(reply, 600, rows);
});

app.get('/programs/:id', async (req, reply) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return badRequest(reply, '잘못된 프로그램 id');

  const row = await queryOne(
    `select p.*,
            json_build_object('id', c.id, 'name', c.name, 'frequency', c.frequency) as channel,
            (select row_to_json(a) from (
               select starts_at, ends_at from schedule_slots
                where program_id = p.id and ends_at > now()
                order by starts_at limit 1) a) as next_airing
       from programs p
       join channels c on c.id = p.channel_id
      where p.id = $1`,
    [id],
  );
  if (!row) return reply.code(404).send({ error: '프로그램이 없어요' });
  return cached(reply, 600, row);
});

app.get('/songs', async (req, reply) => {
  const { channel, date = todayKst() } = req.query;
  if (!channel || !ID_RE.test(channel)) return badRequest(reply, 'channel 이 필요해요');
  if (!DATE_RE.test(date)) return badRequest(reply, 'date 형식은 YYYY-MM-DD 예요');

  const rows = await query(
    `select id, title, artist, played_at, program_id
       from songs
      where channel_id = $1
        and played_at >= ($2::date)::timestamp at time zone 'Asia/Seoul'
        and played_at <  ($2::date + 1)::timestamp at time zone 'Asia/Seoul'
      order by played_at desc`,
    [channel, date],
  );
  return cached(reply, 60, rows);
});

app.get('/search', async (req, reply) => {
  const q = String(req.query.q ?? '').trim().slice(0, 50);
  if (!q) return { channels: [], programs: [] };
  // LIKE 특수문자는 이스케이프해서 글자 그대로 검색
  const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const [channels, programs] = await Promise.all([
    query(
      `select id, name, frequency, logo_url from channels
        where is_active and name ilike $1 order by sort_order`,
      [pattern],
    ),
    query(
      `select p.id, p.title, p.thumbnail_url,
              json_build_object('id', c.id, 'name', c.name) as channel
         from programs p join channels c on c.id = p.channel_id
        where p.title ilike $1
        order by p.title
        limit 30`,
      [pattern],
    ),
  ]);
  return { channels, programs };
});

app.get('/config', async (_req, reply) => {
  const rows = await query('select key, value from app_config');
  return cached(reply, 300, Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.get('/notices', async (_req, reply) => {
  const rows = await query('select * from notices order by is_pinned desc, published_at desc');
  return cached(reply, 300, rows);
});

app.get('/faqs', async (_req, reply) => {
  const rows = await query('select * from faqs order by sort_order');
  return cached(reply, 300, rows);
});

app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  reply.code(err.statusCode && err.statusCode < 500 ? err.statusCode : 500).send({ error: '서버 오류' });
});

const close = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 4100) });
