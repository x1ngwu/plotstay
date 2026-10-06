import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { createContentSchema, editContentSchema } from '@plotstay/contracts';
import { createContent, editContent, getPublished, reviewRevision, submitRevision, unpublishContent } from '@plotstay/domain';
import { fixture } from './helpers.ts';

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}
async function waitFor(url: string, child: ChildProcess, logs: () => string) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`Service exited: ${logs()}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Service did not become ready: ${logs()}`);
}
async function artifactHash() {
  const files = (await readdir('apps/web/dist', { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => `${entry.parentPath}/${entry.name}`).sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(await readFile(file));
  return hash.digest('hex');
}

test('built PostgreSQL → standalone API → Astro → browser', { timeout: 120000 }, async t => {
  const f = await fixture();
  t.after(f.cleanup);
  const apiPort = await unusedPort(), webPort = await unusedPort();
  const apiUrl = `http://127.0.0.1:${apiPort}`, webUrl = `http://127.0.0.1:${webPort}`;
  const env = { ...process.env, PGOPTIONS: f.options, NODE_ENV: 'production', API_HOST: '127.0.0.1', API_PORT: String(apiPort),
    HOST: '127.0.0.1', PORT: String(webPort), WEB_ORIGIN: webUrl, API_INTERNAL_URL: apiUrl };
  const launch = (entry: string) => {
    const child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout!.on('data', chunk => { output += String(chunk); });
    child.stderr!.on('data', chunk => { output += String(chunk); });
    t.after(() => stop(child));
    return { child, logs: () => output };
  };
  const api = launch('apps/api/dist/server.mjs');
  await waitFor(apiUrl + '/api/health', api.child, api.logs);
  const web = launch('apps/web/dist/server/entry.mjs');
  await waitFor(webUrl + '/en', web.child, web.logs);
  const initialHash = await artifactHash();
  const roomPath = '/en/worlds/lathe-worlds/stays/observation-room';
  const room = f.data.ids['observation-room'];

  await t.test('SSR returns database text, expected routes, no-store headers and real status codes', async () => {
    const redirect = await fetch(webUrl + '/?world=test-harbour', { redirect: 'manual' });
    assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), '/en?world=test-harbour');
    for (const [path, title] of [
      ['/en', 'Lathe Worlds'], ['/zh-CN', '拉斯世界'], [roomPath, 'Observation Room'],
      ['/zh-CN/worlds/lathe-worlds/stays/observation-room', '观察室'],
      ['/en/worlds/lathe-worlds/experiences/forge-walk', 'Forge Walk'], ['/zh-CN?world=test-harbour', '港湾客房'],
    ]) {
      const response = await fetch(webUrl + path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const html = await response.text();
      assert.ok(html.includes(title), path);
      assert.ok(!html.includes('DRAFT') && !html.includes('草稿：'));
    }
    for (const path of ['/de', '/en?world=unknown', '/en/worlds/test-harbour/stays/observation-room',
      '/en/worlds/lathe-worlds/stays/unpublished-room', '/en/worlds/lathe-worlds/experiences/missing-translation',
      '/en/worlds/lathe-worlds/invalid/observation-room', '/unknown/path']) {
      assert.equal((await fetch(webUrl + path)).status, 404, path);
    }
  });

  await t.test('browser language navigation keeps detail, world and query; desktop and mobile render', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(webUrl + roomPath);
      assert.equal(await page.locator('h1').innerText(), 'Observation Room');
      await page.getByRole('link', { name: '简体中文', exact: true }).click();
      assert.equal(new URL(page.url()).pathname, '/zh-CN/worlds/lathe-worlds/stays/observation-room');
      assert.equal(await page.locator('h1').innerText(), '观察室');
      await page.reload();
      assert.equal(await page.locator('h1').innerText(), '观察室');
      await page.goto(webUrl + '/en?world=test-harbour&type=stays&q=Harbour');
      await page.getByRole('link', { name: '简体中文', exact: true }).click();
      assert.equal(new URL(page.url()).search, '?world=test-harbour&type=stays&q=Harbour');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(webUrl + '/zh-CN');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'lime');
      assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).color), 'rgb(209, 223, 213)');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: 'test-results/foundation-mobile.png', fullPage: true });
    } finally { await browser.close(); }
  });

  await t.test('publishing changed or newly created content appears without rebuilding or restarting', async () => {
    const current = (await getPublished(f.db, 'en', { id: room }))!;
    const base = (await f.db.query('SELECT head_revision_id FROM contents WHERE id=$1', [room])).rows[0].head_revision_id;
    const changed = await editContent(f.db, f.data.owner, room, editContentSchema.parse({ baseRevisionId: base,
      sourceLocale: 'en', text: { ...current.text, title: 'LIVE UPDATE FROM POSTGRES' }, attributes: current.attributes,
      translations: { 'zh-CN': { ...current.text, title: '来自数据库的即时更新' } } }));
    assert.ok(!(await (await fetch(webUrl + roomPath)).text()).includes('LIVE UPDATE FROM POSTGRES'));
    await submitRevision(f.db, f.data.owner, room, changed.revisionId);
    await reviewRevision(f.db, f.data.owner, room, changed.revisionId, 'publish', 'SSR acceptance');
    assert.ok((await (await fetch(webUrl + roomPath)).text()).includes('LIVE UPDATE FROM POSTGRES'));
    assert.ok((await (await fetch(webUrl + '/zh-CN')).text()).includes('来自数据库的即时更新'));
    const created = await createContent(f.db, f.data.owner, createContentSchema.parse({ worldId: f.data.latheId, kind: 'stay',
      slug: 'created-after-build', sourceLocale: 'en', text: { ...current.text, title: 'CREATED AFTER BUILD' }, attributes: current.attributes,
      translations: { 'zh-CN': { ...current.text, title: '构建后新增' } } }));
    await submitRevision(f.db, f.data.owner, created.id, created.revisionId);
    await reviewRevision(f.db, f.data.owner, created.id, created.revisionId, 'publish', 'New dynamic route');
    const newPage = await fetch(webUrl + '/en/worlds/lathe-worlds/stays/created-after-build');
    assert.equal(newPage.status, 200); assert.ok((await newPage.text()).includes('CREATED AFTER BUILD'));
    assert.equal(await artifactHash(), initialHash);
    assert.equal(web.child.exitCode, null); assert.equal(api.child.exitCode, null);
  });

  await t.test('adding an optional locale after build renders only published fallback text', async () => {
    await f.db.query("INSERT INTO locales(code,name) VALUES ('de','Deutsch')");
    const response = await fetch(webUrl + '/de/worlds/lathe-worlds/stays/observation-room');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('LIVE UPDATE FROM POSTGRES'));
    assert.ok(html.includes('This content is currently shown in its original language.'));
    assert.ok(html.includes('lang="de"'));
    assert.equal(await artifactHash(), initialHash);
  });

  await t.test('unpublishing takes effect immediately and API downtime returns an honest 503', async () => {
    await unpublishContent(f.db, f.data.owner, room, false, 'SSR unpublish test');
    assert.equal((await fetch(webUrl + roomPath)).status, 404);
    assert.equal(await artifactHash(), initialHash);
    await stop(api.child);
    const response = await fetch(webUrl + '/zh-CN');
    assert.equal(response.status, 503);
    assert.ok((await response.text()).includes('内容暂时无法读取'));
  });
});
