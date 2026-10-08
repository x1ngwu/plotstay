import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {detailFixture} from './detail-fixture.ts';
import {historyDigest} from './helpers.ts';
import {seedStayDetails} from '../scripts/seed-stay-details.ts';
import {seedExperienceDetails} from '../scripts/seed-experience-details.ts';
import {seedServiceDetails} from '../scripts/seed-service-details.ts';
import {createApp} from '../apps/api/src/app.ts';
import {initializeSettings,listSettings,settingDetail,saveSetting,settingAction,publicDetailCopy,adminDetail,adminList,editContent,previewDetail,getPublished,submitRevision,reviewRevision,restorePublication,createContent,createGuest,quoteBooking,createBooking,getReceipt,saveTranslation,adminHome,saveHomeDraft,reviewHome,importContent,runTranslationOnce} from '@plotstay/domain';
import {textSchema,attributesSchema,editContentSchema,createContentSchema,detailCopyDefaults,copySchema,type QuoteInput} from '@plotstay/contracts';
const rejected=(fn:()=>Promise<unknown>,code:string)=>assert.rejects(fn,(e:any)=>e.code===code);
test('phase 5.5 persistent content management',async t=>{
 const f=await detailFixture();t.after(f.cleanup);const {db,data}=f;
 await seedStayDetails(db,data.admin,true);await seedExperienceDetails(db,data.admin,true);await seedServiceDetails(db,data.admin,true);
 const publish=async(id:string,revisionId:string)=>{await submitRevision(db,data.owner,id,revisionId);return reviewRevision(db,data.owner,id,revisionId,'publish','5.5 isolated acceptance');};
 await t.test('bootstrap is explicit, idempotent and preserves all original business rows',async()=>{
  const before=await historyDigest(db);assert.ok((await initializeSettings(db,data.admin)).missing.length>0);assert.equal((await db.query('SELECT * FROM detail_settings')).rowCount,0);
  await initializeSettings(db,data.admin,true);assert.deepEqual(await historyDigest(db),before);assert.deepEqual((await initializeSettings(db,data.admin,true)).missing,[]);
 });
 await t.test('all three full documents round trip, keep independent language order, zero, clear and restore',async()=>{
  for(const [slug,kind]of [['dockside-window','stay'],['forge-walk','experience'],['augmetic-tune-up','service']] as const){
   const c=(await db.query('SELECT id FROM contents WHERE slug=$1',[slug])).rows[0];const before=await adminDetail(db,data.owner,c.id);const old=await getPublished(db,'en',{id:c.id});
   const r=before.revisions[0];const en=structuredClone(r.translations.en),zh=structuredClone(r.translations['zh-CN']),attributes=structuredClone(r.attributes);
   en.title+=' saved';en[kind].introduction='';en.clearedFields=[kind+'.introduction'];en.map={center:'',transit:'A new stop',accessibleDescription:'Map text'};zh.map={center:'中文集合点'};
   en.facilities=[];en.rules=['last','first'];zh.rules=['第一','第二'];attributes.price.amount=0;
   if(kind==='stay'){attributes.stay.bedrooms=0;attributes.stay.responseRate=0;en.stay.amenities.reverse();zh.stay.amenities=zh.stay.amenities.slice(0,2);}
   if(kind==='experience')en.experience.steps.reverse();if(kind==='service')en.service.qualifications=[];
   const edit=editContentSchema.parse({baseRevisionId:before.content.head_revision_id,baseDraftToken:before.content.draft_token,sourceLocale:'en',text:en,translations:{'zh-CN':zh},attributes});
   const saved=await editContent(db,data.owner,c.id,edit);const actual=await adminDetail(db,data.owner,c.id);
   assert.deepEqual(actual.revisions[0].translations.en,edit.text);assert.deepEqual(actual.revisions[0].translations['zh-CN'],edit.translations['zh-CN']);assert.deepEqual(actual.revisions[0].attributes,attributes);
   assert.deepEqual(await getPublished(db,'en',{id:c.id}),old);await rejected(()=>editContent(db,data.owner,c.id,edit),'REVISION_CONFLICT');
   const preview=await previewDetail(db,data.owner,c.id,saved.revisionId,actual.content.draft_token,'en');assert.deepEqual(preview.content.text,edit.text);assert.equal(preview.content.preview,true);assert.equal(preview.content.publicationId,'');
   await publish(c.id,saved.revisionId);assert.deepEqual((await getPublished(db,'en',{id:c.id}))!.text,edit.text);
   await restorePublication(db,data.owner,c.id,old!.publicationId);assert.deepEqual((await getPublished(db,'en',{id:c.id}))!.text,old!.text);assert.equal((await adminDetail(db,data.owner,c.id)).content.head_revision_id,saved.revisionId);
  }
 });
 await t.test('every contract leaf has a persisted bilingual round trip, including full review and map metadata',async()=>{
  const generate=(raw:any,path:string,index=0):any=>{
   let schema=raw;while(['optional','default','nullable'].includes(schema.type))schema=schema.unwrap();
   if(schema.type==='object')return Object.fromEntries(Object.entries(schema.shape).map(([k,v])=>[k,generate(v,path+'.'+k,index)]));
   if(schema.type==='array')return path.endsWith('.clearedFields')?[]:[generate(schema.element,path+'.0',0),generate(schema.element,path+'.1',1)];
   if(schema.type==='record')return {one:'图片说明 / image one',two:'图片说明 / image two'};
   if(schema.type==='enum')return schema.options[index%schema.options.length];
   if(schema.type==='boolean')return false;if(schema.type==='number')return 1;
   if(path.endsWith('.url'))return index?'/media/maintenance.svg':'/media/quarters.svg';if(path.endsWith('.id')||path.endsWith('.imageId')||path.endsWith('.offeringImageId'))return index?'two':'one';
   if(/(?:startsAt|endsAt|opensAt)$/.test(path))return new Date(Date.now()+10*86400000+(path.endsWith('endsAt')?3600000:0)).toISOString();
   return '逐字段 '+path+' / field '+index;
  };
  for(const kind of ['stay','experience','service','review'] as const){
   const text=generate(textSchema,'text');for(const k of ['stay','experience','service','review'])if(k!==kind)delete text[k];text.description+='\n第二行。 English punctuation: “quoted”, commas; newline.';
   const attributes=generate(attributesSchema,'attributes');delete attributes.category;for(const k of ['stay','experience','service','reviewRatings'])if(k!==(kind==='review'?'reviewRatings':kind))delete attributes[k];
   if(kind==='review')delete attributes.price;else attributes.price={amount:0,unit:kind==='stay'?'night':kind==='experience'?'person':'session'};
   const zh=structuredClone(text);zh.title='中文 '+kind;zh.rules.reverse();
   const input=createContentSchema.parse({worldId:data.latheId,kind,slug:'every-field-'+kind,sourceLocale:'en',text,translations:{'zh-CN':zh},attributes,parentContentId:kind==='review'?data.ids['observation-room']:null});
   const c=await createContent(db,data.owner,input);const loaded=await adminDetail(db,data.owner,c.id);assert.deepEqual(loaded.revisions[0].translations,{en:input.text,'zh-CN':input.translations['zh-CN']});assert.deepEqual(loaded.revisions[0].attributes,input.attributes);
   await publish(c.id,c.revisionId);assert.deepEqual((await getPublished(db,'en',{id:c.id}))!.text,input.text);assert.deepEqual((await getPublished(db,'zh-CN',{id:c.id}))!.text,input.translations['zh-CN']);
  }
 });
 await t.test('configuration publication is reviewed, atomic, scoped, concurrent and historical',async()=>{
  const all=await listSettings(db,data.admin,data.latheId);const world=all.find(s=>s.kind==='world')!,copy=all.find(s=>s.kind==='copy')!;
  await rejected(()=>settingDetail(db,data.editor,copy.id),'SITE_ADMIN_REQUIRED');
  const original=await settingDetail(db,data.owner,world.id);const body=structuredClone(original.revisions[0].body);body.en.name='Draft world';body['zh-CN'].name='世界草稿';
  const before=(await db.query('SELECT translations FROM worlds WHERE id=$1',[world.entity_id])).rows[0];
  const results=await Promise.allSettled([saveSetting(db,data.owner,world.id,body,world.head_revision_id),saveSetting(db,data.owner,world.id,body,world.head_revision_id)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual((await db.query('SELECT translations FROM worlds WHERE id=$1',[world.entity_id])).rows[0],before);
  const current=await settingDetail(db,data.owner,world.id),rev=current.setting.head_revision_id;
  await rejected(()=>settingAction(db,data.owner,world.id,'publish',rev),'NOT_SUBMITTED');await settingAction(db,data.editor,world.id,'submit',rev);await rejected(()=>settingAction(db,data.editor,world.id,'publish',rev),'REVIEW_FORBIDDEN');await settingAction(db,data.owner,world.id,'publish',rev);assert.equal((await db.query('SELECT translations FROM worlds WHERE id=$1',[world.entity_id])).rows[0].translations.en.name,'Draft world');
  await settingAction(db,data.owner,world.id,'restore',rev,original.publications[0].id);assert.deepEqual((await db.query('SELECT translations FROM worlds WHERE id=$1',[world.entity_id])).rows[0],before);assert.equal((await settingDetail(db,data.owner,world.id)).setting.head_revision_id,rev);
  await assert.rejects(()=>db.query("UPDATE detail_setting_revisions SET body='{}' WHERE id=$1",[rev]));
  const initialCopy=await publicDetailCopy(db),changed=structuredClone(initialCopy);const key=Object.keys(detailCopyDefaults).find(k=>k.startsWith('stay.')&&!k.endsWith('.one')&&!k.endsWith('.other'))!;changed.en[key]='Changed heading';changed['zh-CN'][key]='新标题';
  const draft=await saveSetting(db,data.admin,copy.id,changed,copy.head_revision_id);assert.deepEqual(await publicDetailCopy(db),initialCopy);await settingAction(db,data.admin,copy.id,'submit',draft.revisionId);await settingAction(db,data.admin,copy.id,'publish',draft.revisionId);assert.deepEqual(await publicDetailCopy(db),changed);
  changed.en[key]='<script>alert(1)</script>';assert.equal(copySchema.safeParse(changed).success,false);changed.en[key]='{unknown}';assert.equal(copySchema.safeParse(changed).success,false);changed.en[key]='valid';changed.en.fake='bad';assert.equal(copySchema.safeParse(changed).success,false);
 });
 await t.test('shared changes preserve signed receipts and category history uses the home authority',async()=>{
  const content=(await getPublished(db,'en',{id:data.ids['observation-room']}))!;const guest=await createGuest(db);const day=(d:number)=>new Date(Date.now()+d*86400000).toISOString().slice(0,10);
  const input:QuoteInput={contentId:content.id,locale:'en',trip:{kind:'stay',start:day(2),end:day(3),guests:1,rooms:1}};const quote=await quoteBooking(db,input);const receipt=(await createBooking(db,{guestId:guest.id},{...input,quoteHash:quote.quoteHash,idempotencyKey:randomUUID()})).receipt;
  for(const s of (await listSettings(db,data.admin,data.latheId)).filter(s=>['world','place','persona'].includes(s.kind))){const d=await settingDetail(db,data.admin,s.id);const body=structuredClone(d.revisions.find(r=>r.id===d.setting.head_revision_id)!.body);for(const language of Object.keys(body)){if(typeof body[language]==='string')body[language]+=' updated';else body[language].name+=' updated';}const r=await saveSetting(db,data.admin,s.id,body,d.setting.head_revision_id);await settingAction(db,data.admin,s.id,'submit',r.revisionId);await settingAction(db,data.admin,s.id,'publish',r.revisionId);}
  assert.deepEqual(await getReceipt(db,{guestId:guest.id},receipt.id),receipt);
  const home=await adminHome(db,data.owner,data.latheId);const body=structuredClone(home.revisions[0].body);body.translations.en.categoryNames.maintenance='New category';const r=await saveHomeDraft(db,data.owner,data.latheId,body,home.setting.head_revision_id);await reviewHome(db,data.owner,data.latheId,'submit',r.revisionId);await reviewHome(db,data.owner,data.latheId,'publish',r.revisionId);await reviewHome(db,data.owner,data.latheId,'restore',r.revisionId,home.publications[0].id);assert.equal((await adminHome(db,data.owner,data.latheId)).setting.head_revision_id,r.revisionId);
 });
 await t.test('preview API refuses anonymous/foreign/stale and translation changes invalidate links',async()=>{
  const app=await createApp(db);t.after(()=>app.close());const id=data.ids['unpublished-room'];const d=await adminDetail(db,data.owner,id);const path=`/api/admin/contents/${id}/preview?locale=en&revisionId=${d.content.head_revision_id}&token=${d.content.draft_token}`;
  assert.equal((await app.inject(path)).statusCode,401);const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin:'http://localhost:4321'},payload:f.credentials});const cookie=login.headers['set-cookie']!.toString().split(';')[0]!;
  assert.equal((await app.inject({url:path,headers:{cookie}})).statusCode,200);
  await saveTranslation(db,data.owner,id,d.content.head_revision_id,'zh-CN',{...d.revisions[0].translations['zh-CN'],title:'译文改变'});
  assert.equal((await app.inject({url:path,headers:{cookie}})).statusCode,409);
  const foreign=(await db.query("SELECT u.id,u.email,u.site_role AS \"siteRole\" FROM users u JOIN world_members m ON m.user_id=u.id WHERE m.world_id=$1 LIMIT 1",[data.harbourId])).rows[0];
  await rejected(()=>previewDetail(db,foreign,id,d.content.head_revision_id,d.content.draft_token,'en'),'WORLD_FORBIDDEN');
  await assert.rejects(()=>quoteBooking(db,{contentId:id,locale:'en',trip:{kind:'stay',start:'2030-01-01',end:'2030-01-02',guests:1,rooms:1},preview:true}));
 });
 await t.test('new map and clear metadata survive import and translation jobs without publishing drafts',async()=>{
  const content=createContentSchema.parse({worldId:data.latheId,kind:'stay',slug:'import-detail-fields',sourceLocale:'en',text:{title:'Imported stay',description:'Original text',map:{center:'',transit:'Original stop'},stay:{space:''},clearedFields:['stay.space']},attributes:{price:{amount:0,unit:'night'},stay:{bedrooms:0}}});
  const batch={worldId:data.latheId,source:'phase55-fields',items:[{externalId:'one',content}]};assert.equal((await importContent(db,data.owner,batch,true)).results[0]!.status,'valid');const result=await importContent(db,data.owner,batch,false),id=result.results[0]!.contentId!;assert.equal((await importContent(db,data.owner,batch,false)).results[0]!.status,'unchanged');
  const detail=await adminDetail(db,data.owner,id),revision=detail.revisions[0],provider=randomUUID();await db.query('UPDATE translation_jobs SET provider=$2 WHERE revision_id=$1',[revision.id,provider]);await runTranslationOnce(db,{id:provider,translate:async request=>{assert.deepEqual(request.text.map,content.text.map);assert.deepEqual(request.text.clearedFields,['stay.space']);return {...request.text,title:'导入译文'};}});
  const translated=await adminDetail(db,data.owner,id);assert.deepEqual(translated.revisions[0].translations['zh-CN'].map,content.text.map);assert.deepEqual(translated.revisions[0].translations['zh-CN'].clearedFields,['stay.space']);assert.equal(await getPublished(db,'en',{id}),null);
  await rejected(()=>submitRevision(db,data.owner,id,revision.id,detail.content.draft_token),'REVISION_CONFLICT');
 });
 await t.test('management pagination finds entries beyond 200 and filters notes by parent',async()=>{
  for(let i=0;i<205;i++)await createContent(db,data.owner,createContentSchema.parse({worldId:data.latheId,kind:'stay',slug:'page-'+i,sourceLocale:'en',text:{title:'Page '+i,description:'Pagination fixture'},attributes:{price:{amount:0,unit:'night'}}}));
  const first=await adminList(db,data.owner,data.latheId,{kind:'stay',q:'Page '});assert.equal(first.total,205);assert.equal(first.contents.length,25);
  const ids=new Set<string>();for(let page=1;page<=first.pages;page++)for(const c of (await adminList(db,data.owner,data.latheId,{kind:'stay',q:'Page ',page})).contents)ids.add(c.id);assert.equal(ids.size,205);
  const notes=await adminList(db,data.owner,data.latheId,{kind:'review',parentId:data.ids['observation-room']});assert.ok(notes.total>0);assert.ok(notes.contents.every((c:any)=>c.parent_content_id===data.ids['observation-room']));
 });
});
