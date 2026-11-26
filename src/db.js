import pg from 'pg';

// bigint(int8) id 를 문자열 대신 숫자로 받는다 (값이 작아서 안전)
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 이 없어요. .env.example 을 복사해 .env 를 만들어 주세요.');
  process.exit(1);
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

/** rows 배열을 돌려주는 짧은 쿼리 함수 */
export async function query(text, params = []) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}
