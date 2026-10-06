import { randomUUID } from 'node:crypto';
import { createDatabase } from '@plotstay/database';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed } from '../scripts/seed.ts';

export async function fixture() {
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
    await migrate(db);
    const data = await seed(db, credentials);
    return { db, schema, options, credentials, data, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
