/**
 * SBS 편성표·선곡표 수집. 출처는 docs/data-sources.md 참고.
 * channel.resolver_params.path 로 채널을 구분한다(lovepc/lovefm → Love, powerpc/powerfm → Power).
 * 고릴라디오M 은 편성표 파일이 없어 수집하지 않는다.
 *
 * @type {import('./types.js').BroadcasterSource}
 */
import { clean, imageUrl, compactDate, fetchJson, kstDate, kstIso, kstIsoFromStamp, recentSlots } from './util.js';

function scheduleName(channel) {
  const path = channel.resolver_params?.path ?? '';
  if (path.includes('love')) return 'Love';
  if (path.includes('power')) return 'Power';
  return null;
}

/** 'HH:MM' (24시 이상 가능) → [시, 분] */
const parseTime = (t) => String(t).split(':').map(Number);

/** 편성표 programId 'S08_22000015142' → '22000015142' (메뉴 API 로 못 찾을 때의 대안) */
const idSuffix = (programId) => String(programId ?? '').split('_').pop() || null;

/**
 * 선곡 API 의 프로그램 ID(vodid). 편성표 programId 와 다른 프로그램이 있어서
 * (예: 러브게임 S01_V2000010869 → V0000336099) 프로그램 메뉴 API 에서 찾는다.
 */
async function resolvePlaylistId(slot) {
  if (slot.programCode) {
    try {
      const menu = await fetchJson(`https://static.apis.sbs.co.kr/program-api/1.0/menu/${slot.programCode}`);
      const vodid = JSON.stringify(menu).match(/"vodid":"([^"]+)"/)?.[1];
      if (vodid) return vodid;
    } catch {
      // 메뉴가 없으면 아래 대안으로
    }
  }
  return idSuffix(slot.programId);
}

async function fetchSlots(name, date) {
  const [y, m, d] = date.split('-').map(Number);
  // 경로의 월·일은 앞자리 0 없이 써야 한다 (2026/1/5)
  const items = await fetchJson(`https://static.cloud.sbs.co.kr/schedule/${y}/${m}/${d}/${name}.json`);
  return (Array.isArray(items) ? items : []).map((item) => {
    const [sh, sm] = parseTime(item.start_time);
    let [eh, em] = parseTime(item.end_time);
    if (eh * 60 + em <= sh * 60 + sm) eh += 24;
    return {
      title: item.title.trim(),
      startsAt: kstIso(date, sh, sm),
      endsAt: kstIso(date, eh, em),
      programId: item.programId,
      programCode: clean(item.programcode),
      airDate: date,
      program: item.programId
        ? {
            source_key: item.programId,
            title: item.title.trim(),
            thumbnail_url: imageUrl(item.program_image),
            hosts: null,
            homepage_url: clean(item.homepage_url),
          }
        : undefined,
    };
  });
}

export const sbs = {
  async fetchSchedule(channel, date) {
    const name = scheduleName(channel);
    if (!name) return [];
    return (await fetchSlots(name, date)).map(
      ({ programId: _i, programCode: _c, airDate: _d, ...slot }) => slot,
    );
  },

  async fetchRecentSongs(channel) {
    const name = scheduleName(channel);
    if (!name) return [];
    // 자정 넘어 방송(24:00~26:00)은 전날 파일에 들어 있다
    const slots = [...(await fetchSlots(name, kstDate(-1))), ...(await fetchSlots(name, kstDate()))];
    const recent = recentSlots(slots);

    const songs = [];
    const seen = new Set();
    for (const slot of recent) {
      const key = `${slot.programId}/${slot.airDate}`;
      if (!slot.programId || seen.has(key)) continue;
      seen.add(key);
      const id = await resolvePlaylistId(slot);
      if (!id) continue;
      // 선곡 목록은 편성표 파일 날짜(방송일) 기준. 24:00 이후 방송도 전날 날짜로 묶인다
      const json = await fetchJson(`https://apis.sbs.co.kr/radio-api/playlist/${id}/${compactDate(slot.airDate)}`);
      for (const item of json?.data?.playlist ?? []) {
        const title = clean(item.SONG_TITLE) ?? clean(item.ALBUM_TITLE);
        if (!title || !item.START_TIME || item.DISPLAY_YN === 'N') continue;
        songs.push({
          playedAt: kstIsoFromStamp(item.START_TIME),
          title,
          artist: clean(item.ARTIST_NAME),
        });
      }
    }
    return songs;
  },
};
