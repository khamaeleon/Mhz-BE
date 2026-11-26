// 편성표·선곡표 수집기 (Supabase Edge Function, pg_cron 으로 주기 호출)
//
// POST /functions/v1/crawl?job=schedule   편성표: 오늘부터 7일치를 받아 덮어쓴다 (하루 1회)
// POST /functions/v1/crawl?job=songs      선곡표: 방송 중인 채널의 최근 선곡 (5분마다)
//
// 헤더 x-crawl-secret 에 CRAWL_SECRET 값을 넣어 호출한다(쓰기는 service_role 로 수행). 방송사별 수집 원본은 아직 미정이라
// sources/ 아래 각 방송사 파일의 TODO 를 채우면 된다.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { sources } from './sources/index.ts';
import type { Channel } from './sources/types.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function kstDate(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

async function crawlSchedule(channels: Channel[]) {
  const dates = Array.from({ length: 7 }, (_, i) => kstDate(i));
  const result: Record<string, number | string> = {};

  for (const channel of channels) {
    const source = sources[channel.broadcaster];
    try {
      let count = 0;
      for (const date of dates) {
        const slots = await source.fetchSchedule(channel, date);
        for (const slot of slots) {
          let programId: number | null = null;
          if (slot.program) {
            const { data, error } = await admin
              .from('programs')
              .upsert(
                { channel_id: channel.id, ...slot.program, updated_at: new Date().toISOString() },
                { onConflict: 'channel_id,source_key' },
              )
              .select('id')
              .single();
            if (error) throw error;
            programId = data.id;
          }
          const { error } = await admin.from('schedule_slots').upsert(
            {
              channel_id: channel.id,
              program_id: programId,
              title: slot.title,
              starts_at: slot.startsAt,
              ends_at: slot.endsAt,
              air_date: date,
            },
            { onConflict: 'channel_id,starts_at' },
          );
          if (error) throw error;
          count++;
        }
      }
      result[channel.id] = count;
    } catch (e) {
      result[channel.id] = `error: ${(e as Error).message}`;
    }
  }
  return result;
}

async function crawlSongs(channels: Channel[]) {
  const result: Record<string, number | string> = {};
  for (const channel of channels) {
    try {
      const songs = await sources[channel.broadcaster].fetchRecentSongs(channel);
      if (songs.length > 0) {
        const { error } = await admin.from('songs').upsert(
          songs.map((s) => ({ channel_id: channel.id, played_at: s.playedAt, title: s.title, artist: s.artist })),
          { onConflict: 'channel_id,played_at,title', ignoreDuplicates: true },
        );
        if (error) throw error;
      }
      result[channel.id] = songs.length;
    } catch (e) {
      result[channel.id] = `error: ${(e as Error).message}`;
    }
  }
  return result;
}

const CRAWL_SECRET = Deno.env.get('CRAWL_SECRET');

Deno.serve(async (req) => {
  // anon 키로는 호출하지 못하게 별도 비밀값을 확인한다
  if (!CRAWL_SECRET || req.headers.get('x-crawl-secret') !== CRAWL_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const job = new URL(req.url).searchParams.get('job');
  if (job !== 'schedule' && job !== 'songs') {
    return new Response(JSON.stringify({ error: 'job=schedule|songs' }), { status: 400 });
  }

  const { data: run } = await admin.from('crawl_runs').insert({ job }).select('id').single();

  const { data: channels, error } = await admin.from('channels').select('id, broadcaster, resolver_params').eq('is_active', true);
  if (error || !channels) {
    await admin.from('crawl_runs').update({ status: 'error', finished_at: new Date().toISOString(), detail: { error: error?.message } }).eq('id', run?.id);
    return new Response(JSON.stringify({ error: error?.message }), { status: 500 });
  }

  const detail = job === 'schedule' ? await crawlSchedule(channels as Channel[]) : await crawlSongs(channels as Channel[]);
  const failed = Object.values(detail).some((v) => typeof v === 'string');

  await admin
    .from('crawl_runs')
    .update({ status: failed ? 'error' : 'ok', finished_at: new Date().toISOString(), detail })
    .eq('id', run?.id);

  return new Response(JSON.stringify({ job, detail }), { headers: { 'content-type': 'application/json' } });
});
