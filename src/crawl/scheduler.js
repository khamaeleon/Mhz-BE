// 수집기 스케줄러 (docker-compose 의 crawler 컨테이너가 실행)
//   선곡표: 시작 직후 + 5분마다
//   편성표: 시작 직후 + 매일 04:00 (KST)
// 같은 작업이 아직 돌고 있으면 이번 회차는 건너뛴다.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), 'run.js');
const SONGS_INTERVAL_MS = 5 * 60_000;
const SCHEDULE_HOUR_KST = 4;
const KST_MS = 9 * 3600_000;

const running = new Set();
const timers = [];

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function runJob(job) {
  if (running.has(job)) {
    log(`${job}: 이전 실행이 아직 끝나지 않아 건너뜀`);
    return Promise.resolve();
  }
  running.add(job);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, job], { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => {
      running.delete(job);
      log(`${job}: 종료 code=${code} (${Math.round((Date.now() - started) / 1000)}s)`);
      resolve();
    });
  });
}

/** 다음 KST hour:00 까지 남은 ms */
function msUntilKstHour(hour) {
  const now = Date.now();
  const kst = new Date(now + KST_MS);
  let target = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), hour) - KST_MS;
  if (target <= now) target += 24 * 3600_000;
  return target - now;
}

function scheduleDaily() {
  const wait = msUntilKstHour(SCHEDULE_HOUR_KST);
  log(`다음 편성표 수집까지 ${Math.round(wait / 60_000)}분`);
  timers.push(
    setTimeout(async () => {
      await runJob('schedule');
      scheduleDaily();
    }, wait),
  );
}

log('스케줄러 시작');
runJob('schedule');
runJob('songs');
timers.push(setInterval(() => runJob('songs'), SONGS_INTERVAL_MS));
scheduleDaily();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log('스케줄러 종료');
    timers.forEach((t) => clearTimeout(t));
    process.exit(0);
  });
}
