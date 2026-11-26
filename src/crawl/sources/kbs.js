/**
 * KBS 편성표·선곡표 수집. 출처는 docs/data-sources.md 참고.
 * channel.resolver_params.code: 21 1라디오, 22 2라디오, 23 3라디오, 24 1FM(클래식), 25 2FM(쿨), 26 한민족
 *
 * @type {import('./types.js').BroadcasterSource}
 */
import { clean, imageUrl, compactDate, fetchJson, kstDate, kstIso, kstIsoFromStamp, recentSlots } from './util.js';

const SCHEDULE_URL = 'https://static.api.kbs.co.kr/mediafactory/v1/schedule/weekly';
const SONGS_URL = 'https://kong2017.kbs.co.kr/api/mobile/select_song_list';

/** 'HHMMSS00' → [시, 분, 초] */
function parseTime(t) {
  const s = String(t).padStart(8, '0');
  return [Number(s.slice(0, 2)), Number(s.slice(2, 4)), Number(s.slice(4, 6))];
}

const dashed = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

function toSlot(item) {
  const date = dashed(item.service_date);
  const [sh, sm, ss] = parseTime(item.service_start_time);
  let [eh, em, es] = parseTime(item.service_end_time);
  // 종료가 시작보다 이르면 자정을 넘긴 것
  if (eh * 3600 + em * 60 + es <= sh * 3600 + sm * 60 + ss) eh += 24;
  return {
    title: clean(item.programming_table_title) ?? item.program_title,
    startsAt: kstIso(date, sh, sm, ss),
    endsAt: kstIso(date, eh, em, es),
    programCode: item.program_code,
    plannedDate: item.program_planned_date,
    program: item.program_code
      ? {
          source_key: item.program_code,
          title: item.program_title,
          thumbnail_url: imageUrl(item.image_w),
          hosts: clean(item.program_actor),
          homepage_url: clean(item.homepage_url),
        }
      : undefined,
  };
}

/** from~to(YYYYMMDD) 편성 슬롯 */
async function fetchSlots(code, from, to) {
  const url =
    `${SCHEDULE_URL}?local_station_code=00&channel_code=${code}` +
    `&program_planned_date_from=${from}&program_planned_date_to=${to}`;
  const days = await fetchJson(url);
  return (Array.isArray(days) ? days : []).flatMap((d) => d.schedules ?? []).map(toSlot);
}

export const kbs = {
  async fetchSchedule(channel, date) {
    const d = compactDate(date);
    return (await fetchSlots(channel.resolver_params.code, d, d)).map(
      ({ programCode: _c, plannedDate: _p, ...slot }) => slot,
    );
  },

  async fetchRecentSongs(channel) {
    // 새벽 방송은 전날 편성에 들어 있어서 어제~오늘을 같이 본다
    const slots = await fetchSlots(channel.resolver_params.code, compactDate(kstDate(-1)), compactDate(kstDate()));
    const recent = recentSlots(slots);
    const codes = [...new Set(recent.map((s) => s.programCode).filter(Boolean))];
    if (codes.length === 0) return [];

    // request_date 가 편성일인지 실제 방송일인지 확실하지 않아 둘 다 조회한다(보통 같은 날 하나)
    const dates = [...new Set(recent.flatMap((s) => [s.plannedDate, compactDate(s.startsAt.slice(0, 10))]))];
    const songs = [];
    for (const date of dates) {
      const url =
        `${SONGS_URL}?program_code=${codes.join(',')}&rtype=json` +
        `&request_date=${date}&page=1&page_size=200`;
      const json = await fetchJson(url);
      for (const item of json.items ?? []) {
        if (!item.song_title || !item.timestamp) continue;
        songs.push({
          playedAt: kstIsoFromStamp(item.timestamp),
          title: item.song_title.trim(),
          artist: clean(item.artist),
        });
      }
    }
    return songs;
  },
};
