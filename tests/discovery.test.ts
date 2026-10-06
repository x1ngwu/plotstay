import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createContentSchema, editContentSchema, parseBrowse, browsePath, detailPath, detailReturn, fallbackLocales, textSchema, homeConfigSchema } from '@plotstay/contracts';
import { browseWorld, createContent, getPublished, submitRevision, reviewRevision, editContent, restorePublication, unpublishContent,
  digest, publicHome, saveHomeDraft, publishHome, importContent, runTranslationOnce } from '@plotstay/domain';
import { fixture, historyDigest } from './helpers.ts';
import { seedDiscovery } from '../scripts/seed-discovery.ts';
import { createApp } from '../apps/api/src/app.ts';

const state = (query = '') => parseBrowse(new URLSearchParams(query));
test('trip and browse state validate real dates, integers and constrained return paths', () => {
  for (const query of ['page=0','page=01','page=-1','page=1.5','page=no','type=unknown','start=2026-02-30','end=2026-10-01','start=2026-10-02&end=2026-10-01','guests=0','rooms=1.1','quantity=2','type=services&rooms=2','type=stays&type=services']) assert.throws(()=>state(query),query);
  const trip=state('view=results&type=services&start=2026-10-09&guests=2&quantity=3&time=morning&page=2');
  assert.match(browsePath(fallbackLocales[1]!,trip),/^\/zh\?view=results&type=services&page=2/);
  const content={worldSlug:'lathe-worlds',kind:'service',slug:'sample'} as any;
  const path=detailPath(fallbackLocales[0]!,content,trip);
  assert.deepEqual(detailReturn(new URL('https://test.invalid'+path).searchParams,'lathe-worlds'),trip);
  const hostile=detailReturn(new URLSearchParams('world=test-harbour&from=results&return=https://evil.invalid&page=9'),'lathe-worlds');
  assert.equal(browsePath(fallbackLocales[0]!,hostile),'/en');
});

