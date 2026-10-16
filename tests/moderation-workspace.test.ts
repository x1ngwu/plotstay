import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.ts';
import {historicalProvider} from './work-fixtures.ts';
import {createAccount,savePersona,startReview,saveReview,submitReview,reviewDetail,reviewRevision,adminList,adminDetail,previewDetail,saveReply,replyAction,moderatePersona,getPublished,savePersonaNotes,createContent} from '@plotstay/domain';
import {moderationScopes,moderationList,moderationRecord,moderationProfile,decideModeration,moderationBindings} from '../packages/domain/src/moderation-workspace.ts';
import {createApp} from '../apps/api/src/app.ts';
assert.equal(process.env.DOTENV_CONFIG_PATH,'/dev/null');assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/moderation_test');
const profiles={en:{name:'Fixed Moss',bio:'Fixed signature',avatar:'mint'},'zh-CN':{name:'固定苔',bio:'固定署名',avatar:'mint'}};
const body={sourceLocale:'en',texts:{en:{title:'Fixed submission A',description:'PRIVATE DRAFT TEXT'},'zh-CN':{title:'固定送审',description:'私人草稿'}},rating:4};
const query={kind:'reviews' as const,locale:'en',status:'pending',enabled:'all',q:'',page:1};
const code=(x:string)=>(e:any)=>e.code===x;
async function setup(){
 const f=await fixture();const u=await createAccount(f.db,f.data.admin,{email:'author@moderation.test',password:randomUUID()});const author={id:u.id,email:u.email,siteRole:'user' as const};
 const p=await savePersona(f.db,author,profiles);const {id}=await startReview(f.db,author,f.data.ids['observation-room']!,p.id);const d=await reviewDetail(f.db,author,id);const a=await saveReview(f.db,author,id,d.revisions[0].id,body);await submitReview(f.db,author,id,a.revisionId);
 return {...f,author,p,id,a,world:d.content.world_id};
}
test('authorized independent queues, owner-only scopes, fixed profile reference and counts',async t=>{
 const f=await setup();t.after(f.cleanup);const {db,data}=f;
 const list=await moderationList(db,data.admin,query);assert(list.items.some((x:any)=>x.id===f.id));assert(list.pendingReviews>0);assert.equal(list.pageSize,20);
 const profiles=await moderationList(db,data.admin,{...query,kind:'profiles'});assert(profiles.items.some((x:any)=>x.revision_id===f.p.revisionId));
 await assert.rejects(moderationList(db,f.author,query),code('REVIEW_FORBIDDEN'));
 await db.query('UPDATE worlds SET owner_id=$1 WHERE id=$2',[f.author.id,f.world]);assert((await moderationScopes(db,f.author)).worlds.some(w=>w.id===f.world&&w.role==='owner'));
 const own=await moderationList(db,f.author,query);assert(own.items.some((x:any)=>x.id===f.id));
 const d=await moderationRecord(db,data.admin,'reviews',f.id);assert.equal(d.submitted.id,f.a.revisionId);assert(d.joint);assert.equal(d.profile.id,f.p.revisionId);
});
test('ordinary publication cannot silently approve a profile; explicit combined transaction preserves B',async t=>{
 const f=await setup();t.after(f.cleanup);const {db,data}=f;
 await assert.rejects(reviewRevision(db,data.admin,f.id,f.a.revisionId,'publish',''),code('PERSONA_APPROVAL_REQUIRED'));
 const b=await saveReview(db,f.author,f.id,f.a.revisionId,{...body,texts:{...body.texts,en:{title:'Later B',description:'LATER PRIVATE B'}}});
 const d=await moderationRecord(db,data.admin,'reviews',f.id);assert.equal(d.head.id,b.revisionId);
 const action={...d.guard,action:'publish' as const,note:'fixed approval',approvePersonaRevisionId:f.p.revisionId};
 const results=await Promise.allSettled([decideModeration(db,data.admin,'reviews',f.id,action),decideModeration(db,data.admin,'reviews',f.id,action)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await getPublished(db,'en',{id:f.id}))?.text.title,body.texts.en.title);
 const after=await moderationRecord(db,data.admin,'reviews',f.id);assert.equal(after.head.id,b.revisionId);assert.equal(after.current.version.id,f.a.revisionId);assert.equal(after.submitted,null);
});
test('failed combined publication rolls back its new profile decision',async t=>{
 const f=await setup();t.after(f.cleanup);const {db,data}=f;const d=await moderationRecord(db,data.admin,'reviews',f.id);
 await db.query("INSERT INTO locales(code,name,path_prefix,language_tag,enabled,required_for_publish)VALUES('fr','French','fr','fr',true,true)");
 await assert.rejects(decideModeration(db,data.admin,'reviews',f.id,{...d.guard,action:'publish',note:'',approvePersonaRevisionId:f.p.revisionId}),code('TRANSLATIONS_REQUIRED'));
 assert.equal((await db.query('SELECT 1 FROM persona_revision_decisions WHERE revision_id=$1',[f.p.revisionId])).rowCount,0);
 assert.equal((await moderationRecord(db,data.admin,'reviews',f.id)).submitted.id,f.a.revisionId);
});
test('editor cannot read/search personal drafts; current public snapshot remains readable',async t=>{
 const f=await setup();t.after(f.cleanup);const {db,data}=f;
 const u=await createAccount(db,data.admin,{email:'editor@moderation.test',password:randomUUID()});const editor={id:u.id,email:u.email,siteRole:'user' as const};await db.query("INSERT INTO world_members(world_id,user_id,role)VALUES($1,$2,'editor')",[f.world,u.id]);
 await assert.rejects(adminDetail(db,editor,f.id),code('REVIEW_FORBIDDEN'));
 assert.equal((await adminList(db,editor,f.world,{q:'PRIVATE DRAFT TEXT'})).total,0);
 await moderatePersona(db,data.admin,f.p.revisionId,'approved','');await reviewRevision(db,data.admin,f.id,f.a.revisionId,'publish','');
 const b=await saveReview(db,f.author,f.id,f.a.revisionId,{...body,texts:{...body.texts,en:{title:'SECRET AFTER PUBLICATION',description:'LATER PRIVATE B'}}});
 const d=await adminDetail(db,editor,f.id);assert(d.readOnly);assert.equal(d.revisions.length,1);assert(!JSON.stringify(d).includes('LATER PRIVATE B'));assert.equal((await adminList(db,editor,f.world,{q:'SECRET AFTER PUBLICATION'})).total,0);
 const raw=await reviewDetail(db,f.author,f.id);await assert.rejects(previewDetail(db,editor,f.id,b.revisionId,raw.content.draft_token,'en'),code('REVIEW_FORBIDDEN'));
 const legacy=(await db.query("SELECT c.id FROM contents c JOIN review_signatures s ON s.revision_id=c.head_revision_id WHERE c.world_id=$1 AND c.kind='review' AND NOT s.managed LIMIT 1",[f.world])).rows[0];if(legacy)assert(!(await adminDetail(db,editor,legacy.id)).readOnly);
});
test('reply queue and detail are independent, contain public original context; explicit joint reply approval',async t=>{
 const f=await setup();t.after(f.cleanup);const {db,data}=f;
 await moderatePersona(db,data.admin,f.p.revisionId,'approved','');await reviewRevision(db,data.admin,f.id,f.a.revisionId,'publish','');await historicalProvider(db,data.admin,data.ids['observation-room']!,f.p.id);
 const next=await savePersona(db,f.author,{...profiles,en:{...profiles.en,name:'Provider update'}},f.p.id,f.p.revisionId);
 const a=await saveReply(db,f.author,f.id,{sourceLocale:'en',texts:{en:'Fixed reply','zh-CN':'固定回复'}},null);await replyAction(db,f.author,f.id,'submit',a.revisionId);
 const list=await moderationList(db,data.admin,{...query,kind:'replies'});assert(list.items.some((x:any)=>x.id===f.id));
 const d=await moderationRecord(db,data.admin,'replies',f.id);assert.equal(d.context!.en.text.title,body.texts.en.title);assert(d.joint);
 await assert.rejects(replyAction(db,data.admin,f.id,'publish',a.revisionId),code('PERSONA_APPROVAL_REQUIRED'));
 await decideModeration(db,data.admin,'replies',f.id,{...d.guard,action:'publish',note:'',approvePersonaRevisionId:next.revisionId});assert((await moderationRecord(db,data.admin,'replies',f.id)).published);
});
test('profile detail has fixed/approved comparison and events, never private notes; binding states',async t=>{
 const f=await setup();t.after(f.cleanup);await savePersonaNotes(f.db,f.author,f.p.id,{body:'PRIVATE NOTE MUST NOT LEAK',baseVersion:null,requestId:randomUUID()});
 const d=await moderationProfile(f.db,f.data.admin,f.p.revisionId);assert(d.canDecide);assert(d.related.some(x=>x.id===f.id));assert(!JSON.stringify(d).includes('PRIVATE NOTE MUST NOT LEAK'));
 await assert.rejects(moderationProfile(f.db,f.author,f.p.revisionId),code('SITE_ADMIN_REQUIRED'));
 const b=await moderationBindings(f.db,f.data.admin,f.world);assert(b.entries.length);assert(b.entries.every(x=>'locked' in x&&'owner_id' in x&&'reason' in x));
});
test('returned review history keeps submission translations, signature and metadata apart from B',async t=>{
 const f=await setup();t.after(f.cleanup);
 const b=await saveReview(f.db,f.author,f.id,f.a.revisionId,{...body,texts:{...body.texts,en:{title:'Later B',description:'Later B body',origin:'Later origin',stayDuration:'Later duration',tags:['Later tag']}},reviewRatings:{cleanliness:2}});
 let d=await moderationRecord(f.db,f.data.admin,'reviews',f.id);
 await decideModeration(f.db,f.data.admin,'reviews',f.id,{...d.guard,action:'reject',note:'Return A'});
 // Legacy translation pointers can move after return; immutable submission locales must not.
 const tx=(await f.db.query("INSERT INTO translations(revision_id,locale,body,origin,created_by)VALUES($1,'en',$2,'manual',$3)RETURNING id",[f.a.revisionId,{title:'Changed after return',description:'Not the submitted text'},f.author.id])).rows[0];
 await f.db.query("UPDATE revision_locales SET translation_id=$2 WHERE revision_id=$1 AND locale='en'",[f.a.revisionId,tx.id]);
 d=await moderationRecord(f.db,f.data.admin,'reviews',f.id);
 assert.equal(d.submitted,null);assert.equal(d.current,null);assert.equal(d.head.id,b.revisionId);
 const old=d.submissionHistory.find(x=>x.revision_id===f.a.revisionId)!;
 assert.equal(old.version.texts.en.description,body.texts.en.description);assert.equal(old.version.persona_revision_id,f.p.revisionId);assert.equal(old.version.profiles.en.name,profiles.en.name);
 assert.equal(d.head.texts.en.review.origin,'Later origin');assert.equal(d.head.attributes.reviewRatings.cleanliness,2);
 const list=await moderationList(f.db,f.data.admin,{...query,status:'rejected'});assert.equal(list.items.find((x:any)=>x.id===f.id).revision_id,old.revision_id);
 await assert.rejects(moderationRecord(f.db,f.data.editor,'reviews',f.id),code('REVIEW_FORBIDDEN'));
});
test('returned reply history preserves A and its signature when B uses a newer profile',async t=>{
 const f=await setup();t.after(f.cleanup);const {db,data}=f;
 await moderatePersona(db,data.admin,f.p.revisionId,'approved','');await reviewRevision(db,data.admin,f.id,f.a.revisionId,'publish','');await historicalProvider(db,data.admin,data.ids['observation-room']!,f.p.id);
 const a=await saveReply(db,f.author,f.id,{sourceLocale:'en',texts:{en:'Fixed reply A','zh-CN':'固定回复 A'}},null);await replyAction(db,f.author,f.id,'submit',a.revisionId);
 const profileB=await savePersona(db,f.author,{...profiles,en:{...profiles.en,name:'Later profile'}},f.p.id,f.p.revisionId);
 const b=await saveReply(db,f.author,f.id,{sourceLocale:'en',texts:{en:'Later reply B','zh-CN':'后续回复 B'}},a.revisionId);
 const before=await moderationRecord(db,data.admin,'replies',f.id);await decideModeration(db,data.admin,'replies',f.id,{...before.guard,action:'reject',note:'Return A'});
 const d=await moderationRecord(db,data.admin,'replies',f.id),old=d.submissionHistory[0]!;
 assert.equal(d.submitted,null);assert.equal(old.version.id,a.revisionId);assert.equal(old.version.texts.en.description,'Fixed reply A');assert.equal(old.version.persona_revision_id,f.p.revisionId);
 assert.equal(d.head.id,b.revisionId);assert.equal(d.head.persona_revision_id,profileB.revisionId);assert.equal(d.head.profiles.en.name,'Later profile');
});
test('API checks actor identity; ordinary account command supports truthful read-back without password',async t=>{
 const f=await setup();t.after(f.cleanup);const app=await createApp(f.db);t.after(()=>app.close());
 const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin:'http://localhost:4321'},payload:f.credentials});const cookie=login.cookies.map(c=>c.name+'='+c.value).join(';');
 const headers={cookie,origin:'http://localhost:4321','x-plotstay-actor':f.data.admin.id};const id=randomUUID();const payload={requestId:id,email:'created@moderation.test',password:randomUUID()};
 const result=await app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers,payload});assert.equal(result.statusCode,200);assert.equal(result.json().site_role,'user');assert(!result.body.includes(payload.password));assert(!result.body.includes('hash'));
 const read=await app.inject({method:'GET',url:'/api/moderation-workspace/accounts/'+id+'?email='+payload.email,headers});assert(read.json().confirmed);
 const stale=await app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers:{...headers,'x-plotstay-actor':f.author.id},payload});assert.equal(stale.json().error.code,'ACCOUNT_CHANGED');
});

