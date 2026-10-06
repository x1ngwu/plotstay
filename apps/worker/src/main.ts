import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { createDatabase } from '@plotstay/database';
import { runTranslationOnce } from '@plotstay/domain';

const provider = process.env.TRANSLATION_PROVIDER ?? 'disabled';
if (provider !== 'disabled') throw new Error('No external translation adapter is configured. Set TRANSLATION_PROVIDER=disabled.');
const db = createDatabase();
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => stop.abort());
try {
  await db.query('SELECT provider FROM translation_jobs LIMIT 1');
  console.log('Translation worker ready; provider disabled, pending tasks are preserved.');
  do {
    await runTranslationOnce(db, null);
    if (process.argv.includes('--once')) break;
    try { await delay(Math.max(250, Number(process.env.WORKER_POLL_MS) || 3000), undefined, { signal: stop.signal }); }
    catch (error) { if (!stop.signal.aborted) throw error; }
  } while (!stop.signal.aborted);
} finally { await db.end(); }
