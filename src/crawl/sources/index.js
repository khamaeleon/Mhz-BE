import { kbs } from './kbs.js';
import { mbc } from './mbc.js';
import { sbs } from './sbs.js';

/** @type {import('./types.js').BroadcasterSource} */
const none = {
  fetchSchedule: async () => [],
  fetchRecentSongs: async () => [],
};

/** @type {Record<string, import('./types.js').BroadcasterSource>} */
export const sources = { kbs, mbc, sbs, ebs: none };