test('authorization before search/count; all pages and independent profile paging; literal wildcard search',async t=>{
 const f=await setup();t.after(f.cleanup);const ids=[f.id];
 for(let i=0;i<23;i++){const p=await savePersona(f.db,f.author,{...profiles,en:{...profiles.en,name:'Paged '+i}});const r=await startReview(f.db,f.author,f.data.ids['observation-room']!,p.id);const d=await reviewDetail(f.db,f.author,r.id);const a=await saveReview(f.db,f.author,r.id,d.content.head_revision_id,{...body,texts:{...body.texts,en:{title:'Queue row '+i,description:i===0?'Needle %_ literal':'Paged body'}}});await submitReview(f.db,f.author,r.id,a.revisionId);ids.push(r.id);}
 const first=await moderationList(f.db,f.data.owner,query),second=await moderationList(f.db,f.data.owner,{...query,page:2});assert.equal(first.total,24);assert.equal(second.items.length,4);assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,24);
 const found=await moderationList(f.db,f.data.owner,{...query,q:'Needle %_ literal'});assert.equal(found.total,1);assert.equal(found.items[0].id,ids[1]);assert.equal((await moderationList(f.db,f.data.admin,{...query,kind:'profiles',page:2})).items.length,4);
 assert.equal((await moderationList(f.db,f.data.secondOwner,{...query,q:'PRIVATE DRAFT TEXT'})).total,0);
 await assert.rejects(moderationList(f.db,f.data.secondOwner,{...query,world:f.world}),code('WORLD_FORBIDDEN'));
 await assert.rejects(moderationRecord(f.db,f.data.secondOwner,'reviews',f.id),code('WORLD_FORBIDDEN'));
});

