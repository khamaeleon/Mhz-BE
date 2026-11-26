import { kbs } from './kbs.ts';
import { mbc } from './mbc.ts';
import { sbs } from './sbs.ts';
import type { BroadcasterSource, Channel } from './types.ts';

const none: BroadcasterSource = {
  fetchSchedule: async () => [],
  fetchRecentSongs: async () => [],
};

export const sources: Record<Channel['broadcaster'], BroadcasterSource> = {
  kbs,
  mbc,
  sbs,
  ebs: none,
};
