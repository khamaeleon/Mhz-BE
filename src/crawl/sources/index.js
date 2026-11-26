import { kbs } from './kbs.js';
import { mbc } from './mbc.js';
import { sbs } from './sbs.js';

/** @type {import('./types.js').BroadcasterSource} */
const none = {
  fetchSchedule: async () => [],
  fetchRecentSongs: async () => [],
};

/** @type {Record<string, import('./types.js').BroadcasterSource>} */
export const sources = { kbs, mbc, sbs };

/** 수집 원본이 아직 없는 방송사(EBS·CBS 등)는 빈 결과를 돌려준다. */
export function getSource(broadcaster) {
  return sources[broadcaster] ?? none;
}