test('stale submissions and explicitly confirmed profile changes cannot publish a replacement',async t=>{
 const f=await setup();t.after(f.cleanup);const old=await moderationRecord(f.db,f.data.admin,'reviews',f.id);
 const b=await saveReview(f.db,f.author,f.id,f.a.revisionId,{...body,texts:{...body.texts,en:{title:'Replacement A2',description:'Replacement'}}});await submitReview(f.db,f.author,f.id,b.revisionId);
 await assert.rejects(decideModeration(f.db,f.data.admin,'reviews',f.id,{...old.guard,action:'publish',note:'keep me',approvePersonaRevisionId:f.p.revisionId}),code('SUBMISSION_SUPERSEDED'));
 const now=await moderationRecord(f.db,f.data.admin,'reviews',f.id);await moderatePersona(f.db,f.data.admin,f.p.revisionId,'approved','Other moderator');
 await assert.rejects(decideModeration(f.db,f.data.admin,'reviews',f.id,{...now.guard,action:'publish',note:'',approvePersonaRevisionId:f.p.revisionId}),code('REVISION_LOCKED'));
 assert.equal((await moderationRecord(f.db,f.data.admin,'reviews',f.id)).submitted.id,b.revisionId);
 await decideModeration(f.db,f.data.admin,'reviews',f.id,{...now.guard,action:'publish',note:''});assert.equal((await getPublished(f.db,'en',{id:f.id}))!.text.title,'Replacement A2');
});

