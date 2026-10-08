import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, get, request } from 'node:http';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';
import { createContentSchema, editContentSchema } from '@plotstay/contracts';
import { createContent, editContent, getPublished, reviewRevision, submitRevision, unpublishContent } from '@plotstay/domain';
import { fixture } from './helpers.ts';
import { unusedPort, stop, waitFor, artifactHash } from './runtime.ts';

test('built PostgreSQL → standalone API → Astro → browser', { timeout: 120000 }, async t => {
  const f = await fixture();
  t.after(f.cleanup);
  const apiPort = await unusedPort(), webPort = await unusedPort();
  const apiUrl = `http://127.0.0.1:${apiPort}`, webUrl = `http://127.0.0.1:${webPort}`;
  const env = { ...process.env, PGOPTIONS: f.options, NODE_ENV: 'production', SITE_INDEXABLE: 'false', SITE_URL: '', API_HOST: '127.0.0.1', API_PORT: String(apiPort),
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
  const web = launch('apps/web/server.mjs');
  await waitFor(webUrl + '/en', web.child, web.logs);
  const initialHash = await artifactHash();
  const roomPath = '/en/worlds/lathe-worlds/stays/observation-room';
  const room = f.data.ids['observation-room'];

  await t.test('cookie session failures do not invalidate cached Basic Auth credentials', async () => {
    const basic = 'Basic ' + Buffer.from('preview:test-password').toString('base64');
    const proxy = createServer((incoming, outgoing) => {
      if (incoming.headers.authorization !== basic) {
        outgoing.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Plotstay regression"' });
        outgoing.end('Authentication required');
        return;
      }
      const { authorization: _, ...headers } = incoming.headers;
      const upstream = request(webUrl + incoming.url, { method: incoming.method, headers }, response => {
        outgoing.writeHead(response.statusCode!, response.headers);
        response.pipe(outgoing);
      });
      upstream.on('error', () => { outgoing.writeHead(502); outgoing.end(); });
      incoming.pipe(upstream);
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(proxy.address() as import('node:net').AddressInfo).port}`;
    const browser = await chromium.launch();
    try {
      for (const path of ['/en', '/api/auth/me', '/api/guest', '/media/quarters.svg']) {
        const rejected = await fetch(origin + path);
        assert.equal(rejected.status, 401);
        assert.match(rejected.headers.get('www-authenticate')!, /Basic/);
      }
      const context = await browser.newContext();
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      let challenges = 0;
      await cdp.send('Fetch.enable', { handleAuthRequests: true });
      cdp.on('Fetch.requestPaused', event => { void cdp.send('Fetch.continueRequest', { requestId: event.requestId }); });
      cdp.on('Fetch.authRequired', event => {
        challenges++;
        void cdp.send('Fetch.continueWithAuth', { requestId: event.requestId, authChallengeResponse: {
          response: 'ProvideCredentials', username: 'preview', password: 'test-password',
        } });
      });
      for (const path of ['/en', roomPath, '/zh', '/en/account']) {
        assert.equal((await page.goto(origin + path))!.status(), 200);
        const failures = await page.evaluate(async () => {
          return Promise.all(['/api/auth/me', '/api/guest', '/api/me/personas', '/api/admin/worlds'].map(async path => {
            const response = await fetch(path);
            return { status: response.status, challenge: response.headers.get('www-authenticate'), body: await response.json() };
          }));
        });
        for (const failure of failures) {
          assert.equal(failure.status, 403);
          assert.equal(failure.challenge, null);
          assert.equal(failure.body.error.code, 'SESSION_REQUIRED');
        }
      }
      assert.equal(challenges, 1, 'Only the initial visit should request HTTP credentials');
      await context.close();
    } finally {
      await browser.close();
      await new Promise<void>(resolve => { proxy.close(() => resolve()); proxy.closeAllConnections(); });
    }
  });

  await t.test('SSR returns database text, expected routes, no-store headers and real status codes', async () => {
    const redirect = await fetch(webUrl + '/?world=test-harbour', { redirect: 'manual' });
    assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), '/en?world=test-harbour');
    for (const [path, title] of [
      ['/en', 'Lathe Worlds'], ['/zh', '拉斯世界'], [roomPath, 'Observation Room'],
      ['/zh/worlds/lathe-worlds/stays/observation-room', '观察室'],
      ['/en/worlds/lathe-worlds/experiences/forge-walk', 'Forge Walk'], ['/zh?world=test-harbour', '港湾客房'],
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

  await t.test('built server compresses responses and preserves cache, HEAD and byte-range semantics', async () => {
    const raw = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
      new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
        const request = get(webUrl + path, { headers, method }, response => {
          const chunks: Buffer[] = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('error', reject);
          response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks) }));
        });
        request.on('error', reject);
      });
    const plain = await raw('/zh', { 'accept-encoding': 'identity' });
    const css = plain.body.toString().match(/href="([^\"]+\.css)"/)?.[1];
    assert.ok(css && css.startsWith('/_astro/'));
    for (const path of ['/zh', css]) {
      const identity = await raw(path, { 'accept-encoding': 'identity' });
      for (const encoding of ['br', 'gzip']) {
        const packed = await raw(path, { 'accept-encoding': encoding });
        assert.equal(packed.status, 200);
        assert.equal(packed.headers['content-encoding'], encoding);
        assert.match(String(packed.headers.vary), /Accept-Encoding/i);
        assert.deepEqual(encoding === 'br' ? brotliDecompressSync(packed.body) : gunzipSync(packed.body), identity.body);
        assert.ok(packed.body.length < identity.body.length / 2, `${path} compresses substantially`);
        assert.equal(packed.headers['cache-control'], identity.headers['cache-control']);
      }
      const head = await raw(path, { 'accept-encoding': 'br' }, 'HEAD');
      assert.equal(head.status, 200);
      assert.equal(head.body.length, 0);
    }
    assert.equal(plain.headers['cache-control'], 'no-store');
    const fontPath = plain.body.toString().match(/href="([^\"]+\.woff2)"/)?.[1];
    assert.ok(fontPath && fontPath.startsWith('/_astro/'));
    const font = await raw(fontPath);
    assert.match(String(font.headers['cache-control']), /max-age=31536000.*immutable/);
    const partial = await raw(fontPath, { range: 'bytes=0-31', 'accept-encoding': 'br' });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers['content-encoding'], undefined);
    assert.equal(partial.headers['content-range'], `bytes 0-31/${font.body.length}`);
    assert.deepEqual(partial.body, font.body.subarray(0, 32));
  });

  await t.test('browser language navigation keeps detail, world and query; desktop and mobile render', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(webUrl + roomPath);
      assert.equal(await page.locator('h1').innerText(), 'Observation Room');
      await page.locator('.header-actions summary').click();
      await page.getByRole('link', { name: '简体中文', exact: true }).click();
      assert.equal(new URL(page.url()).pathname, '/zh/worlds/lathe-worlds/stays/observation-room');
      assert.equal(await page.locator('h1').innerText(), '观察室');
      await page.reload();
      assert.equal(await page.locator('h1').innerText(), '观察室');
      await page.goto(webUrl + '/en?world=test-harbour&type=stays&q=Harbour');
      await page.locator('.header-actions summary').click();
      await page.getByRole('link', { name: '简体中文', exact: true }).click();
      assert.equal(new URL(page.url()).search, '?world=test-harbour&type=stays&q=Harbour');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(webUrl + '/zh');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'lime');
      // Main ink is #33ff99 in the original digi-tech Lime reference.
      assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).color), 'rgb(51, 255, 153)');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: 'test-results/foundation-mobile.png', fullPage: true });
    } finally { await browser.close(); }
  });

  await t.test('browser management uses same-origin cookies and preserves conflicting input', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('dialog', dialog => void dialog.accept());
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(webUrl + '/zh/admin');
      await page.locator('#login [name=email]').fill(f.credentials.email);
      await page.locator('#login [name=password]').fill(f.credentials.password);
      await page.locator('#login button').click();
      await expect(page.locator('#workspace')).toBeVisible();
      await expect(page.locator('#content-list tr')).toHaveCount(7);
      const cookies = await context.cookies(webUrl + '/api/auth/me');
      assert.ok(cookies.some(cookie => cookie.name === 'plotstay_session' && cookie.httpOnly && cookie.path === '/api'));
      await page.locator('#new').click();
      await page.locator('#toggle-mode').click();
      await page.locator('[name=slug]').fill('browser-managed-room');
      await page.locator('[name=amount]').fill('42');
      await page.locator('[name="en:title"]').fill('Browser managed room');
      await page.locator('[name="en:description"]').fill('English browser draft');
      await page.locator('[name="zh-CN:title"]').fill('浏览器管理客房');
      await page.locator('[name="zh-CN:description"]').fill('中文浏览器草稿');
      await page.locator('#editor button[type=submit]').click();
      await expect(page.locator('#message')).toContainText('草稿已保存');
      const publicPath = webUrl + '/zh/worlds/lathe-worlds/stays/browser-managed-room';
      assert.equal((await fetch(publicPath)).status, 404);
      await page.locator('#submit-revision').click();
      await expect(page.locator('#revision-state')).toContainText('待审核');
      await page.locator('#publish').click();
      await expect(page.locator('#revision-state')).toContainText('已审核');
      assert.ok((await (await fetch(publicPath)).text()).includes('浏览器管理客房'));
      const second = await context.newPage(); second.on('dialog', dialog => void dialog.accept());
      await second.goto(webUrl + '/zh/admin');
      await second.locator('#content-list tr').filter({ hasText: 'Browser managed room' }).getByRole('button').click();
      await page.locator('[name="en:title"]').fill('First editor saved');
      await page.locator('#editor button[type=submit]').click();
      await expect(page.locator('#revision-state')).toContainText('版本 2');
      await second.locator('#toggle-mode').click();
      await second.locator('[name="en:title"]').fill('SECOND EDITOR INPUT MUST REMAIN');
      await second.locator('#editor button[type=submit]').click();
      await expect(second.locator('#message')).toContainText('保存冲突');
      await expect(second.locator('[name="en:title"]')).toHaveValue('SECOND EDITOR INPUT MUST REMAIN');
      await second.close({ runBeforeUnload: false });
      await page.locator('#unpublish').click();
      await expect(page.locator('#message')).toContainText('操作已完成');
      await expect(page.locator('#unpublish')).toBeDisabled();
      assert.equal((await fetch(publicPath)).status, 404);
      await page.getByRole('button', { name: '恢复此发布', exact: true }).click();
      await expect(page.locator('#unpublish')).toBeEnabled();
      assert.equal((await fetch(publicPath)).status, 200);
      await page.locator('#import-panel summary').first().click();
      await page.locator('#import-example').click();
      await page.locator('#import-preview').click();
      await expect(page.locator('#import-results')).toContainText('valid');
      await page.locator('#import-apply').click();
      await expect(page.locator('#import-results')).toContainText('created');
      const invalidOrigin = await fetch(webUrl + '/api/auth/logout', { method: 'POST', headers: { origin: 'https://foreign.invalid', 'content-type': 'application/json' }, body: '{}' });
      assert.equal(invalidOrigin.status, 403);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: 'test-results/management.png', fullPage: true });
      await page.locator('#logout').click();
      await expect(page.locator('#login')).toBeVisible();
      assert.equal((await context.request.get(webUrl + '/api/auth/me')).status(), 403);
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
    assert.ok((await (await fetch(webUrl + '/zh')).text()).includes('来自数据库的即时更新'));
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
    assert.ok(html.includes('<html lang="en"'));
    assert.ok(html.includes('The interface is currently shown in English.'));
    assert.equal(await artifactHash(), initialHash);
  });

  await t.test('unpublishing takes effect immediately and API downtime returns an honest 503', async () => {
    await unpublishContent(f.db, f.data.owner, room, false, 'SSR unpublish test');
    assert.equal((await fetch(webUrl + roomPath)).status, 404);
    assert.equal(await artifactHash(), initialHash);
    await stop(api.child);
    const response = await fetch(webUrl + '/zh');
    assert.equal(response.status, 503);
    assert.ok((await response.text()).includes('内容暂时无法读取'));
  });
});
