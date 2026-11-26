// db/migrations/*.sql 중 아직 적용하지 않은 파일을 순서대로 적용하고, db/seed.sql 을 실행한다.
// seed 는 on conflict do nothing 이라 여러 번 실행해도 안전하다.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from '../src/db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'db', 'migrations');

const client = await pool.connect();
try {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`);
  const { rows } = await client.query('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`적용: ${file}`);
    } catch (e) {
      await client.query('rollback');
      throw new Error(`${file} 적용 실패: ${e.message}`);
    }
  }

  await client.query(await readFile(join(root, 'db', 'seed.sql'), 'utf8'));
  console.log('seed 완료');
} finally {
  client.release();
  await pool.end();
}