test('phase 3 public data and service lifecycle', {timeout:120000}, async t=>{
 const f=await fixture(); t.after(f.cleanup); await seedDiscovery(f.db,f.data);
 const app=await createApp(f.db);t.after(()=>app.close());
 const input=(slug:string,kind='service')=>createContentSchema.parse({worldId:f.data.latheId,placeId:f.data.forgePlace,kind,slug,sourceLocale:'en',
   text:{title:slug,description:'A published phase story',tags:['phase-tag'],hostName:'Provider'},translations:{'zh-CN':{title:'双语'+slug,description:'中文故事',tags:['中文标签'],hostName:'提供者'}},
   attributes:{category:kind==='service'?'maintenance':undefined,price:{amount:10,unit:kind==='service'?'session':kind==='stay'?'night':'person'},...(kind==='experience'?{durationMinutes:30}:{})}});
 const publish=async(c:{id:string;revisionId:string})=>{await submitRevision(f.db,f.data.owner,c.id,c.revisionId);return reviewRevision(f.db,f.data.owner,c.id,c.revisionId,'publish','Phase 3 acceptance');};
 await t.test('demo seed is repeatable and preserves edits, config and historical records',async()=>{
   const before=await historyDigest(f.db);const configBefore=(await f.db.query('SELECT * FROM world_home_settings')).rows;
   await seedDiscovery(f.db,f.data); await seedDiscovery(f.db,f.data);
   assert.deepEqual(await historyDigest(f.db),before);assert.deepEqual((await f.db.query('SELECT * FROM world_home_settings')).rows,configBefore);
   const old=(await getPublished(f.db,'en',{id:f.data.ids['observation-room']}))!;assert.equal(old.text.tags.length,0);assert.equal(old.placeId,f.data.forgePlace);assert.equal(old.placeSlug,'dummy-forge-district');
 });
 await t.test('configuration drafts stay private, permissions and publish languages are enforced',async()=>{
   const current=await publicHome(f.db,f.data.latheId,'en');assert.ok(current);assert.equal(await publicHome(f.db,f.data.harbourId,'en'),null);
   let row=(await f.db.query('SELECT * FROM world_home_settings WHERE world_id=$1',[f.data.latheId])).rows[0];
   const body=(await f.db.query('SELECT body FROM world_home_revisions WHERE id=$1',[row.head_revision_id])).rows[0].body;
   await assert.rejects(()=>saveHomeDraft(f.db,f.data.editor,f.data.latheId,body,row.head_revision_id),(e:any)=>e.status===403);
   const changed=structuredClone(body);changed.translations.en.title='DRAFT HOME';changed.promotion.enabled=false;
   const draft=await saveHomeDraft(f.db,f.data.owner,f.data.latheId,changed,row.head_revision_id);
   assert.equal((await publicHome(f.db,f.data.latheId,'en'))!.text.title,current.text.title);
   await assert.rejects(()=>saveHomeDraft(f.db,f.data.owner,f.data.latheId,changed,row.head_revision_id),(e:any)=>e.status===409);
   await publishHome(f.db,f.data.owner,f.data.latheId,draft.revisionId);
   assert.equal((await publicHome(f.db,f.data.latheId,'en'))!.config.promotion,undefined);
   await assert.rejects(()=>f.db.query('UPDATE world_home_revisions SET body=body WHERE id=$1',[draft.revisionId]));
   const missing=structuredClone(body);delete missing.translations['zh-CN'];
   const next=await saveHomeDraft(f.db,f.data.owner,f.data.latheId,missing,draft.revisionId);
   await assert.rejects(()=>publishHome(f.db,f.data.owner,f.data.latheId,next.revisionId),(e:any)=>e.code==='TRANSLATIONS_REQUIRED');
   assert.equal((await publicHome(f.db,f.data.latheId,'zh-CN'))!.isFallback,false);
   const restored=await saveHomeDraft(f.db,f.data.owner,f.data.latheId,body,next.revisionId);await publishHome(f.db,f.data.owner,f.data.latheId,restored.revisionId);
   const invalid=structuredClone(body);invalid.benefits[0].target.page='https://evil.invalid';assert.equal(homeConfigSchema.safeParse(invalid).success,false);
 });
 let service:string, publication:string;
 await t.test('service create, review, edit, import, translation, restore and parent note use existing safeguards',async()=>{
   const draft=await createContent(f.db,f.data.editor,input('service-lifecycle'));service=draft.id;
   assert.equal(await getPublished(f.db,'en',{id:service}),null);
   const first=await publish(draft);publication=first.publicationId!;
   const publicValue=(await getPublished(f.db,'zh-CN',{id:service}))!;assert.equal(publicValue.attributes.price!.unit,'session');assert.equal(publicValue.categoryName,'检修与仪式');
   const original=input('service-lifecycle');
   const edit={baseRevisionId:draft.revisionId,sourceLocale:original.sourceLocale,text:{...original.text,title:'Unreviewed service title',tags:['unreviewed-tag']},translations:original.translations,attributes:original.attributes};
   const changed=await editContent(f.db,f.data.owner,service,editContentSchema.parse(edit));
   assert.equal((await getPublished(f.db,'en',{id:service}))!.text.title,'service-lifecycle');
   assert.equal((await browseWorld(f.db,'en',state('q=unreviewed-tag'))).listing.total,0);
   await assert.rejects(()=>editContent(f.db,f.data.owner,service,editContentSchema.parse(edit)),(e:any)=>e.status===409);
   await publish(changed); assert.equal((await getPublished(f.db,'en',{id:service}))!.text.title,'Unreviewed service title');
   await restorePublication(f.db,f.data.owner,service,publication);
   await assert.rejects(()=>createContent(f.db,f.data.secondOwner,input('wrong-owner')),(e:any)=>e.status===403);
   await assert.rejects(()=>createContent(f.db,f.data.owner,{...input('wrong-price'),attributes:{images:[],price:{amount:1,unit:'person'}}}),(e:any)=>e.code==='INVALID_PRICE');
   const note=await createContent(f.db,f.data.owner,createContentSchema.parse({worldId:f.data.latheId,kind:'review',slug:'service-note',parentContentId:service,sourceLocale:'en',text:{title:'A fictional service note',description:'Everything squeaks less now.'},translations:{'zh-CN':{title:'服务手记',description:'现在没那么响了。'}},attributes:{}}));
   await publish(note);assert.ok(await getPublished(f.db,'en',{id:note.id}));
   await unpublishContent(f.db,f.data.owner,service,false,'test');assert.equal(await getPublished(f.db,'en',{id:note.id}),null);
   await restorePublication(f.db,f.data.owner,service,publication);
 });
 await t.test('legacy imports without optional fields retain idempotency',async()=>{
   const content=input('legacy-import','stay');content.text.tags=[];content.translations['zh-CN']!.tags=[];
   const batch={worldId:f.data.latheId,source:'legacy-compat',items:[{externalId:'one',content}]};
   const first=await importContent(f.db,f.data.owner,batch,false);assert.equal(first.results[0]!.status,'created');
   const legacy=structuredClone(content) as any;delete legacy.text.tags;delete legacy.translations['zh-CN'].tags;
   await f.db.query('UPDATE import_items SET payload_hash=$1 WHERE world_id=$2 AND source=$3',[digest(JSON.stringify(legacy)),f.data.latheId,'legacy-compat']);
   assert.equal((await importContent(f.db,f.data.owner,batch,false)).results[0]!.status,'unchanged');
   content.text.tags=['new-tag'];assert.equal((await importContent(f.db,f.data.owner,batch,false)).results[0]!.status,'conflict');
 });
 await t.test('all content is reachable in stable, language independent pages; trip preferences never filter',async()=>{
   for(let i=0;i<55;i++)await publish(await createContent(f.db,f.data.owner,input('page-fixture-'+i,i%2?'stay':'experience')));
   const {rows:[same]}=await f.db.query('INSERT INTO places(world_id,slug,names) VALUES ($1,$2,$3) RETURNING id',[f.data.latheId,'same-name',{en:'Sample Forge District','zh-CN':'示例铸造区'}]);
   await publish(await createContent(f.db,f.data.owner,{...input('same-name-home','stay'),placeId:same.id}));
   await publish(await createContent(f.db,f.data.owner,{...input('no-place-home','stay'),placeId:null}));
   const all=await browseWorld(f.db,'en',state('view=results'));const ids:string[]=[];
   for(let page=1;page<=all.listing.pages;page++){
     const en=await browseWorld(f.db,'en',state('view=results&page='+page)),zh=await browseWorld(f.db,'zh-CN',state('view=results&page='+page));
     assert.deepEqual(en.listing.contents.map(c=>c.id),zh.listing.contents.map(c=>c.id));ids.push(...en.listing.contents.map(c=>c.id));
     assert.equal(en.listing.total,all.listing.total);
   }
   assert.equal(new Set(ids).size,all.listing.total);assert.ok(ids.length>55);assert.ok(ids.includes(service));
   const trip=await browseWorld(f.db,'en',state('view=results&start=2026-10-09&end=2026-10-12&guests=99&rooms=20'));
   assert.deepEqual(trip.listing,all.listing);
   assert.equal(all.places.filter(p=>p.name==='Sample Forge District').length,2);
   assert.equal((await browseWorld(f.db,'en',state('view=results&place=same-name'))).listing.total,1);
   assert.equal((await browseWorld(f.db,'en',state('view=results&type=services&category=maintenance&q=phase-tag'))).listing.total,1);
   assert.equal((await browseWorld(f.db,'zh-CN',state('view=results&type=services&category=maintenance&q=phase-tag'))).listing.total,0);
   for(const query of ['world=wrong','place=wrong','category=wrong','type=stays&category=signals','view=results&page=999'])assert.equal((await app.inject('/api/browse?'+query)).statusCode,404,query);
   assert.equal((await app.inject('/api/browse?page=0')).statusCode,400);
   assert.equal((await browseWorld(f.db,'en',state('q=absent'))).listing.total,0);
   assert.equal((await browseWorld(f.db,'en',state('world=test-harbour&view=results'))).listing.total,1);
 });
 await t.test('publication changes update home, category counts and complete results immediately',async()=>{
   const before=(await browseWorld(f.db,'en',state('view=results'))).listing.total;
   await unpublishContent(f.db,f.data.owner,service,false,'test');
   assert.equal((await browseWorld(f.db,'en',state('view=results'))).listing.total,before-1);
   await restorePublication(f.db,f.data.owner,service,publication);
   assert.equal((await browseWorld(f.db,'en',state('view=results'))).listing.total,before);
   const batch={worldId:f.data.latheId,source:'service-test',items:[{externalId:'one',content:input('import-service')}]};
   assert.equal((await importContent(f.db,f.data.owner,batch,true)).results[0]!.status,'valid');
   const imported=await importContent(f.db,f.data.owner,batch,false);assert.equal(imported.results[0]!.status,'created');
   const missing=await createContent(f.db,f.data.owner,{...input('translated-service'),translations:{}});
   const provider=randomUUID();await f.db.query('UPDATE translation_jobs SET provider=$2 WHERE revision_id=$1',[missing.revisionId,provider]);
   await runTranslationOnce(f.db,{id:provider,translate:async request=>{assert.deepEqual(request.text.tags,['phase-tag']);return textSchema.parse({title:'翻译服务',description:'服务译文',tags:['翻译标签']});}});
   assert.equal(await getPublished(f.db,'zh-CN',{id:missing.id}),null);await publish(missing);assert.deepEqual((await getPublished(f.db,'zh-CN',{id:missing.id}))!.text.tags,['翻译标签']);
 });
});
