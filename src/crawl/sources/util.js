// 수집기 공용 도구: 타임아웃 있는 fetch, KST 날짜·시각 변환

const TIMEOUT_MS = 10_000;
const KST_MS = 9 * 3600_000;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; MHzRadioBot/1.0)',
  accept: 'application/json, text/plain, */*',
};

async function request(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res;
}

export async function fetchJson(url) {
  return (await request(url)).json();
}

/** '2026-11-26' → '20261126' */
export const compactDate = (date) => date.replaceAll('-', '');

/** KST 기준 오늘(+offset일) 'YYYY-MM-DD' */
export function kstDate(offsetDays = 0) {
  return new Date(Date.now() + KST_MS + offsetDays * 86400_000).toISOString().slice(0, 10);
}

/**
 * KST 날짜 + 시·분(24시 이상 허용, 분 단위 더하기 허용) → '+09:00' ISO 문자열.
 * 예: kstIso('2026-11-26', 25, 30) → '2026-11-27T01:30:00+09:00'
 */
export function kstIso(date, hour, minute = 0, second = 0) {
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hour, minute, second));
  return `${utc.toISOString().slice(0, 19)}+09:00`;
}

/** 'YYYYMMDDHHMMSS'(KST) → ISO */
export function kstIsoFromStamp(stamp) {
  const s = String(stamp);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}+09:00`;
}

/** 지금부터 lookbackMin 분 전까지와 겹치는 슬롯만 (선곡 수집 대상 프로그램 고르기) */
export function recentSlots(slots, lookbackMin = 60) {
  const now = Date.now();
  const from = now - lookbackMin * 60_000;
  return slots.filter((s) => Date.parse(s.startsAt) <= now && Date.parse(s.endsAt) >= from);
}

/** 빈 문자열·공백을 null 로 */
export const clean = (v) => {
  const t = typeof v === 'string' ? v.trim() : v;
  return t ? t : null;
};

/** 이미지 주소. 앱(iOS ATS)이 http 를 막으므로 https 로 바꾼다(대상 서버들은 https 도 지원) */
export const imageUrl = (v) => clean(v)?.replace(/^http:\/\//, 'https://') ?? null;
