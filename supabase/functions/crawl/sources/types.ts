export type Channel = {
  id: string;
  broadcaster: 'kbs' | 'mbc' | 'sbs' | 'ebs';
  resolver_params: Record<string, string>;
};

export type ProgramInput = {
  source_key: string;
  title: string;
  thumbnail_url?: string | null;
  genre?: string | null;
  hosts?: string | null;
  homepage_url?: string | null;
  air_days_text?: string | null;
};

export type SlotInput = {
  title: string;
  /** ISO 8601, 타임존 포함 (예: 2026-11-26T16:05:00+09:00) */
  startsAt: string;
  endsAt: string;
  program?: ProgramInput;
};

export type SongInput = {
  playedAt: string;
  title: string;
  artist?: string | null;
};

export interface BroadcasterSource {
  /** date(KST, YYYY-MM-DD) 하루치 편성 */
  fetchSchedule(channel: Channel, date: string): Promise<SlotInput[]>;
  /** 최근 선곡 (지금 방송 중인 프로그램 기준) */
  fetchRecentSongs(channel: Channel): Promise<SongInput[]>;
}
