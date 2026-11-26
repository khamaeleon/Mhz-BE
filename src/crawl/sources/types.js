/**
 * 방송사별 수집기가 지켜야 할 형태 (JSDoc 타입)
 *
 * @typedef {{ id: string, broadcaster: string, resolver_params: Record<string, string> }} Channel
 * @typedef {{ source_key: string, title: string, thumbnail_url?: string|null, genre?: string|null,
 *             hosts?: string|null, homepage_url?: string|null, air_days_text?: string|null }} ProgramInput
 * @typedef {{ title: string, startsAt: string, endsAt: string, program?: ProgramInput }} SlotInput
 *   startsAt/endsAt: 타임존 포함 ISO 8601 (예: 2026-11-26T16:05:00+09:00)
 * @typedef {{ playedAt: string, title: string, artist?: string|null }} SongInput
 * @typedef {{
 *   fetchSchedule: (channel: Channel, date: string) => Promise<SlotInput[]>,
 *   fetchRecentSongs: (channel: Channel) => Promise<SongInput[]>,
 * }} BroadcasterSource
 */
export {};
