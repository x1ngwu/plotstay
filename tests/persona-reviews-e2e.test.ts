import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { fixture } from './helpers.ts';
import { seedDiscovery } from '../scripts/seed-discovery.ts';
import { unusedPort, waitFor, stop } from './runtime.ts';
import { createAccount, publishedDetail } from '@plotstay/domain';
test('phase 5.6 ordinary account accommodation journey', { timeout: 180000 }, async (t) => {
  const f = await fixture();
  t.after(f.cleanup);
  await seedDiscovery(f.db, f.data);
  await createAccount(f.db, f.data.admin, {
    email: 'traveller@tests.invalid',
    password: 'test-password-123',
  });
  const apiPort = await unusedPort(),
    webPort = await unusedPort(),
    apiUrl = `http://127.0.0.1:${apiPort}`,
    webUrl = `http://127.0.0.1:${webPort}`;
  const env = {
    ...process.env,
    PGOPTIONS: f.options,
    NODE_ENV: 'production',
    SITE_INDEXABLE: 'false',
    API_PORT: String(apiPort),
    API_HOST: '127.0.0.1',
    HOST: '127.0.0.1',
    PORT: String(webPort),
    WEB_ORIGIN: webUrl,
    API_INTERNAL_URL: apiUrl,
  };
  const launch = (entry: string) => {
    const child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    child.stdout!.on('data', (d) => (logs += d));
    child.stderr!.on('data', (d) => (logs += d));
    t.after(() => stop(child));
    return { child, logs: () => logs };
  };
  const a = launch('apps/api/dist/server.mjs');
  await waitFor(apiUrl + '/api/health', a.child, a.logs);
  const w = launch('apps/web/server.mjs');
  await waitFor(webUrl + '/en', w.child, w.logs);
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const login = async (p: any, email: string, password: string) => {
    await expect(p.locator('#account-login')).toBeVisible();
    await p.locator('#account-login [name=email]').fill(email);
    await p.locator('#account-login [name=password]').fill(password);
    await p.locator('#account-login button').click();
    await expect(p.locator('#account-login')).toBeHidden();
    await expect(p.locator('#account-content')).toBeVisible();
    await expect(p.locator('#persona-message')).toHaveText('Signed in.');
  };
  await mkdir('test-results/phase56', { recursive: true });
  let reviewId: string;
  await t.test('normal login, bilingual persona, stay draft and private preview', async () => {
    await page.goto(webUrl + '/en/account');
    await login(page, 'traveller@tests.invalid', 'test-password-123');
    await page.getByRole('button', { name: 'Create persona', exact: true }).click();
    await page.locator('[name="en.name"]').fill('Moss');
    await page.locator('[name="zh-CN.name"]').fill('苔');
    await page.locator('[name="en.bio"]').fill('An archivist');
    await page.locator('[name="zh-CN.bio"]').fill('档案员');
    await page.getByRole('button', { name: 'Save persona', exact: true }).click();
    await expect(page.locator('#account-view')).toContainText('Moss');
    await page.goto(webUrl + '/en/worlds/lathe-worlds/stays/observation-room');
    await page.locator('[data-write-review]').click();
    await page.getByRole('button', { name: 'Start / continue review' }).click();
    await expect(page.locator('[name="en.title"]')).toBeVisible();
    reviewId = new URL(page.url()).searchParams.get('review')!;
    await page.locator('[name="en.title"]').fill('A quiet night');
    await page.locator('[name="en.description"]').fill('The archive stayed quiet.');
    await page.locator('[name="zh-CN.title"]').fill('安静的一夜');
    await page.locator('[name="zh-CN.description"]').fill('档案室很安静。');
    await page.locator('[name=rating]').selectOption('4');
    await page.getByRole('button', { name: 'Save review draft' }).click();
    await expect(page.locator('#persona-message')).toHaveText('Draft saved.');
    await page.getByRole('button', { name: 'Preview saved version' }).click();
    await expect(page.locator('.persona-preview')).toContainText('Moss');
    const anonymous = await fetch(apiUrl + '/api/me/reviews/' + reviewId);
    assert.equal(anonymous.status, 401);
    assert.ok(anonymous.headers.get('cache-control')?.includes('no-store'));
    await page.screenshot({ path: 'test-results/phase56/stay-checkpoint.png', fullPage: true });
    await page.getByRole('button', { name: 'Submit profile and review' }).click();
    await expect(page.locator('#persona-message')).toContainText('Submitted');
  });
  await t.test('joint moderation publishes signature and score without world access for author', async () => {
    const mod = await browser.newPage();
    await mod.goto(webUrl + '/en/account?view=moderation');
    await login(mod, f.credentials.email, f.credentials.password);
    await mod
      .locator('.panel')
      .filter({ has: mod.locator('h3', { hasText: 'A quiet night' }) })
      .getByRole('button', { name: 'Inspect review and persona' })
      .click();
    await expect(mod.locator('.persona-preview')).toContainText('The archive stayed quiet.');
    await mod.getByRole('button', { name: 'Approve and publish', exact: true }).click();
    await expect(mod.locator('#persona-message')).toContainText('Published');
    await mod.close();
    const d = await publishedDetail(f.db, 'en', {
      world: 'lathe-worlds',
      kind: 'stay',
      slug: 'observation-room',
    });
    assert.equal(d.reviewSummary.rating, 4.5);
    await page.goto(webUrl + '/en/worlds/lathe-worlds/stays/observation-room');
    await expect(page.locator(`[data-note-id="${reviewId}"]`)).toContainText('Moss');
    await expect(page.locator(`[data-note-id="${reviewId}"] img`)).toBeVisible();
  });
  await t.test(
    'experience and service reviews, explicit provider binding and bilingual reply moderation',
    async () => {
      const mod = await browser.newPage();
      await mod.goto(webUrl + '/en/account?view=moderation');
      await login(mod, f.credentials.email, f.credentials.password);
      const persona = (
        await f.db.query(
          "SELECT p.id FROM personas p JOIN users u ON u.id=p.owner_id WHERE u.email='traveller@tests.invalid'",
        )
      ).rows[0].id;
      for (const [kind, slug] of [
        ['stay', 'observation-room'],
        ['experience', 'forge-walk'],
        ['service', 'augmetic-tune-up'],
      ]) {
        const path =
          '/en/worlds/lathe-worlds/' +
          ({ stay: 'stays', experience: 'experiences', service: 'services' } as any)[kind!] +
          '/' +
          slug;
        let id = reviewId;
        if (kind !== 'stay') {
          await page.goto(webUrl + path);
          await page.locator('[data-write-review]').click();
          await page.getByRole('button', { name: 'Start / continue review' }).click();
          await expect(page.locator('[name="en.title"]')).toBeVisible();
          id = new URL(page.url()).searchParams.get('review')!;
          await page.locator('[name="en.title"]').fill('My ' + kind + ' review');
          await page.locator('[name="en.description"]').fill('The journey continues.');
          await page.locator('[name="zh-CN.title"]').fill('我的' + kind + '评价');
          await page.locator('[name="zh-CN.description"]').fill('旅程继续。');
          await page.locator('[name=rating]').selectOption('3');
          await page.getByRole('button', { name: 'Save review draft' }).click();
          await expect(page.locator('#persona-message')).toHaveText('Draft saved.');
          await page.getByRole('button', { name: 'Submit profile and review' }).click();
          await expect(page.locator('#persona-message')).toContainText('Submitted');
          await mod.goto(webUrl + '/en/account?view=moderation');
          await mod
            .locator('article.panel')
            .filter({ has: mod.locator('h3', { hasText: 'My ' + kind + ' review' }) })
            .getByRole('button', { name: 'Inspect review and persona' })
            .click();
          await mod.getByRole('button', { name: 'Approve and publish', exact: true }).click();
          await expect(mod.locator('#persona-message')).toContainText('Published');
        }
        const target = (await f.db.query('SELECT id FROM contents WHERE slug=$1', [slug])).rows[0].id;
        await mod.goto(webUrl + '/en/account?view=moderation');
        await expect(mod.locator('[name=bindingWorld]')).toBeVisible();
        await mod.locator('[name=bindingWorld]').selectOption(f.data.latheId);
        await expect(mod.locator('[name=bindingEntry]')).toBeVisible();
        await mod.locator('[name=bindingEntry]').selectOption(target);
        await mod.locator('[name=bindingPersona]').selectOption(persona);
        await mod.getByRole('button', { name: 'Assign provider', exact: true }).click();
        await expect(mod.locator('#persona-message')).toContainText('Provider assigned');
        await page.goto(webUrl + path);
        const card = page.locator('[data-note-id="' + id + '"]');
        await card.locator('[data-provider-reply]').click();
        await expect(page.locator('[name="reply.en"]')).toBeVisible();
        await page.locator('[name="reply.en"]').fill('Thank you, traveller.');
        await page.locator('[name="reply.zh-CN"]').fill('谢谢你，旅客。');
        await page.getByRole('button', { name: 'Save reply draft' }).click();
        await expect(page.locator('#persona-message')).toHaveText('Reply draft saved.');
        await page.getByRole('button', { name: 'Preview saved reply' }).click();
        await expect(page.locator('.persona-preview')).toContainText('Thank you, traveller.');
        await page.getByRole('button', { name: 'Submit reply', exact: true }).click();
        await expect(page.locator('#persona-message')).toHaveText('Reply submitted.');
        await mod.goto(webUrl + '/en/account?view=moderation');
        const title = kind === 'stay' ? 'A quiet night' : 'My ' + kind + ' review';
        await mod
          .locator('article.panel')
          .filter({ has: mod.locator('h3', { hasText: title }) })
          .getByRole('button', { name: 'Inspect review and persona' })
          .click();
        await mod.getByRole('button', { name: 'Moderate provider reply' }).click();
        await expect(mod.locator('.persona-preview')).toContainText('Thank you, traveller.');
        await mod.getByRole('button', { name: 'Publish reply', exact: true }).click();
        await expect(mod.locator('#persona-message')).toHaveText('Reply action completed.');
        for (const locale of ['en', 'zh']) {
          await page.setViewportSize({ width: 390, height: 900 });
          await page.goto(webUrl + path.replace('/en/', '/' + locale + '/'));
          await expect(page.locator('[data-note-id="' + id + '"] .provider-reply')).toContainText(
            locale === 'en' ? 'Thank you, traveller.' : '谢谢你，旅客。',
          );
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({
            path: 'test-results/phase56/' + kind + '-' + locale + '-reply.png',
            fullPage: true,
          });
        }
      }
      await mod.close();
    },
  );
  await t.test('expired session preserves input, bilingual mobile and no horizontal overflow', async () => {
    await page.goto(webUrl + '/en/account?review=' + reviewId);
    await page.locator('[name="en.description"]').fill('Unsaved text remains after expiry.');
    await context.clearCookies();
    await page.getByRole('button', { name: 'Save review draft' }).click();
    await expect(page.locator('#account-login')).toBeVisible();
    await expect(page.locator('[name="en.description"]')).toHaveValue('Unsaved text remains after expiry.');
    await login(page, 'traveller@tests.invalid', 'test-password-123');
    await expect(page.locator('[name="en.description"]')).toHaveValue('Unsaved text remains after expiry.');
    await page.getByRole('button', { name: 'Save review draft' }).click();
    await expect(page.locator('#persona-message')).toHaveText('Draft saved.');
    for (const locale of ['zh', 'en'])
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(webUrl + '/' + locale + '/account?review=' + reviewId);
        await expect(page.locator('[name="en.title"]')).toBeVisible();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
    assert.deepEqual(errors, []);
  });
});
