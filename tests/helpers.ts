import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDatabase, type Connection } from '@plotstay/database';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed } from '../scripts/seed.ts';

export async function fixture(legacy = false) {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const control = createDatabase();
  const options = `-c search_path=${schema}`;
  const db = createDatabase(undefined, options);
  const credentials = { email: 'admin@tests.plotstay.invalid', password: randomUUID() };
  const cleanup = async () => {
    await db.end();
    // The name is generated here, never read from a user-provided variable.
    await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await control.end();
  };
  try {
    await control.query(`CREATE SCHEMA "${schema}"`);
    if (legacy) {
      await db.query('CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
      for (const name of ['001_foundation.sql', '002_history_guards.sql', '003_translation_execution.sql']) {
        const sql = await readFile(new URL(`../packages/database/migrations/${name}`, import.meta.url), 'utf8');
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)', [name, createHash('sha256').update(sql).digest('hex')]);
      }
    } else await migrate(db);
    const data = await seed(db, credentials);
    return { db, schema, options, credentials, data, cleanup };
  } catch (error) { await cleanup(); throw error; }
}

export async function historyDigest(db: Connection) {
  const tables = ['contents', 'content_revisions', 'translations', 'revision_locales', 'publications', 'publication_locales',
    'translation_jobs', 'moderation_events', 'users', 'worlds', 'bookings'];
  const hash = createHash('sha256');
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { rows } = await db.query(`SELECT to_jsonb(t)::text AS value FROM ${table} t ORDER BY to_jsonb(t)::text`);
    counts[table] = rows.length; hash.update(table).update(JSON.stringify(rows));
  }
  return { counts, sha256: hash.digest('hex') };
}