test('return, hide, historical restore and availability remain independent of drafts and publication',async t=>{
 const f=await setup();t.after(f.cleanup);const {disablePersona}=await import('@plotstay/domain');
 await moderatePersona(f.db,f.data.admin,f.p.revisionId,'approved','');await reviewRevision(f.db,f.data.admin,f.id,f.a.revisionId,'publish','');
 const b=await saveReview(f.db,f.author,f.id,f.a.revisionId,body);await submitReview(f.db,f.author,f.id,b.revisionId);let d=await moderationRecord(f.db,f.data.admin,'reviews',f.id);const old=d.current!.id;
 await decideModeration(f.db,f.data.owner,'reviews',f.id,{...d.guard,action:'reject',note:'Returned'});d=await moderationRecord(f.db,f.data.admin,'reviews',f.id);assert(d.published);assert.equal(d.submitted,null);assert.equal(d.current!.id,old);
 await disablePersona(f.db,f.data.admin,f.p.id,true,false);assert(await getPublished(f.db,'en',{id:f.id}));await disablePersona(f.db,f.data.admin,f.p.id,false,true);
 await decideModeration(f.db,f.data.owner,'reviews',f.id,{...d.guard,action:'hide',note:'Hide independently'});d=await moderationRecord(f.db,f.data.admin,'reviews',f.id);assert(!d.published);assert.equal(d.head.id,b.revisionId);
 await decideModeration(f.db,f.data.owner,'reviews',f.id,{...d.guard,action:'restore',restoreId:old,note:''});d=await moderationRecord(f.db,f.data.admin,'reviews',f.id);assert(d.published);assert.equal(d.current!.version.id,f.a.revisionId);assert.equal(d.head.id,b.revisionId);assert.equal(d.submitted,null);
});

