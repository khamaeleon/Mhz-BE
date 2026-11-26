// 편성표·선곡표 수집기. 서버의 cron 이 주기적으로 실행한다.
//
//   node --env-file=.env src/crawl/run.js schedule   편성표: 오늘부터 7일치 (하루 1회)
//   node --env-file=.env src/crawl/run.js songs      선곡표: 최근 선곡 (5분마다)
//
// 방송사별 수집 원본은 아직 미정이라 sources/ 의 TODO 를 채우면 된다.

import { pool, query, queryOne } from '../db.js';
import { sources } from './sources/index.js';

const job = process.argv[2];
if (job !== 'schedule' && job !== 'songs') {
  console.error('사용법: node src/crawl/run.js schedule|songs');
  process.exit(1);
}

function kstDate(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

async function upsertProgram(channelId, program) {
  const row = await queryOne(
    `insert into programs (channel_id, source_key, title, thumbnail_url, genre, hosts, homepage_url, air_days_text, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (channel_id, source_key) do update set
       title = excluded.title, thumbnail_url = excluded.thumbnail_url, genre = excluded.genre,
       hosts = excluded.hosts, homepage_url = excluded.homepage_url,
       air_days_text = excluded.air_days_text, updated_at = now()
     returning id`,
    [
      channelId,
      program.source_key,
      program.title,
      program.thumbnail_url ?? null,
      program.genre ?? null,
      program.hosts ?? null,
      program.homepage_url ?? null,
      program.air_days_text ?? null,
    ],
  );
  return row.id;
}

async function crawlSchedule(channels) {
  const dates = Array.from({ length: 7 }, (_, i) => kstDate(i));
  const result = {};
  for (const channel of channels) {
    try {
      let count = 0;
      for (const date of dates) {
        const slots = await sources[channel.broadcaster].fetchSchedule(channel, date);
        for (const slot of slots) {
          const programId = slot.program ? await upsertProgram(channel.id, slot.program) : null;
          await query(
            `insert into schedule_slots (channel_id, program_id, title, starts_at, ends_at, air_date)
             values ($1, $2, $3, $4, $5, $6)
             on conflict (channel_id, starts_at) do update set
               program_id = excluded.program_id, title = excluded.title,
               ends_at = excluded.ends_at, air_date = excluded.air_date`,
            [channel.id, programId, slot.title, slot.startsAt, slot.endsAt, date],
          );
          count++;
        }
      }
      result[channel.id] = count;
    } catch (e) {
      result[channel.id] = `error: ${e.message}`;
    }
  }
  return result;
}

async function crawlSongs(channels) {
  const result = {};
  for (const channel of channels) {
    try {
      const songs = await sources[channel.broadcaster].fetchRecentSongs(channel);
      for (const s of songs) {
        await query(
          `insert into songs (channel_id, played_at, title, artist)
           values ($1, $2, $3, $4)
           on conflict (channel_id, played_at, title) do nothing`,
          [channel.id, s.playedAt, s.title, s.artist ?? null],
        );
      }
      result[channel.id] = songs.length;
    } catch (e) {
      result[channel.id] = `error: ${e.message}`;
    }
  }
  return result;
}

const run = await queryOne(`insert into crawl_runs (job) values ($1) returning id`, [job]);
try {
  const channels = await query(
    `select id, broadcaster, resolver_params from channels where is_active order by sort_order`,
  );
  const detail = job === 'schedule' ? await crawlSchedule(channels) : await crawlSongs(channels);
  const failed = Object.values(detail).some((v) => typeof v === 'string');
  await query(`update crawl_runs set status = $2, finished_at = now(), detail = $3 where id = $1`, [
    run.id,
    failed ? 'error' : 'ok',
    detail,
  ]);
  console.log(JSON.stringify({ job, detail }));
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  await query(`update crawl_runs set status = 'error', finished_at = now(), detail = $2 where id = $1`, [
    run.id,
    { error: e.message },
  ]);
  console.error(e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
