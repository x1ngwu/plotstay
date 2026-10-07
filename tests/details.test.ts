import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createContentSchema, editContentSchema, textSchema } from '@plotstay/contracts';
import { publishedDetail, createContent, editContent, restorePublication, unpublishContent, importContent, digest, runTranslationOnce } from '@plotstay/domain';
import { createApp } from '../apps/api/src/app.ts';
import { detailFixture } from './detail-fixture.ts';
import { historyDigest } from './helpers.ts';

test('phase 4 published detail contracts and visibility', { timeout: 120000 }, async t => {
  const f = await detailFixture(); t.after(f.cleanup);
  const app = await createApp(f.db); t.after(() => app.close());
  const get = (kind = 'stay', locale = 'en', page = 1) => publishedDetail(f.db, locale, { world: 'lathe-worlds', kind, slug: `detail-${kind}` }, page);
  await t.test('legacy publications read with empty new fields without changing history', async () => {
    const before = await historyDigest(f.db);
    const old = await publishedDetail(f.db, 'zh-CN', { world: 'lathe-worlds', kind: 'stay', slug: 'observation-room' });
    assert.deepEqual(old.content.text.highlights, []); assert.deepEqual(old.content.text.included, []); assert.deepEqual(old.content.text.serviceItems, []);
    assert.equal(old.reviews.contents[0]!.personaName, '旅客十七');
    assert.deepEqual(await historyDigest(f.db), before);
  });
  await t.test('three types expose translated fields, same-place priority and paged notes', async () => {
    for (const kind of ['stay', 'experience', 'service']) {
      const d = await get(kind, 'zh-CN');
      assert.equal(d.content.text.hostBio, '来自已发布版本的人物介绍。');
      assert.ok(d.related.every(r => r.worldId === d.content.worldId && r.id !== d.content.id && r.kind !== 'review'));
      assert.equal(d.related[0]!.placeId, d.content.placeId);
      const places = d.related.map(r => r.placeId === d.content.placeId);
      assert.ok(places.every((same, index) => !same || places.slice(0, index).every(Boolean)));
    }
    assert.deepEqual((await get('experience','zh-CN')).content.text.included,['工坊地图']);
    assert.deepEqual((await get('service')).content.text.serviceItems,['An initial inspection','A written maintenance report']);
    const a = await get(), b = await get('stay','en',2);
    assert.equal(a.reviews.total,8); assert.equal(a.reviews.contents.length,6); assert.equal(b.reviews.contents.length,2);
    assert.equal(new Set([...a.reviews.contents,...b.reviews.contents].map(n=>n.id)).size,8);
    assert.deepEqual((await get('stay','zh-CN')).reviews.contents.map(n=>n.id),a.reviews.contents.map(n=>n.id));
    await assert.rejects(get('stay','en',3),{status:404});
    for(const page of ['0','01','1.5','-1','x','1000001']) assert.equal((await app.inject(`/api/worlds/lathe-worlds/stay/detail-stay/detail?notesPage=${page}`)).statusCode,400);
    assert.equal((await app.inject('/api/worlds/test-harbour/stay/detail-stay/detail')).statusCode,404);
  });
  await t.test('draft additions stay private; publication, translation and restore are complete snapshots', async () => {
    const e=f.entries[0]!;
    const next=await editContent(f.db,f.data.owner,e.id,editContentSchema.parse({baseRevisionId:e.revisionId,
      sourceLocale:e.input.sourceLocale,attributes:e.input.attributes,text:{...e.input.text,highlights:['New published highlight']},
      translations:{'zh-CN':{...e.input.translations['zh-CN'],highlights:['新发布的亮点']}}}));
    assert.deepEqual((await get()).content.text.highlights,['An observation window']);
    await f.publish({id:e.id,revisionId:next.revisionId});
    assert.deepEqual((await get('stay','zh-CN')).content.text.highlights,['新发布的亮点']);
    await restorePublication(f.db,f.data.owner,e.id,e.publicationId);
    assert.deepEqual((await get()).content.text.highlights,['An observation window']);
  });
  await t.test('unpublished and blocked relations disappear; invisible parents hide notes and detail', async () => {
    const service=f.entries[2]!;
    assert.ok((await get()).related.some(r=>r.id===service.id));
    await unpublishContent(f.db,f.data.owner,service.id,false,'Test visibility');
    assert.ok(!(await get()).related.some(r=>r.id===service.id));
    await assert.rejects(get('service'),{status:404});
    assert.equal((await app.inject(`/api/contents?world=lathe-worlds&parentId=${service.id}`)).json().contents.length,0);
    await restorePublication(f.db,f.data.owner,service.id,service.publicationId);
    await f.db.query('UPDATE contents SET site_blocked=true WHERE id=$1',[service.id]);
    assert.ok(!(await get()).related.some(r=>r.id===service.id));
    await f.db.query('UPDATE contents SET site_blocked=false WHERE id=$1',[service.id]);
    await f.db.query('UPDATE worlds SET visible=false WHERE id=$1',[f.data.latheId]);
    await assert.rejects(get(),{status:404});
    await f.db.query('UPDATE worlds SET visible=true WHERE id=$1',[f.data.latheId]);
  });
  await t.test('old import hashes remain unchanged while new detail text causes conflict', async () => {
    const input=createContentSchema.parse({...f.entries[0]!.input,slug:'legacy-detail-import',text:{title:'Legacy',description:'Old body'},translations:{'zh-CN':{title:'旧导入',description:'旧正文'}}});
    const batch={worldId:f.data.latheId,source:'phase4-legacy',items:[{externalId:'one',content:input}]};
    await importContent(f.db,f.data.owner,batch,false);
    for(const keys of [['highlights','included','serviceItems'],['tags','highlights','included','serviceItems']]) {
      const old=structuredClone(input) as any;
      for(const body of [old.text,...Object.values(old.translations)] as any[]) for(const key of keys) delete body[key];
      await f.db.query('UPDATE import_items SET payload_hash=$1 WHERE source=$2',[digest(JSON.stringify(old)),batch.source]);
      assert.equal((await importContent(f.db,f.data.owner,batch,false)).results[0]!.status,'unchanged');
    }
    input.translations['zh-CN']!.highlights=['新亮点'];
    assert.equal((await importContent(f.db,f.data.owner,batch,false)).results[0]!.status,'conflict');
  });
  await t.test('translation adapters receive and validate new fixed fields', async () => {
    const input=createContentSchema.parse({...f.entries[2]!.input,slug:'translation-detail',translations:{}});
    const c=await createContent(f.db,f.data.owner,input), provider=randomUUID();
    await f.db.query('UPDATE translation_jobs SET provider=$1 WHERE revision_id=$2',[provider,c.revisionId]);
    await runTranslationOnce(f.db,{id:provider,translate:async request=>{
      assert.deepEqual(request.text.serviceItems,input.text.serviceItems);
      return textSchema.parse({...request.text,title:'翻译的服务',serviceItems:['译文项目']});
    }});
    const {rows:[translated]}=await f.db.query("SELECT body FROM translations WHERE revision_id=$1 AND locale='zh-CN'",[c.revisionId]);
    assert.deepEqual(translated.body.serviceItems,['译文项目']);
    assert.equal((await app.inject('/api/worlds/lathe-worlds/service/translation-detail/detail')).statusCode,404);
  });
  await t.test('third-language fallback is whole-publication and does not invent a translation', async () => {
    await f.db.query("INSERT INTO locales(code,name,enabled,required_for_publish,path_prefix,language_tag) VALUES ('de','Deutsch',true,false,'de','de')");
    const d=await get('experience','de');
    assert.equal(d.content.isFallback,true);assert.equal(d.content.languageTag,'en');
    assert.deepEqual(d.content.text.included,['A workshop map']);
    assert.ok(!d.content.availableLocales.includes('de'));
  });
});