test('binding keeps legal world owner access; no owner override, candidates, permanent lock and race',async t=>{
 const f=await setup();t.after(f.cleanup);const {saveWork}=await import('../packages/domain/src/works.ts');const {createContentSchema}=await import('@plotstay/contracts');const {saveModerationBinding}=await import('../packages/domain/src/moderation-workspace.ts');const {submitRevision,bindProvider,submitOwnPersona}=await import('@plotstay/domain');const {setWorkAccess}=await import('../packages/domain/src/work-access.ts');await setWorkAccess(f.db,f.data.owner,f.world,f.data.owner.id,'join');await setWorkAccess(f.db,f.data.owner,f.world,f.data.owner.id,'approve');
 const p=await savePersona(f.db,f.data.owner,profiles),p2=await savePersona(f.db,f.data.owner,{...profiles,en:{...profiles.en,name:'Second provider'}});await submitOwnPersona(f.db,f.data.owner,p.id,p.revisionId);await submitOwnPersona(f.db,f.data.owner,p2.id,p2.revisionId);await moderatePersona(f.db,f.data.admin,p.revisionId,'approved','');await moderatePersona(f.db,f.data.admin,p2.revisionId,'approved','');
 const draft=createContentSchema.parse({worldId:f.world,kind:'stay',slug:'binding-test',sourceLocale:'en',text:{title:'Binding test',description:'Private work'},translations:{'zh-CN':{title:'绑定测试',description:'未公开作品'}},attributes:{price:{amount:100,unit:'night'}}});const w=await saveWork(f.db,f.data.owner,{requestId:randomUUID(),providerId:p.id,draft});
 let opts=await moderationBindings(f.db,f.data.owner,f.world);assert.equal(opts.entries.find(x=>x.id===w.id)!.reason,null);assert(opts.personas.every(x=>x.owner===f.data.owner.email));
 await assert.rejects(saveModerationBinding(f.db,f.data.admin,w.id,p2.id,p.id,w.draftToken),code('PROVIDER_FORBIDDEN'));
 await f.db.query('UPDATE personas SET disabled=true WHERE owner_id=$1',[f.data.owner.id]);assert.equal((await moderationBindings(f.db,f.data.owner,f.world)).entries.find(x=>x.id===w.id)!.reason,'NO_CANDIDATES');await f.db.query('UPDATE personas SET disabled=false WHERE owner_id=$1',[f.data.owner.id]);
 const results=await Promise.allSettled([submitRevision(f.db,f.data.owner,w.id,w.revisionId,w.draftToken,true),saveModerationBinding(f.db,f.data.owner,w.id,p2.id,p.id,w.draftToken)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const content=(await f.db.query('SELECT * FROM contents WHERE id=$1',[w.id])).rows[0];if(!(await f.db.query("SELECT 1 FROM content_revisions WHERE id=$1 AND status='submitted'",[w.revisionId])).rowCount)await submitRevision(f.db,f.data.owner,w.id,w.revisionId,content.draft_token,true);
 await reviewRevision(f.db,f.data.admin,w.id,w.revisionId,'reject','Does not unlock');const current=(await f.db.query('SELECT persona_id FROM provider_bindings WHERE content_id=$1',[w.id])).rows[0].persona_id;await assert.rejects(bindProvider(f.db,f.data.admin,w.id,current===p.id?p2.id:p.id),code('PROVIDER_LOCKED'));
 assert.equal((await moderationBindings(f.db,f.data.owner,f.world)).entries.find(x=>x.id===w.id)!.reason,'PROVIDER_LOCKED');
});

test('legacy editorial notes remain collaborative; private history/API and shared impacts are filtered',async t=>{
 const f=await setup();t.after(f.cleanup);const {createContentSchema}=await import('@plotstay/contracts');const {settingDetail,digest}=await import('@plotstay/domain');
 const note=await createContent(f.db,f.data.editor,createContentSchema.parse({worldId:f.world,kind:'review',slug:'legacy-editorial',parentContentId:f.data.ids['observation-room'],sourceLocale:'en',text:{title:'Editorial note',description:'Collaborative editorial text'},attributes:{rating:4}}));assert(!(await adminDetail(f.db,f.data.editor,note.id)).readOnly);
 const worldSetting=(await f.db.query("SELECT id FROM detail_settings WHERE kind='world' AND entity_id=$1",[f.world])).rows[0];if(worldSetting)assert(!(await settingDetail(f.db,f.data.editor,worldSetting.id)).impacts.some((x:any)=>x.id===f.id));
 const app=await createApp(f.db);t.after(()=>app.close());const token=randomUUID();await f.db.query("INSERT INTO sessions(token_hash,user_id,expires_at)VALUES($1,$2,now()+interval '1 hour')",[digest(token),f.data.editor.id]);const headers={cookie:'plotstay_session='+token};
 for(const url of ['/api/admin/contents/'+f.id,'/api/moderation/reviews/'+f.id,'/api/moderation-workspace/records/reviews/'+f.id]){const r=await app.inject({url,headers});assert(r.statusCode>=400);assert(!r.body.includes('PRIVATE DRAFT TEXT'));}
});

test('reply combined rollback, qualification revocation and site restriction preserve historical rules',async t=>{
 const f=await setup();t.after(f.cleanup);const {setWorkAccess}=await import('../packages/domain/src/work-access.ts');const {unpublishContent}=await import('@plotstay/domain');
 await moderatePersona(f.db,f.data.admin,f.p.revisionId,'approved','');await reviewRevision(f.db,f.data.admin,f.id,f.a.revisionId,'publish','');await historicalProvider(f.db,f.data.admin,f.data.ids['observation-room']!,f.p.id);
 const p=await savePersona(f.db,f.author,{...profiles,en:{...profiles.en,name:'Reply fixed profile'}},f.p.id,f.p.revisionId);const a=await saveReply(f.db,f.author,f.id,{sourceLocale:'en',texts:{en:'Fixed provider reply','zh-CN':'固定提供者回复'}},null);await replyAction(f.db,f.author,f.id,'submit',a.revisionId);let d=await moderationRecord(f.db,f.data.admin,'replies',f.id);
 await f.db.query("CREATE FUNCTION fail_reply_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated rollback probe'; END $$; CREATE TRIGGER fail_reply_test BEFORE INSERT ON reply_publications FOR EACH ROW EXECUTE FUNCTION fail_reply_test()");
 await assert.rejects(decideModeration(f.db,f.data.admin,'replies',f.id,{...d.guard,action:'publish',note:'',approvePersonaRevisionId:p.revisionId}));assert.equal((await f.db.query('SELECT 1 FROM persona_revision_decisions WHERE revision_id=$1',[p.revisionId])).rowCount,0);
 await f.db.query('DROP TRIGGER fail_reply_test ON reply_publications');
 await decideModeration(f.db,f.data.admin,'replies',f.id,{...d.guard,action:'publish',note:'',approvePersonaRevisionId:p.revisionId});d=await moderationRecord(f.db,f.data.admin,'replies',f.id);const publication=d.current!.id;
 await setWorkAccess(f.db,f.data.owner,f.world,f.author.id,'revoke');await assert.rejects(decideModeration(f.db,f.data.admin,'replies',f.id,{...d.guard,action:'restore',restoreId:publication,note:''}),code('ELIGIBILITY_REVOKED'));
 await setWorkAccess(f.db,f.data.owner,f.world,f.author.id,'join');await setWorkAccess(f.db,f.data.owner,f.world,f.author.id,'approve');await unpublishContent(f.db,f.data.admin,f.id,true,'Restricted');d=await moderationRecord(f.db,f.data.admin,'replies',f.id);assert(!d.published);await assert.rejects(decideModeration(f.db,f.data.admin,'replies',f.id,{...d.guard,action:'restore',restoreId:publication,note:''}));
});

test('account validation, no elevated fields, duplicate idempotence and site-only commands',async t=>{
 const f=await setup();t.after(f.cleanup);const {digest}=await import('@plotstay/domain');const app=await createApp(f.db);t.after(()=>app.close());
 const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin:'http://localhost:4321'},payload:f.credentials});const headers={origin:'http://localhost:4321',cookie:login.cookies.map(c=>c.name+'='+c.value).join(';'),'x-plotstay-actor':f.data.admin.id};const payload={requestId:randomUUID(),email:'command@moderation.test',password:randomUUID()};
 for(const b of [{...payload,email:'invalid'},{...payload,password:'short'},{...payload,siteRole:'admin'}])assert.equal((await app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers,payload:b})).statusCode,400);
 const before=(await f.db.query('SELECT count(*)::int n FROM personas')).rows[0].n;const result=await Promise.all([app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers,payload}),app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers,payload})]);assert(result.every(x=>x.statusCode===200&&x.json().id===payload.requestId&&x.json().site_role==='user'));assert.equal((await f.db.query('SELECT count(*)::int n FROM personas')).rows[0].n,before);
 assert.equal((await app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers,payload:{...payload,requestId:randomUUID()}})).json().error.code,'ALREADY_EXISTS');
 const token=randomUUID();await f.db.query("INSERT INTO sessions(token_hash,user_id,expires_at)VALUES($1,$2,now()+interval '1 hour')",[digest(token),f.data.owner.id]);const ownerHeaders={...headers,cookie:'plotstay_session='+token,'x-plotstay-actor':f.data.owner.id};
 assert.equal((await app.inject({method:'POST',url:'/api/moderation-workspace/accounts',headers:ownerHeaders,payload:{...payload,requestId:randomUUID()}})).statusCode,403);assert.equal((await app.inject({url:'/api/moderation-workspace/profiles/'+f.p.revisionId,headers:ownerHeaders})).statusCode,403);assert.equal((await app.inject({url:'/api/moderation-workspace/providers/'+f.world,headers:ownerHeaders})).statusCode,200);
 const decisions=await Promise.all([app.inject({method:'POST',url:'/api/moderation-workspace/profiles/'+f.p.revisionId,headers,payload:{decision:'approved',note:'Only this profile'}}),app.inject({method:'POST',url:'/api/moderation-workspace/profiles/'+f.p.revisionId,headers,payload:{decision:'approved',note:'Concurrent'}})]);assert.deepEqual(decisions.map(x=>x.statusCode).sort(),[200,409]);assert((await moderationRecord(f.db,f.data.admin,'reviews',f.id)).submitted);assert.equal(await getPublished(f.db,'en',{id:f.id}),null);
 const availability=await app.inject({method:'POST',url:'/api/moderation-workspace/personas/'+f.p.id+'/availability',headers,payload:{disabled:true,expectedDisabled:false}});assert.equal(availability.statusCode,200);assert.equal(availability.json().disabled,true);

});
