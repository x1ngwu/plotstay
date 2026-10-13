import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../packages/database/src/migrate.ts';
import { seed } from '../scripts/seed.ts';
import { fixture, historyDigest } from './helpers.ts';
import { listLocales, getPublished } from '@plotstay/domain';

test('upgrade from populated 001–003 preserves all history, credentials and jobs across repeated migrate/seed', async t => {
  const f = await fixture(true); t.after(f.cleanup);
  // Compare every original column; 012 adds independent submission pointers.
  const before = await historyDigest(f.db,true);
  await migrate(f.db); await seed(f.db, f.credentials);
  await migrate(f.db); await seed(f.db, f.credentials);
  assert.deepEqual(await historyDigest(f.db,true), before);
  assert.deepEqual((await listLocales(f.db)).map(l => [l.code, l.pathPrefix, l.languageTag]), [['en', 'en', 'en'], ['zh-CN', 'zh', 'zh-Hans']]);
  assert.equal((await getPublished(f.db, 'zh-CN', { id: f.data.ids['observation-room'] }))!.text.title, '观察室');
  await f.db.query("INSERT INTO locales(code,name) VALUES ('de','Deutsch')");
  assert.equal((await listLocales(f.db)).find(l => l.code === 'de')!.pathPrefix, 'de');
  await assert.rejects(() => f.db.query("INSERT INTO locales(code,name,path_prefix,language_tag) VALUES ('fr','Français','zh','fr')"));
  await assert.rejects(() => f.db.query("INSERT INTO locales(code,name,path_prefix,language_tag) VALUES ('fr','Français','FR','fr')"));
});
