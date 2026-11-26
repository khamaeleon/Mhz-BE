// 메가헤르츠 읽기 전용 API (Supabase Edge Function)
// 배포 후 주소: https://<project-ref>.supabase.co/functions/v1/api/<route>
//
// GET /channels                     채널 목록 + 현재 프로그램 + 최근 선곡
// GET /channels/:id/now             현재·다음 프로그램, 최근 선곡 1건
// GET /schedule?channel=&date=      하루 편성표 (date: YYYY-MM-DD, KST, 없으면 오늘)
// GET /programs/:id                 프로그램 상세 + 다음 방송 시각
// GET /songs?channel=&date=         선곡표
// GET /search?q=                    채널 + 프로그램 검색
// GET /config                       최소 앱 버전, 긴급 공지
// GET /notices, GET /faqs           공지사항, FAQ

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
  auth: { persistSession: false },
});

const KST_OFFSET = '+09:00';

function json(body: unknown, maxAgeSec = 0, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAgeSec > 0 ? `public, max-age=${maxAgeSec}` : 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

const notFound = (message = 'not found') => json({ error: message }, 0, 404);
const badRequest = (message: string) => json({ error: message }, 0, 400);

/** 오늘(KST) 날짜 YYYY-MM-DD */
function todayKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** KST 날짜 하루의 [시작, 끝) ISO 범위 */
function kstDayRange(date: string): [string, string] {
  const start = new Date(`${date}T00:00:00${KST_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return [start.toISOString(), end.toISOString()];
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

async function listChannels() {
  const now = new Date().toISOString();
  const recent = new Date(Date.now() - 3 * 3600_000).toISOString();

  const [channels, slots, songs] = await Promise.all([
    supabase.from('channels').select('*').order('sort_order'),
    supabase
      .from('schedule_slots')
      .select('channel_id, title, starts_at, ends_at, program:programs(id, title, thumbnail_url)')
      .lte('starts_at', now)
      .gt('ends_at', now),
    supabase
      .from('songs')
      .select('channel_id, title, artist, played_at')
      .gte('played_at', recent)
      .order('played_at', { ascending: false }),
  ]);
  if (channels.error) throw channels.error;

  const nowByChannel = new Map((slots.data ?? []).map((s) => [s.channel_id, s]));
  const songByChannel = new Map<string, unknown>();
  for (const s of songs.data ?? []) if (!songByChannel.has(s.channel_id)) songByChannel.set(s.channel_id, s);

  return json(
    channels.data.map((c) => ({
      ...c,
      now: nowByChannel.get(c.id) ?? null,
      latest_song: songByChannel.get(c.id) ?? null,
    })),
    60,
  );
}

async function channelNow(id: string) {
  const now = new Date().toISOString();
  const [current, next, song] = await Promise.all([
    supabase
      .from('schedule_slots')
      .select('*, program:programs(*)')
      .eq('channel_id', id)
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('schedule_slots')
      .select('*, program:programs(*)')
      .eq('channel_id', id)
      .gt('starts_at', now)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('songs')
      .select('title, artist, played_at')
      .eq('channel_id', id)
      .order('played_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (current.error) throw current.error;
  return json({ current: current.data, next: next.data, latest_song: song.data }, 60);
}

async function schedule(params: URLSearchParams) {
  const channel = params.get('channel');
  const date = params.get('date') ?? todayKst();
  if (!channel) return badRequest('channel 이 필요해요');
  if (!isDate(date)) return badRequest('date 형식은 YYYY-MM-DD 예요');

  const { data, error } = await supabase
    .from('schedule_slots')
    .select('id, title, starts_at, ends_at, program:programs(id, title, thumbnail_url)')
    .eq('channel_id', channel)
    .eq('air_date', date)
    .order('starts_at');
  if (error) throw error;
  return json(data, 600);
}

async function program(id: string) {
  const programId = Number(id);
  if (!Number.isInteger(programId)) return badRequest('잘못된 프로그램 id');
  const now = new Date().toISOString();
  const [prog, nextAir] = await Promise.all([
    supabase.from('programs').select('*, channel:channels(id, name, frequency)').eq('id', programId).maybeSingle(),
    supabase
      .from('schedule_slots')
      .select('starts_at, ends_at')
      .eq('program_id', programId)
      .gt('ends_at', now)
      .order('starts_at')
      .limit(1)
      .maybeSingle(),
  ]);
  if (prog.error) throw prog.error;
  if (!prog.data) return notFound('프로그램이 없어요');
  return json({ ...prog.data, next_airing: nextAir.data }, 600);
}

async function songs(params: URLSearchParams) {
  const channel = params.get('channel');
  const date = params.get('date') ?? todayKst();
  if (!channel) return badRequest('channel 이 필요해요');
  if (!isDate(date)) return badRequest('date 형식은 YYYY-MM-DD 예요');
  const [from, to] = kstDayRange(date);

  const { data, error } = await supabase
    .from('songs')
    .select('id, title, artist, played_at, program_id')
    .eq('channel_id', channel)
    .gte('played_at', from)
    .lt('played_at', to)
    .order('played_at', { ascending: false });
  if (error) throw error;
  return json(data, 60);
}

async function search(params: URLSearchParams) {
  const q = (params.get('q') ?? '').trim();
  if (q.length === 0) return json({ channels: [], programs: [] });
  // ilike 패턴에 쓰이는 특수문자 제거
  const pattern = `%${q.replace(/[%_,()]/g, '')}%`;

  const [channels, programs] = await Promise.all([
    supabase.from('channels').select('id, name, frequency, logo_url').ilike('name', pattern).order('sort_order'),
    supabase
      .from('programs')
      .select('id, title, thumbnail_url, channel:channels(id, name)')
      .ilike('title', pattern)
      .limit(30),
  ]);
  if (channels.error) throw channels.error;
  if (programs.error) throw programs.error;
  return json({ channels: channels.data, programs: programs.data });
}

async function config() {
  const { data, error } = await supabase.from('app_config').select('key, value');
  if (error) throw error;
  return json(Object.fromEntries(data.map((r) => [r.key, r.value])), 300);
}

async function notices() {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) throw error;
  return json(data, 300);
}

async function faqs() {
  const { data, error } = await supabase.from('faqs').select('*').order('sort_order');
  if (error) throw error;
  return json(data, 300);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json(null);
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 0, 405);

  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const route = parts.slice(parts.indexOf('api') + 1); // '/functions/v1/api/...' 또는 '/api/...'
  const p = url.searchParams;

  try {
    switch (route[0]) {
      case 'channels':
        if (route.length === 1) return await listChannels();
        if (route.length === 3 && route[2] === 'now') return await channelNow(route[1]);
        break;
      case 'schedule':
        return await schedule(p);
      case 'programs':
        if (route[1]) return await program(route[1]);
        break;
      case 'songs':
        return await songs(p);
      case 'search':
        return await search(p);
      case 'config':
        return await config();
      case 'notices':
        return await notices();
      case 'faqs':
        return await faqs();
    }
    return notFound();
  } catch (e) {
    console.error(e);
    return json({ error: 'internal error' }, 0, 500);
  }
});
