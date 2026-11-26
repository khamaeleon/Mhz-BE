/**
 * MBC 편성표·선곡표 수집. 출처는 docs/data-sources.md 참고.
 * channel.resolver_params.channel: sfm 표준FM, mfm FM4U, chm 올댓뮤직
 *
 * 선곡은 "지금 나오는 곡" 1건만 주는 API라, 놓치지 않으려면 자주(1분) 불러야 한다.
 * 스케줄러가 MBC 만 1분마다 따로 돌린다(scheduler.js).
 *
 * @type {import('./types.js').BroadcasterSource}
 */
import { clean, imageUrl, compactDate, fetchJson, kstIso } from './util.js';

const CODES = {
  sfm: { schedule: 'FM', now: ['STFM', 'SFM', 'FM'] },
  mfm: { schedule: 'FM4U', now: ['FM4U', 'MFM'] },
  chm: { schedule: 'CHM', now: ['CHAM', 'CHM'] },
};

const hhmm = (t) => {
  const s = String(t).padStart(4, '0');
  return [Number(s.slice(0, 2)), Number(s.slice(2, 4))];
};

// 지금 나오는 곡 API 는 전 채널을 한 번에 주므로, 한 실행 안에서는 한 번만 부른다
let nowCache = null;
async function fetchNowSongs() {
  if (!nowCache || Date.now() - nowCache.at > 30_000) {
    nowCache = { at: Date.now(), items: fetchJson('https://miniapi.imbc.com/music/somitem?rtype=json') };
  }
  try {
    const items = await nowCache.items;
    return Array.isArray(items) ? items : [];
  } catch (e) {
    nowCache = null;
    throw e;
  }
}

/** '♬곡명 - 가수' → { title, artist }. 곡명에 ' - ' 가 있을 수 있어 마지막 ' - ' 로 나눈다 */
function parseSomItem(text) {
  const t = String(text ?? '').replace(/^♬\s*/, '').trim();
  if (!t) return null;
  const i = t.lastIndexOf(' - ');
  if (i < 0) return { title: t, artist: null };
  return { title: t.slice(0, i).trim(), artist: clean(t.slice(i + 3)) };
}

export const mbc = {
  async fetchSchedule(channel, date) {
    const code = CODES[channel.resolver_params?.channel];
    if (!code) return [];
    const items = await fetchJson(
      `https://control.imbc.com/Schedule/Radio?sDate=${compactDate(date)}&sType=${code.schedule}`,
    );
    if (!Array.isArray(items)) return [];

    // 편성은 05:00 부터 다음 날 새벽까지 이어진다. 시작 시각이 앞 슬롯보다 작아지면 자정을 넘긴 것
    let dayOffset = 0;
    let prev = -1;
    return items.map((item) => {
      const [h, m] = hhmm(item.StartTime);
      const minutes = h * 60 + m;
      if (minutes < prev) dayOffset += 1;
      prev = minutes;
      const start = h + dayOffset * 24;
      const running = Number(item.RunningTime) || 0;
      return {
        title: item.Title.trim(),
        startsAt: kstIso(date, start, m),
        endsAt: kstIso(date, start, m + Math.max(running, 1)),
        program: item.BroadcastID
          ? {
              source_key: item.BroadcastID,
              title: item.Title.trim(),
              thumbnail_url: imageUrl(item.Photo),
              homepage_url: clean(item.HomepageURL),
            }
          : undefined,
      };
    });
  },

  async fetchRecentSongs(channel) {
    const code = CODES[channel.resolver_params?.channel];
    if (!code) return [];
    const songs = [];
    for (const item of await fetchNowSongs()) {
      if (!code.now.includes(item.Channel) || !item.RegDate) continue;
      const parsed = parseSomItem(item.SomItem);
      if (!parsed) continue;
      // RegDate: '2026-11-26 19:25:53' (KST)
      songs.push({ playedAt: `${item.RegDate.replace(' ', 'T')}+09:00`, ...parsed });
    }
    return songs;
  },
};
