import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { detailFixture } from './detail-fixture.ts';
import { unusedPort, waitFor, stop } from './runtime.ts';
import { seedServiceDetails } from '../scripts/seed-service-details.ts';
import { seedExperienceReviews } from '../scripts/seed-experience-reviews.ts';
import { seedExperienceDetails } from '../scripts/seed-experience-details.ts';
import { seedStayDetails } from '../scripts/seed-stay-details.ts';

test('phase 4 detail browser acceptance', {timeout:180000}, async t => {
  const f=await detailFixture();t.after(f.cleanup);await seedStayDetails(f.db,f.data.admin,true);await seedExperienceDetails(f.db,f.data.admin,true);await seedExperienceReviews(f.db,f.data.admin,true);await seedServiceDetails(f.db,f.data.admin,true);
  const apiPort=await unusedPort(),webPort=await unusedPort();
  const apiUrl=`http://127.0.0.1:${apiPort}`,webUrl=`http://127.0.0.1:${webPort}`;
  const env={...process.env,PGOPTIONS:f.options,NODE_ENV:'production',SITE_INDEXABLE:'true',SITE_URL:'https://plotstay-phase4.invalid',API_PORT:String(apiPort),API_HOST:'127.0.0.1',HOST:'127.0.0.1',PORT:String(webPort),WEB_ORIGIN:webUrl,API_INTERNAL_URL:apiUrl};
  const launch=(entry:string)=>{const child=spawn(process.execPath,[entry],{env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout!.on('data',d=>logs+=d);child.stderr!.on('data',d=>logs+=d);t.after(()=>stop(child));return {child,logs:()=>logs};};
  const api=launch('apps/api/dist/server.mjs');await waitFor(apiUrl+'/api/health',api.child,api.logs);
  const web=launch('apps/web/server.mjs');await waitFor(webUrl+'/en',web.child,web.logs);
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const context=await browser.newContext();t.after(()=>context.close());const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const route=(kind:string,locale='en')=>`/${locale}/worlds/lathe-worlds/${kind==='stay'?'stays':kind==='experience'?'experiences':'services'}/detail-${kind}`;
  const dir='test-results/phase4';await mkdir(dir,{recursive:true});
  await t.test('expanded content has its collapse control at the bottom, including without JavaScript', async () => {
    for (const javaScriptEnabled of [true, false]) {
      const c = await browser.newContext({ javaScriptEnabled });
      try {
        const p = await c.newPage();
        for (const locale of ['en', 'zh']) for (const width of [1440, 390]) {
          await p.setViewportSize({ width, height: 900 });
          for (const path of ['stays/dockside-window', 'experiences/forge-walk', 'services/augmetic-tune-up']) {
            await p.goto(webUrl + `/${locale}/worlds/lathe-worlds/${path}`);
            for (const disclosure of await p.locator('.stay-expand').all()) {
              const summary = disclosure.locator(':scope > summary');
              const content = disclosure.locator(':scope > .stay-expanded');
              await summary.focus(); await p.keyboard.press('Enter');
              await expect(content).toBeVisible();
              const bounds = await disclosure.evaluate(el => ({
                control: el.querySelector('summary')!.getBoundingClientRect().top,
                content: el.querySelector('.stay-expanded')!.getBoundingClientRect().bottom,
              }));
              assert.ok(bounds.control >= bounds.content, `${path}: collapse must follow content`);
              await expect(summary).toContainText(locale === 'en' ? 'Show less' : '收起');
              const preview = disclosure.locator('..').locator(':scope > .stay-review-preview');
              if (await preview.count()) await expect(preview).toBeHidden();
              try { await summary.click({ timeout: 5000 }); }
              catch (error) { throw new Error(`${path}, ${locale}, width ${width}, JS ${javaScriptEnabled}, disclosure ${await disclosure.getAttribute('id')}: ${error}`); }
              await expect(content).toBeHidden();
              if (await preview.count()) await expect(preview).toBeVisible();
            }
            assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          }
        }
      } finally { await c.close(); }
    }
  });
  await t.test('each type renders published special modules, people and fictional notes',async()=>{
    for(const kind of ['stay','experience','service']){
      await page.goto(webUrl+route(kind));
      await expect(page.locator('h1')).toHaveText(`Detail ${kind}`);
      await expect(page.locator('#host')).toContainText(`Test ${kind} host`);
      await expect(page.locator('#notes')).toContainText('Visitor 17');
      await expect(page.locator('#notes-heading')).toContainText('Fictional visitor notes');
      const special=kind==='stay'?'highlights':kind==='experience'?'included':'service-items';
      await expect(page.locator(`#${special}`)).toBeVisible();
      for(const other of ['highlights','included','service-items'].filter(x=>x!==special)) await expect(page.locator(`#${other}`)).toHaveCount(0);
      assert.equal(await page.locator('#related .content-card').count(),6);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',`https://plotstay-phase4.invalid${route(kind)}`);
    }
  });
  await t.test('experience sample renders eight complete modules, illustrated steps and useful demo interactions',async()=>{
    for(const locale of ['en','zh'])for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:1000});
      await page.goto(webUrl+`/${locale}/worlds/lathe-worlds/experiences/forge-walk?from=results&view=results&type=experiences&start=2026-10-14&guests=2`);
      await expect(page.locator('[data-experience-module]')).toHaveCount(8);
      for(const module of await page.locator('[data-experience-module]').all())await expect(module).toBeVisible();
      await expect(page.locator('.experience-steps li')).toHaveCount(5);
      await expect(page.locator('.experience-steps img')).toHaveCount(5);
      await expect(page.locator('.experience-session-list li')).toHaveCount(2);
      await expect(page.locator('.experience-policies > section')).toHaveCount(6);
      await expect(page.locator('#notes')).toHaveCount(1);
      await expect(page.locator('#notes [data-note-id]')).toHaveCount(6);
      await expect(page.locator('#notes .stay-rating-large strong')).toHaveText('4.83');
      assert.ok(await page.locator('#related').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('#notes')!)&Node.DOCUMENT_POSITION_FOLLOWING)));
      await expect(page.locator('#notes .stay-rating-dimension')).toHaveCount(3);
      await page.locator('#notes .stay-review summary').first().click();await expect(page.locator('#notes .stay-review details').first()).toHaveAttribute('open','');
      await expect(page.locator('.trip-summary')).toContainText('2026-10-14');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.locator('.experience-booking summary').click();
      await expect(page.locator('.experience-booking details')).toHaveAttribute('open','');
      await page.keyboard.press('Escape');await expect(page.locator('.experience-booking details')).not.toHaveAttribute('open','');
      await page.locator('#host summary').click();await expect(page.locator('#host details')).toHaveAttribute('open','');
      await page.locator('.experience-gallery [data-gallery-open="2"]').click();await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('[data-gallery-position]')).toHaveText('3 / 4');await page.keyboard.press('Escape');
      if(width===1440||width===390)await page.screenshot({path:`${dir}/experience-repair-${locale}-${width}.png`,fullPage:true});
    }
    await page.goto(webUrl+'/en/worlds/lathe-worlds/experiences/signal-listening');
    await expect(page.locator('[data-experience-module]')).toHaveCount(8);
    await expect(page.locator('.experience-policies > section')).toHaveCount(6);
    const nojs=await browser.newContext({javaScriptEnabled:false});
    try{const p=await nojs.newPage();await p.goto(webUrl+'/en/worlds/lathe-worlds/experiences/forge-walk');
      await p.locator('.experience-booking summary').click();await expect(p.locator('.experience-booking .stay-expanded')).toBeVisible();
      await p.locator('#location summary').click();await expect(p.locator('#location .stay-expanded')).toContainText('covered walkway');
    }finally{await nojs.close();}
  });
  await t.test('service has eight complete modules, sample dates, rated reviews and reference layout',async()=>{
    for(const locale of ['en','zh'])for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:1000});
      await page.goto(webUrl+`/${locale}/worlds/lathe-worlds/services/augmetic-tune-up?from=results&view=results&type=services&start=2026-10-15&quantity=2&time=morning`);
      await expect(page.locator('[data-service-module]')).toHaveCount(8);
      for(const module of await page.locator('[data-service-module]').all())await expect(module).toBeVisible();
      await expect(page.locator('#notes')).toHaveCount(1);await expect(page.locator('#notes [data-note-id]')).toHaveCount(6);
      await expect(page.locator('#notes .stay-rating-large strong')).toHaveText('4.83');
      await expect(page.locator('.service-price strong')).toHaveText('30');await expect(page.locator('.service-offering-price')).toContainText('30');
      await expect(page.locator('.service-qualifications li')).toHaveCount(3);await expect(page.locator('.service-policies section')).toHaveCount(3);
      await expect(page.locator('.trip-summary')).toContainText('2026-10-15');
      for(const selector of ['#service-dates','#service-contact','#location details','#notes .stay-review details']){
        const item=page.locator(selector).first();await item.locator('summary').click();await expect(item).toHaveAttribute('open','');
        if(selector==='#service-dates')await expect(page.locator('.service-dates li')).toHaveCount(2);
        await page.keyboard.press('Escape');await expect(item).not.toHaveAttribute('open','');
      }
      await page.locator('#service-gallery [data-gallery-open="2"]').click();await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('[data-gallery-position]')).toHaveText('3 / 3');await page.keyboard.press('ArrowRight');await expect(page.locator('[data-gallery-position]')).toHaveText('1 / 3');await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const order=await page.locator('.service-main [data-service-module]').evaluateAll(es=>es.map(e=>e.getAttribute('data-service-module')));assert.deepEqual(order,['03','04','05','06','07','08']);
      if(width===1440||width===390)await page.screenshot({path:`${dir}/service-repair-${locale}-${width}.png`,fullPage:true});
    }
    await page.goto(webUrl+'/en/worlds/lathe-worlds/services/luggage-blessing');await expect(page.locator('[data-service-module]')).toHaveCount(8);
    await expect(page.locator('#notes')).toContainText('No published visitor notes yet.');
    const nojs=await browser.newContext({javaScriptEnabled:false});try{const p=await nojs.newPage();await p.goto(webUrl+'/en/worlds/lathe-worlds/services/augmetic-tune-up');
      await p.locator('#service-dates summary').click();await expect(p.locator('.service-dates li')).toHaveCount(2);await expect(p.locator('.service-dates')).toBeVisible();
      await p.locator('#service-contact summary').click();await expect(p.locator('#service-contact .stay-expanded')).toContainText('does not send messages');
    }finally{await nojs.close();}
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n,0);
  });
  await t.test('gallery opens any thumbnail, wraps with keys, traps focus and restores trigger',async()=>{
    await page.goto(webUrl+route('stay'));
    const second=page.locator('[data-gallery-item]').nth(1);await second.click();
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    await expect(page.locator('[data-gallery-position]')).toHaveText('2 / 3');
    await expect(page.locator('[data-gallery-caption]')).toHaveText('Maintenance illustration');
    await page.keyboard.press('ArrowRight');await expect(page.locator('[data-gallery-error]')).toBeVisible();
    await expect(page.locator('[data-gallery-position]')).toHaveText('3 / 3');
    await page.keyboard.press('ArrowRight');await expect(page.locator('[data-gallery-position]')).toHaveText('1 / 3');
    await expect(page.locator('[data-gallery-full]')).toBeVisible();
    await page.locator('[data-gallery-close]').focus();await page.keyboard.press('Shift+Tab');
    assert.ok(await page.evaluate(()=>!!document.activeElement?.closest('dialog')));
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(second).toBeFocused();
    await page.locator('.gallery-main').click();await page.locator('[data-gallery-next]').click();
    await expect(page.locator('[data-gallery-position]')).toHaveText('2 / 3');
    await page.locator('[data-gallery-close]').click();await expect(page.locator('.gallery-main')).toBeFocused();
    await page.goto(webUrl+'/en/worlds/lathe-worlds/services/luggage-blessing');
    await page.locator('.gallery-main').click();await expect(page.locator('[data-gallery-position]')).toHaveText('1 / 1');
    await expect(page.locator('[data-gallery-next]')).toHaveCount(0);await page.keyboard.press('Escape');
    await page.goto(webUrl+'/en/worlds/lathe-worlds/stays/observation-room');
    await expect(page.locator('.gallery-empty')).toBeVisible();await expect(page.locator('dialog')).toHaveCount(0);
  });
  await t.test('notes pagination, related navigation and language keep browse and trip context',async()=>{
    const query='?from=results&view=results&type=stays&q=Detail&start=2026-10-09&end=2026-10-12&guests=2&rooms=1';
    await page.goto(webUrl+route('stay')+query);
    const ids=await page.locator('[data-note-id]').evaluateAll(es=>es.map(e=>e.getAttribute('data-note-id')));
    await page.locator('[data-notes-next]').click();
    await expect(page.locator('[data-note-id]')).toHaveCount(2);
    const nextIds=await page.locator('[data-note-id]').evaluateAll(es=>es.map(e=>e.getAttribute('data-note-id')));
    assert.equal(new Set([...ids,...nextIds]).size,8);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content','noindex, follow');
    await expect(page.locator('link[rel=canonical]')).toHaveCount(0);
    await page.locator('.header-actions summary').click();await page.getByRole('link',{name:'简体中文',exact:true}).click();
    assert.equal(new URL(page.url()).searchParams.get('notesPage'),'2');
    await expect(page.locator('.trip-summary')).toContainText('2026-10-09');
    await page.locator('#related h3 a').first().click();
    assert.equal(new URL(page.url()).searchParams.get('notesPage'),null);
    const back=await page.locator('[data-back]').getAttribute('href');
    assert.ok(back?.startsWith('/zh?'));for(const pair of ['type=stays','q=Detail','rooms=1','guests=2','start=2026-10-09'])assert.ok(back?.includes(pair));
    await page.locator('[data-back]').click();
    // The retained English keyword has no Chinese match; a valid empty result is expected.
    await expect(page.locator('[name=q]')).toHaveValue('Detail');
    await expect(page.locator('.results-grid h3 a')).toHaveCount(0);
    for(const invalid of ['notesPage=0','notesPage=3','notesPage=1&notesPage=2'])assert.equal((await page.goto(webUrl+route('stay')+'?'+invalid))?.status(),404);
  });
  await t.test('existing demo, long content and every language/font fit desktop and mobile',async()=>{
    const checks=[];
    for(const locale of ['en','zh']) for(const font of (locale==='zh'?['terminal','arcade']:['arcade'])) {
      await context.addCookies([{name:'plotstay-zh-font',value:font,url:webUrl}]);
      for(const width of [1440,768,390,320])for(const kind of ['stay','experience','service']){
        await page.setViewportSize({width,height:1000});await page.goto(webUrl+route(kind,locale));await page.evaluate(()=>document.fonts.ready);
        const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,font:document.documentElement.dataset.fontStyle,
          columns:getComputedStyle(document.querySelector('.detail-columns')!).display}));
        assert.ok(metrics.scroll<=width,JSON.stringify({kind,locale,width,metrics}));assert.equal(metrics.font,font);
        checks.push({kind,locale,...metrics});
        if(width===1440||width===390)await page.screenshot({path:`${dir}/${kind}-${locale}-${font}-${width}.png`,fullPage:true});
      }
    }
    // Existing demo records exercise empty fields and missing or single images.
    for(const path of ['/zh/worlds/lathe-worlds/stays/observation-room','/en/worlds/lathe-worlds/experiences/forge-walk','/zh/worlds/lathe-worlds/services/augmetic-tune-up','/en/worlds/test-harbour/stays/harbour-room']){
      await page.goto(webUrl+path);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await expect(page.locator('#highlights,#included,#service-items')).toHaveCount(path.includes('/stays/') || path.includes('/services/') ? 1 : 0);
    }
    await expect(page.locator('#related')).toHaveCount(0);
    await writeFile(`${dir}/responsive.json`,JSON.stringify(checks,null,2));
  });
  await t.test('no-script gallery links, notes and related content remain reachable',async()=>{
    const nojs=await browser.newContext({javaScriptEnabled:false});const p=await nojs.newPage();
    await p.goto(webUrl+route('stay'));
    await expect(p.locator('#facilities')).toContainText('A reading lamp');
    assert.equal(await p.locator('[data-gallery-item]').count(),3);
    await p.locator('[data-notes-next]').click();await expect(p.locator('[data-note-id]')).toHaveCount(2);
    await p.locator('#related h3 a').first().click();await expect(p.locator('h1')).toBeVisible();
    await nojs.close();
  });
  await t.test('all ten stay groups remain visible, including legacy empty data',async()=>{
    for(const slug of ['dockside-window','detail-stay']){
      await page.goto(webUrl+`/en/worlds/lathe-worlds/stays/${slug}`);
      for(let i=1;i<=10;i++)await expect(page.locator(`[data-stay-module="${String(i).padStart(2,'0')}"]`)).toBeVisible();
      await expect(page.locator('#cancellation,#house-rules,#safety')).toHaveCount(3);
    }
  });
  await t.test('complete stay content, expansions and nearby routes work in both languages and without scripts',async()=>{
    await mkdir('test-results/stay-repair',{recursive:true});
    for(const lang of ['en','zh']){
      for(const width of [1440,768,390,320]){
        await page.setViewportSize({width,height:1000});
        await page.goto(webUrl+`/${lang}/worlds/lathe-worlds/stays/dockside-window?from=results&view=results&type=stays&rooms=1&guests=2&start=2026-10-09&end=2026-10-11`);
        await page.evaluate(()=>document.fonts.ready);
        await expect(page.locator('#stay-reputation')).toContainText('4.83');
        await expect(page.locator('#sleeping')).toBeVisible();
        await expect(page.locator('.stay-rating-dimension')).toHaveCount(6);
        await expect(page.locator('.stay-rating-distribution meter')).toHaveCount(5);
        await expect(page.locator('.stay-mentions li')).toHaveCount(10);
        await expect(page.locator('.stay-review-grid [data-note-id]')).toHaveCount(6);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(width===1440||width===390)await page.screenshot({path:`test-results/stay-repair/fixture-${lang}-${width}.png`,fullPage:true});
        for(const selector of ['#stay-description-more','#stay-amenities-all','#stay-contact-host','#cancellation details','#house-rules details','#safety details','.stay-nearby details']){
          for(const disclosure of await page.locator(selector).all()){
            await disclosure.locator('summary').focus();await page.keyboard.press('Enter');await expect(disclosure).toHaveAttribute('open','');
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
            await page.keyboard.press('Escape');await expect(disclosure).not.toHaveAttribute('open','');
          }
        }
        await page.locator('#stay-amenities-all summary').click();
        await expect(page.locator('[data-amenity]')).toHaveCount(24);
        await expect(page.locator('[data-amenity][data-status=unreported]')).toBeVisible();
        await expect(page.locator('[data-amenity][data-status=unavailable]')).toBeVisible();
        await page.locator('#stay-amenities-all summary').click();
        await page.locator('.stay-review details summary').first().click();await expect(page.locator('.stay-review .stay-expanded').first()).toBeVisible();
        await page.locator('.stay-nearby summary').first().click();await page.locator('.stay-nearby a').click();
        assert.equal(new URL(page.url()).searchParams.get('type'),'experiences');assert.equal(new URL(page.url()).searchParams.get('start'),'2026-10-09');
        assert.equal(new URL(page.url()).searchParams.get('rooms'),null);await expect(page.locator('.results-summary')).toBeVisible();
      }
    }
    const nojs=await browser.newContext({javaScriptEnabled:false});const p=await nojs.newPage();
    await p.goto(webUrl+'/en/worlds/lathe-worlds/stays/dockside-window');
    await p.locator('#stay-description-more summary').click();await expect(p.locator('#about')).toContainText('Registration details');
    await p.locator('#stay-amenities-all summary').click();await expect(p.locator('[data-amenity]')).toHaveCount(24);
    await p.locator('#house-rules summary').click();await expect(p.locator('#house-rules .stay-expanded')).toBeVisible();
    await nojs.close();
  });
  await t.test('admin editing preserves nested stay data and visitor profiles in new drafts',async()=>{
    await page.setViewportSize({width:1440,height:1000});await page.goto(webUrl+'/en/admin');
    await page.locator('#login [name=email]').fill(f.credentials.email);await page.locator('#login [name=password]').fill(f.credentials.password);await page.locator('#login button').click();
    await expect(page.locator('#workspace')).toBeVisible();
    const {rows:[stay]}=await f.db.query("SELECT id FROM contents WHERE slug='dockside-window'");
    for(const slug of ['augmetic-tune-up','forge-walk','dockside-window',`stay-demo-${stay.id}-1`]){
      const {rows:[before]}=await f.db.query(`SELECT c.id,c.head_revision_id,c.published_publication_id,r.attributes,
        (SELECT jsonb_object_agg(l.locale,t.body) FROM revision_locales l JOIN translations t ON t.id=l.translation_id WHERE l.revision_id=r.id) AS texts
        FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.slug=$1`,[slug]);
      await page.locator('#filter-kind').selectOption(slug==='augmetic-tune-up'?'service':slug==='forge-walk'?'experience':slug==='dockside-window'?'stay':'review');
      await page.locator('#filter-query').fill(slug);await page.locator('#search-list').click();await expect(page.locator('#search-list')).toBeEnabled();await expect(page.locator('#content-list tr')).toHaveCount(1);
      await page.locator('#content-list button').click();
      await expect(page.locator('[name=slug]')).toHaveValue(slug);
      if(slug==='augmetic-tune-up'){assert.equal(JSON.parse(await page.locator('[name="en:service"]').inputValue()).qualifications.length,3);assert.equal(JSON.parse(await page.locator('[name=serviceAttributes]').inputValue()).sessions.length,2);}
      else if(slug==='forge-walk')assert.equal(JSON.parse(await page.locator('[name="en:experience"]').inputValue()).steps.length,5);
      else if(slug==='dockside-window')assert.equal(JSON.parse(await page.locator('[name="en:stay"]').inputValue()).amenities.length,24);
      else assert.equal(JSON.parse(await page.locator('[name="en:review"]').inputValue()).name,'Visitor 17');
      const saved=page.waitForResponse(r=>r.request().method()==='POST' && r.url().endsWith(`/api/admin/contents/${before.id}/revisions`),{timeout:7000}).catch(async error=>{throw new Error(`${slug}: ${await page.locator('#message').innerText()}; invalid fields: ${JSON.stringify(await page.locator('#editor :invalid').evaluateAll(es=>es.map(e=>({name:e.getAttribute('name'),message:(e as HTMLInputElement).validationMessage}))))}; ${error.message}`);});
      await page.locator('#editor button[type=submit]').click();assert.equal((await saved).status(),200);await expect(page.locator('#editor button[type=submit]')).toBeEnabled();await expect(page.locator('#message')).toContainText('Draft saved');
      const {rows:[after]}=await f.db.query(`SELECT c.head_revision_id,c.published_publication_id,r.attributes,
        (SELECT jsonb_object_agg(l.locale,t.body) FROM revision_locales l JOIN translations t ON t.id=l.translation_id WHERE l.revision_id=r.id) AS texts
        FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.id=$1`,[before.id]);
      assert.notEqual(after.head_revision_id,before.head_revision_id);assert.equal(after.published_publication_id,before.published_publication_id);
      const withoutEditorIds=(texts:any)=>Object.fromEntries(Object.entries(texts).map(([locale,body])=>{const copy=structuredClone(body as any);delete copy.editorListIds;return [locale,copy];}));
      assert.deepEqual(after.attributes,before.attributes);assert.deepEqual(withoutEditorIds(after.texts),withoutEditorIds(before.texts));
    }
  });
  assert.deepEqual(errors,[]);
});
