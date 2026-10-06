import 'dotenv/config';
import { createDatabase } from '@plotstay/database';
import { createApp } from './app.ts';

const db = createDatabase();
const app = await createApp(db, { logger: true });
app.addHook('onClose', () => db.end());
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  void app.close().catch(error => { app.log.error(error); process.exitCode = 1; });
});
try {
  await db.query('SELECT code FROM locales LIMIT 1');
  await app.listen({ host: process.env.API_HOST ?? '127.0.0.1', port: Number(process.env.API_PORT ?? 4310) });
} catch (error) {
  app.log.error(error, 'API could not start. Check the database and migrations.');
  await app.close();
  process.exitCode = 1;
}
