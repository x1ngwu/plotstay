import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createContentSchema, editContentSchema } from '@plotstay/contracts';
import { createContent, editContent, getPublished, reviewRevision, submitRevision, restorePublication, unpublishContent } from '@plotstay/domain';
import { fixture } from './helpers.ts';
import { unusedPort, stop, waitFor, artifactHash } from './runtime.ts';
import { siteConfig } from '../apps/web/src/lib/seo.ts';

const origin = 'https://plotstay-seo.invalid';
const roomPath = '/en/worlds/lathe-worlds/stays/observation-room';
test('SEO configuration rejects unsafe or missing origins and never infers indexing from production', () => {
  assert.deepEqual(siteConfig({ NODE_ENV: 'production' }), { indexable: false });
  for (const SITE_URL of ['', 'http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://example.com/path',
    'https://user:pass@example.com', 'https://example.com/?q=1', 'https://example.com/#fragment']) {
    assert.throws(() => siteConfig({ SITE_INDEXABLE: 'true', SITE_URL }), /SITE_URL/);
  }
  assert.throws(() => siteConfig({ SITE_INDEXABLE: 'yes' }), /SITE_INDEXABLE/);
});

test('SEO-01–05: live API, built SSR, XML and publication lifecycle', { timeout: 120000 }, async t => {
  const f = await fixture(); t.after(f.cleanup);
  const apiPort = await unusedPort(), webPort = await unusedPort();
  const apiUrl = `http://127.0.0.1:${apiPort}`, webUrl = `http://127.0.0.1:${webPort}`;
  const env = { ...process.env, PGOPTIONS: f.options, NODE_ENV: 'production', API_HOST: '127.0.0.1', API_PORT: String(apiPort),
    HOST: '127.0.0.1', PORT: String(webPort), WEB_ORIGIN: webUrl, API_INTERNAL_URL: apiUrl, SITE_INDEXABLE: 'true', SITE_URL: origin };
  const launch = (entry: string, extra = {}) => {
    const child = spawn(process.execPath, [entry], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout!.on('data', chunk => { output += String(chunk); }); child.stderr!.on('data', chunk => { output += String(chunk); });
    t.after(() => stop(child)); return { child, logs: () => output };
  };
  const api = launch('apps/api/dist/server.mjs'); await waitFor(apiUrl + '/api/health', api.child, api.logs);
  const web = launch('apps/web/dist/server/entry.mjs'); await waitFor(webUrl + '/en', web.child, web.logs);
  const initialHash = await artifactHash();
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage();
  const inspect = async (path: string, init?: RequestInit) => {
    const res = await fetch(webUrl + path, { redirect: 'manual', ...init }); const html = await res.text();
    const data = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return { lang: doc.documentElement.lang, canonicals: [...doc.querySelectorAll('link[rel=canonical]')].map(el => el.getAttribute('href')),
        alternates: [...doc.querySelectorAll('link[rel=alternate][hreflang]')].map(el => ({ tag: el.getAttribute('hreflang'), url: el.getAttribute('href') })),
        robots: doc.querySelector('meta[name=robots]')?.getAttribute('content'),
        links: [...doc.querySelectorAll('a')].map(el => el.getAttribute('href')), title: doc.title,
        description: doc.querySelector('meta[name=description]')?.getAttribute('content') };
    }, html);
    return { ...data, status: res.status, headers: res.headers, html };
  };
  const noindex = (data: Awaited<ReturnType<typeof inspect>>) => {
    assert.deepEqual(data.canonicals, []); assert.deepEqual(data.alternates, []);
    assert.match(data.robots ?? '', /noindex/); assert.match(data.headers.get('x-robots-tag') ?? '', /noindex/);
  };
  const sitemap = async () => {
    const res = await fetch(webUrl + '/sitemap.xml'); assert.equal(res.status, 200); assert.match(res.headers.get('content-type')!, /application\/xml/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const parsed = await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      return { error: !!doc.querySelector('parsererror'), root: doc.documentElement.localName, namespace: doc.documentElement.namespaceURI,
        urls: [...doc.querySelectorAll('loc')].map(el => el.textContent!), lastmod: doc.querySelectorAll('lastmod').length };
    }, await res.text());
    assert.equal(parsed.error, false); assert.equal(parsed.root, 'urlset'); assert.equal(parsed.namespace, 'http://www.sitemaps.org/schemas/sitemap/0.9');
    assert.equal(parsed.lastmod, 0); assert.equal(new Set(parsed.urls).size, parsed.urls.length); return parsed.urls;
  };
  const publish = async (content: { id: string; revisionId: string }) => {
    await submitRevision(f.db, f.data.owner, content.id, content.revisionId);
    return reviewRevision(f.db, f.data.owner, content.id, content.revisionId, 'publish', 'SEO acceptance');
  };
  const sample = (slug: string, sourceLocale = 'en', translations: Record<string, unknown> = { 'zh-CN': { title: '测试客房', description: '公开中文正文' } }) =>
    createContentSchema.parse({ worldId: f.data.latheId, kind: 'stay', slug, sourceLocale, text: { title: 'SEO test room', description: 'Published source' },
      translations, attributes: { price: { amount: 1, unit: 'night' } } });

  await t.test('one-hop GET/HEAD normalization preserves query, slug case and API/write paths', async () => {
    for (const method of ['GET', 'HEAD']) {
      for (const prefix of ['zh-CN', 'zh-cn', 'ZH-cn', 'ZH-CN', 'ZH', 'Zh', 'EN']) {
        for (const suffix of ['', '/', '/admin/', '/worlds/lathe-worlds/stays/observation-room/', '/worlds/lathe-worlds/experiences/forge-walk/']) {
          const target = '/' + (prefix.toLowerCase() === 'en' ? 'en' : 'zh') + suffix.replace(/\/$/, '') + '?world=test-harbour&type=all&q=a%26b';
          const response = await fetch(webUrl + '/' + prefix + suffix + '?world=test-harbour&type=all&q=a%26b', { method, redirect: 'manual' });
          assert.equal(response.status, 308); assert.equal(response.headers.get('location'), target);
          assert.equal((await fetch(webUrl + target, { method, redirect: 'manual' })).status, 200);
        }
      }
    }
    const mixed = await fetch(webUrl + '/ZH-CN/worlds/Lathe-Worlds/stays/Observation-Room/', { redirect: 'manual' });
    assert.equal(mixed.headers.get('location'), '/zh/worlds/Lathe-Worlds/stays/Observation-Room');
    assert.equal((await fetch(webUrl + mixed.headers.get('location'))).status, 404);
    for (const path of ['/unknown/', '/zh-hant', '/xx/admin', '/zh/missing/deep/path']) {
      const data = await inspect(path); assert.equal(data.status, 404); noindex(data);
    }
    assert.match((await inspect('/zh/missing/deep/path')).html, /未找到此页面/);
    const post = await fetch(webUrl + '/ZH-CN/admin/', { method: 'POST', redirect: 'manual' });
    assert.equal(post.headers.get('location'), null); assert.notEqual(post.status, 308);
    const apiPath = await fetch(webUrl + '/api/locales/', { redirect: 'manual' });
    assert.equal(apiPath.headers.get('location'), null);
    const locales = (await (await fetch(apiUrl + '/api/locales')).json()).locales;
    assert.deepEqual(locales.find((l: any) => l.code === 'zh-CN'), { code: 'zh-CN', name: '简体中文', pathPrefix: 'zh', languageTag: 'zh-Hans' });
    assert.equal((await (await fetch(apiUrl + `/api/contents/${f.data.ids['observation-room']}?locale=zh-CN`)).json()).content.locale, 'zh-CN');
  });

  await t.test('SSR canonical, reciprocal actual-language hreflang, parameters and trusted origin', async () => {
    const urls = await sitemap(); assert.equal(urls.length, 14);
    for (const canonical of urls) {
      const parsed = new URL(canonical); assert.equal(parsed.origin, origin);
      const data = await inspect(parsed.pathname + parsed.search);
      assert.equal(data.status, 200); assert.deepEqual(data.canonicals, [canonical]); assert.ok(!data.robots);
      assert.ok(data.title && data.description); assert.equal(data.lang, parsed.pathname.startsWith('/zh') ? 'zh-Hans' : 'en');
      assert.equal(data.links.some(href => href?.includes('/zh-CN')), false);
      assert.equal(data.alternates.length, 3); assert.ok(data.alternates.some(a => a.url === canonical));
      assert.equal(data.alternates.find(a => a.tag === 'x-default')?.url, origin + parsed.pathname.replace(/^\/zh/, '/en') + parsed.search);
      for (const alt of data.alternates) {
        const target = new URL(alt.url!); const other = await inspect(target.pathname + target.search);
        assert.equal(other.status, 200); assert.deepEqual(other.alternates, data.alternates);
      }
    }
    for (const [path, canonical] of [
      ['/zh?world=lathe-worlds&type=all&utm_source=x&q=%20', '/zh'],
      ['/en?world=test-harbour&type=all&utm_source=x', '/en?world=test-harbour'],
      [roomPath + '?world=test-harbour&type=stays&q=x&utm_source=x', roomPath],
    ]) assert.deepEqual((await inspect(path)).canonicals, [origin + canonical]);
    for (const path of ['/zh?q=观察', '/en?type=stays', '/zh?type=experiences', '/en?world=test-harbour&q=Harbour', '/en/admin', '/zh/admin']) noindex(await inspect(path));
    for (const path of ['/en?type=invalid', '/zh?world=missing', '/zh/worlds/lathe-worlds/stays/unpublished-room']) {
      const data = await inspect(path); assert.equal(data.status, 404); noindex(data);
    }
    const spoofed = await inspect('/zh', { headers: { host: 'evil.invalid', 'x-forwarded-host': 'evil.invalid', 'x-forwarded-proto': 'http' } });
    assert.deepEqual(spoofed.canonicals, [origin + '/zh']); assert.ok(spoofed.alternates.every(alt => alt.url!.startsWith(origin)));
    const robots = await (await fetch(webUrl + '/robots.txt')).text();
    assert.match(robots, /Allow: \//); assert.ok(!robots.includes('Disallow:')); assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  });

  await t.test('SSR descriptions use published text in the page language when summaries are empty', async () => {
    const descriptions = { en: 'The "quiet" room & its library.\n\tStay beside the river.', 'zh-CN': '安静的客房与图书馆。\n\t在河边住一晚。' };
    const expected = { en: 'The "quiet" room & its library. Stay beside the river.', 'zh-CN': '安静的客房与图书馆。 在河边住一晚。' };
    const input = createContentSchema.parse({ ...sample('description-fallback'),
      text: { title: 'A room with no summary', summary: '', description: descriptions.en },
      translations: { 'zh-CN': { title: '没有摘要的客房', description: descriptions['zh-CN'] } } });
    const content = await createContent(f.db, f.data.owner, input); await publish(content);
    const variants = [['en', 'en'], ['zh', 'zh-CN']] as const;
    for (const [prefix, code] of variants) {
      const path = `/${prefix}/worlds/lathe-worlds/stays/description-fallback`;
      const data = await inspect(path);
      assert.equal(data.status, 200); assert.equal(data.description, expected[code]);
      assert.deepEqual(data.canonicals, [origin + path]); assert.ok(!data.robots);
    }
    const longDescriptions = { en: 'Explore the riverside workshop and meet its resident guide. '.repeat(20), 'zh-CN': '🚀参观河畔工坊，认识这里的向导。'.repeat(30) };
    const experience = await createContent(f.db, f.data.owner, createContentSchema.parse({ ...sample('description-excerpt'),
      kind: 'experience', text: { title: 'Workshop tour', description: longDescriptions.en },
      translations: { 'zh-CN': { title: '工坊之旅', summary: '  ', description: longDescriptions['zh-CN'] } },
      attributes: { price: { amount: 1, unit: 'person' }, durationMinutes: 60 } }));
    await publish(experience);
    for (const [prefix, code] of variants) {
      const data = await inspect(`/${prefix}/worlds/lathe-worlds/experiences/description-excerpt`);
      assert.equal(data.status, 200); assert.ok(data.description && data.description.endsWith('…'));
      assert.ok(Array.from(data.description).length <= 200);
      assert.ok(longDescriptions[code].startsWith(data.description.slice(0, -1)));
      assert.ok(data.html.includes(longDescriptions[code].trim()));
    }
    const summaries = { en: 'An editor-selected summary. '.repeat(9).trim(), 'zh-CN': '这是编辑选择的人工摘要。'.repeat(18) };
    const draft = await editContent(f.db, f.data.owner, content.id, editContentSchema.parse({
      baseRevisionId: content.revisionId, sourceLocale: input.sourceLocale,
      text: { ...input.text, summary: summaries.en }, attributes: input.attributes,
      translations: { 'zh-CN': { ...input.translations['zh-CN'], summary: summaries['zh-CN'] } } }));
    assert.equal((await inspect('/en/worlds/lathe-worlds/stays/description-fallback')).description, expected.en);
    await publish({ id: content.id, revisionId: draft.revisionId });
    for (const [prefix, code] of variants) assert.equal((await inspect(`/${prefix}/worlds/lathe-worlds/stays/description-fallback`)).description, summaries[code]);
  });

  await t.test('preview is noindex with empty sitemap; invalid indexed config fails explicitly', async () => {
    const previewPort = await unusedPort(); const previewUrl = `http://127.0.0.1:${previewPort}`;
    const preview = launch('apps/web/dist/server/entry.mjs', { PORT: String(previewPort), SITE_INDEXABLE: undefined, SITE_URL: undefined });
    await waitFor(previewUrl + '/en', preview.child, preview.logs);
    for (const path of ['/en', '/zh/admin', '/unknown', '/sitemap.xml', '/robots.txt']) {
      const res = await fetch(previewUrl + path); const body = await res.text();
      assert.match(res.headers.get('x-robots-tag')!, /noindex/); assert.ok(!body.includes('rel="canonical"')); assert.ok(!body.includes('hreflang='));
      if (path === '/sitemap.xml') assert.ok(!body.includes('<loc>'));
      if (path === '/robots.txt') assert.ok(!body.includes('Sitemap:') && !body.includes('Disallow:'));
    }
    await stop(preview.child);
    const badPort = await unusedPort(); const bad = launch('apps/web/dist/server/entry.mjs', { PORT: String(badPort), SITE_URL: '' });
    // The standalone server imports middleware on its first request; any request fails closed.
    let response: Response | undefined;
    for (let i = 0; i < 100; i++) {
      try { response = await fetch(`http://127.0.0.1:${badPort}/en`); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(response?.status, 503); assert.match(await response!.text(), /Invalid site configuration/);
    assert.match(bad.logs(), /SITE_URL/); await stop(bad.child);
  });

  await t.test('new locale and drafts never claim a complete translation; UI and body languages are distinct', async () => {
    await f.db.query("INSERT INTO locales(code,name,path_prefix,language_tag) VALUES ('de','Deutsch','de','de')");
    const draft = await createContent(f.db, f.data.owner, sample('unreviewed-language', 'en', {
      'zh-CN': { title: '尚未审核', description: '草稿' }, de: { title: 'PRIVATE GERMAN DRAFT', description: 'Unreviewed' },
    }));
    assert.ok(draft.id);
    const fallback = await inspect(roomPath.replace('/en/', '/de/')); noindex(fallback);
    assert.equal(fallback.status, 200); assert.equal(fallback.lang, 'en');
    assert.match(fallback.html, /original language/); assert.match(fallback.html, /interface is currently shown in English/);
    assert.ok(!fallback.html.includes('PRIVATE GERMAN DRAFT'));
    const translated = await createContent(f.db, f.data.owner, sample('german-content', 'en', {
      'zh-CN': { title: '德文样本', description: '测试' }, de: { title: 'Deutsches Zimmer', description: 'Geprüfter Text' },
    })); await publish(translated);
    const german = await inspect('/de/worlds/lathe-worlds/stays/german-content'); noindex(german);
    assert.match(german.html, /lang="de"/); assert.match(german.html, /Deutsches Zimmer/); assert.ok(!german.html.includes('original language'));
    assert.ok(!(await sitemap()).some(url => /^\/de(?:\/|$)/.test(new URL(url).pathname) || url.includes('unreviewed-language')));
    const english = await inspect('/en/worlds/lathe-worlds/stays/german-content'); assert.equal(english.alternates.length, 3);
    await f.db.query("UPDATE locales SET enabled=false WHERE code='de'");
    assert.equal((await inspect('/de')).status, 404);
  });

  await t.test('missing translations, publish, restore, language enablement and restrictions change SEO without rebuilding', async () => {
    // This fixture alone relaxes the bilingual rule to exercise missing published translations.
    await f.db.query('UPDATE locales SET required_for_publish=false');
    const content = await createContent(f.db, f.data.owner, sample('live-languages', 'en', {})); await publish(content);
    const path = '/en/worlds/lathe-worlds/stays/live-languages';
    const original = (await getPublished(f.db, 'en', { id: content.id }))!;
    const en = await inspect(path); assert.deepEqual(en.alternates.map(a => a.tag), ['en', 'x-default']);
    const zh = await inspect(path.replace('/en/', '/zh/')); noindex(zh); assert.match(zh.html, /此内容暂以原文展示/); assert.match(zh.html, /<div lang="en"/);
    noindex(await inspect('/zh')); assert.ok(!(await sitemap()).includes(origin + '/zh'));
    const current = await editContent(f.db, f.data.owner, content.id, editContentSchema.parse({ baseRevisionId: content.revisionId,
      sourceLocale: 'en', text: original.text, attributes: original.attributes, translations: { 'zh-CN': { title: '发布后的译文', description: '实时公开' } } }));
    assert.equal((await inspect(path)).alternates.length, 2); noindex(await inspect(path.replace('/en/', '/zh/')));
    await publish({ id: content.id, revisionId: current.revisionId });
    assert.equal((await inspect(path)).alternates.length, 3); assert.ok((await sitemap()).includes(origin + '/zh'));
    assert.deepEqual((await inspect(path.replace('/en/', '/zh/'))).canonicals, [origin + path.replace('/en/', '/zh/')]);
    await restorePublication(f.db, f.data.owner, content.id, original.publicationId);
    assert.equal((await inspect(path)).alternates.length, 2); assert.ok(!(await sitemap()).includes(origin + '/zh'));
    await unpublishContent(f.db, f.data.owner, content.id, false, 'SEO test');
    assert.equal((await inspect(path)).status, 404); assert.ok(!(await sitemap()).some(url => url.includes('live-languages')));
    assert.ok((await sitemap()).includes(origin + '/zh'));
    const chineseOnly = await createContent(f.db, f.data.owner, sample('chinese-only', 'zh-CN', {})); await publish(chineseOnly);
    const zhOnly = await inspect('/zh/worlds/lathe-worlds/stays/chinese-only');
    assert.deepEqual(zhOnly.alternates.map(a => a.tag), ['zh-Hans']); noindex(await inspect('/en/worlds/lathe-worlds/stays/chinese-only'));
    await unpublishContent(f.db, f.data.owner, chineseOnly.id, false, 'Finished fixture');
    await f.db.query("UPDATE locales SET enabled=false WHERE code='zh-CN'");
    assert.deepEqual((await inspect(roomPath)).alternates.map(a => a.tag), ['en', 'x-default']);
    assert.ok(!(await sitemap()).some(url => url.startsWith(origin + '/zh'))); assert.equal((await inspect('/zh')).status, 404);
    await f.db.query("UPDATE locales SET enabled=true WHERE code='zh-CN'");
    assert.equal((await inspect(roomPath)).alternates.length, 3);
    const worldText = (await f.db.query('SELECT translations FROM worlds WHERE id=$1', [f.data.latheId])).rows[0].translations;
    await f.db.query("UPDATE worlds SET translations=translations-'zh-CN' WHERE id=$1", [f.data.latheId]);
    noindex(await inspect('/zh')); noindex(await inspect(roomPath.replace('/en/', '/zh/')));
    assert.deepEqual((await inspect(roomPath)).alternates.map(a => a.tag), ['en', 'x-default']);
    assert.ok(!(await sitemap()).includes(origin + roomPath.replace('/en/', '/zh/')));
    await f.db.query('UPDATE worlds SET translations=$2 WHERE id=$1', [f.data.latheId, worldText]);
    for (const change of ['visible=false', 'site_blocked=true']) {
      await f.db.query(`UPDATE worlds SET ${change} WHERE id=$1`, [f.data.latheId]);
      assert.equal((await inspect(roomPath)).status, 404); assert.ok(!(await sitemap()).some(url => url.includes('lathe-worlds') || url === origin + '/en' || url === origin + '/zh'));
      await f.db.query('UPDATE worlds SET visible=true,site_blocked=false WHERE id=$1', [f.data.latheId]);
    }
    await f.db.query('UPDATE contents SET site_blocked=true WHERE id=$1', [f.data.ids['observation-room']]);
    assert.equal((await inspect(roomPath)).status, 404); assert.ok(!(await sitemap()).some(url => url.includes('observation-room')));
    await f.db.query('UPDATE contents SET site_blocked=false WHERE id=$1', [f.data.ids['observation-room']]);
    assert.equal(await artifactHash(), initialHash); assert.equal(web.child.exitCode, null); assert.equal(api.child.exitCode, null);
  });

  await t.test('discovery covers more than 50 entries and every URL matches an indexable canonical', async () => {
    for (let i = 0; i < 55; i++) await publish(await createContent(f.db, f.data.owner, sample(`sitemap-room-${i}`)));
    const listed = await (await fetch(apiUrl + '/api/contents')).json(); assert.equal(listed.contents.length, 50);
    const urls = await sitemap(); assert.equal(urls.filter(url => url.includes('/sitemap-room-')).length, 110);
    for (const url of urls) {
      assert.ok(!url.includes('/admin') && !url.includes('/reviews/') && !url.includes('/zh-CN') && !url.includes('unpublished'));
      const parsed = new URL(url); const data = await inspect(parsed.pathname + parsed.search);
      assert.equal(data.status, 200); assert.deepEqual(data.canonicals, [url]);
    }
    assert.equal(await artifactHash(), initialHash);
    t.diagnostic(`55 additional publications produce 110 detail URLs; every sitemap URL matches its SSR canonical. Web dist SHA-256 unchanged: ${initialHash}`);
  });

  await t.test('API outage remains 503 for pages, admin and sitemap with no public metadata', async () => {
    await stop(api.child);
    for (const path of ['/zh', '/zh/admin', '/zh/worlds/lathe-worlds/stays/observation-room']) {
      const data = await inspect(path); assert.equal(data.status, 503); assert.match(data.html, /内容暂时无法读取/); noindex(data);
    }
    assert.equal((await fetch(webUrl + '/sitemap.xml')).status, 503);
  });
});
