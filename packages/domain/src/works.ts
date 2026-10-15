import {transaction,type Database,type Connection} from '@plotstay/database';
import {createContentSchema,editContentSchema,type CreateContentInput,type EditContentInput} from '@plotstay/contracts';
import {digest,type Actor} from './auth.ts';
import {assert} from './errors.ts';
import {appendRevision,createContentInTransaction,lockContent} from './content.ts';
import {activeAccount,readWork,writeWork,bindWorkProvider} from './work-access.ts';
import {prepareWork} from './work-access.ts';
import {publicHome} from './home.ts';
export async function workEditorOptions(db:Database,actor:Actor,worldId:string,contentId?:string){return transaction(db,async c=>{
 if(contentId){const content=await readWork(c,actor,contentId);assert(content.world_id===worldId,403,'WORLD_FORBIDDEN','Content belongs to another world.');}else await prepareWork(c,actor,worldId);
 const {personas}=await workOptions(c,actor,true);if(contentId){const bound=(await c.query('SELECT p.id,p.profiles,p.approved,p.disabled FROM provider_bindings b JOIN personas p ON p.id=b.persona_id WHERE b.content_id=$1',[contentId])).rows[0];if(bound&&!personas.some(p=>p.id===bound.id))personas.push(bound);}
 const home=await publicHome(c,worldId,'en');return{personas,places:(await c.query('SELECT id,slug,names FROM places WHERE world_id=$1 ORDER BY slug',[worldId])).rows,parents:[],categories:home?.config.categories??[],translationProvider:process.env.TRANSLATION_PROVIDER??'disabled'};
});}
export interface WorkFilters {scope?:'mine'|'managed';world?:string;persona?:string;kind?:string;q?:string;visibility?:string[];state?:string[];page?:number;locale?:string}
export const authorizedWorks=`FROM contents c JOIN worlds w ON w.id=c.world_id LEFT JOIN work_ownership o ON o.content_id=c.id
 LEFT JOIN world_members m ON m.world_id=w.id AND m.user_id=$1
 WHERE c.kind IN ('stay','service','experience') AND (o.owner_id=$1 OR ($2 AND ($3 OR w.owner_id=$1 OR m.role IS NOT NULL)))`;
async function scope(db:Connection,actor:Actor,f:WorkFilters){await activeAccount(db,actor.id);const manage=actor.siteRole==='admin'||Boolean((await db.query('SELECT 1 FROM worlds w LEFT JOIN world_members m ON m.world_id=w.id AND m.user_id=$1 WHERE w.owner_id=$1 OR m.role IS NOT NULL LIMIT 1',[actor.id])).rowCount);assert(f.scope!=='managed'||manage,403,'SCOPE_FORBIDDEN','This account has no management scope.');return{params:[actor.id,f.scope==='managed',actor.siteRole==='admin'],manage};}
export async function workOptions(db:Connection,actor:Actor,creating=false,f:WorkFilters={}){
 const {params,manage}=await scope(db,actor,f);
 const worlds=creating?(await db.query(`SELECT w.id,w.slug,w.translations,coalesce(e.status,'never') AS qualification FROM worlds w LEFT JOIN work_eligibilities e ON e.world_id=w.id AND e.user_id=$1
 WHERE NOT w.site_blocked AND (w.visible OR $2 OR w.owner_id=$1 OR EXISTS(SELECT 1 FROM world_members m WHERE m.world_id=w.id AND m.user_id=$1)) AND coalesce(e.status,'never')<>'revoked' ORDER BY w.slug`,[actor.id,actor.siteRole==='admin'])).rows:
 (await db.query(`SELECT DISTINCT w.id,w.slug,w.translations ${authorizedWorks} ORDER BY w.slug`,params)).rows;
 const personas=creating?(await db.query(`SELECT p.id,p.approved,p.disabled,coalesce(r.body,p.profiles) AS profiles FROM personas p LEFT JOIN detail_settings s ON s.kind='persona' AND s.entity_id=p.id LEFT JOIN detail_setting_revisions r ON r.id=s.head_revision_id WHERE p.owner_id=$1 AND NOT p.disabled AND (r.id IS NOT NULL OR p.profiles<>'{}'::jsonb) ORDER BY p.created_at,p.id`,[actor.id])).rows:
 (await db.query(`WITH ids AS(SELECT c.id ${authorizedWorks}) SELECT DISTINCT p.id,p.approved,p.disabled,
 CASE WHEN p.owner_id=$1 THEN coalesce(r.body,p.profiles) ELSE p.profiles END AS profiles FROM ids JOIN provider_bindings b ON b.content_id=ids.id JOIN personas p ON p.id=b.persona_id LEFT JOIN detail_settings s ON s.kind='persona' AND s.entity_id=p.id LEFT JOIN detail_setting_revisions r ON r.id=s.head_revision_id ORDER BY p.id`,params)).rows;
 return{actorId:actor.id,worlds:worlds.map(w=>({...w,translations:Object.fromEntries(Object.entries(w.translations).map(([code,v]:any)=>[code,{name:v.name}]))})),personas:personas.map(p=>({...p,profiles:Object.fromEntries(Object.entries(p.profiles).map(([code,v]:any)=>[code,{name:v.name}]))})),canManage:manage};
}
export function listWorks(db:Database,actor:Actor,f:WorkFilters={}){return transaction(db,async client=>{
 await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
 const {params,manage}=await scope(client,actor,f);const options=await workOptions(client,actor,false,f);
 if(f.world)assert(options.worlds.some(w=>w.id===f.world),403,'WORLD_FORBIDDEN','This world is outside the selected scope.');
 if(f.persona)assert(options.personas.some(p=>p.id===f.persona),403,'PERSONA_FORBIDDEN','This persona is outside the selected scope.');
 const search=f.q?'%'+f.q.replace(/[\\%_]/g,'\\$&')+'%':null;
 const {rows:[result]}=await client.query(`WITH allowed AS MATERIALIZED(SELECT c.*,o.owner_id,w.translations AS world_names,w.slug AS world_slug,w.visible AS world_visible,w.site_blocked AS world_blocked ${authorizedWorks}),
 data AS(SELECT c.id,c.kind,c.slug,c.world_id,c.world_names,c.world_slug,c.owner_id,(SELECT active FROM users WHERE id=c.owner_id) AS owner_active,b.persona_id,c.head_revision_id AS revision_id,r.number,r.status,
 coalesce(tx.body->>'title',r.source_text->>'title') AS title,coalesce(tx.body->>'summary',r.source_text->>'summary') AS summary,
 (c.published_publication_id IS NOT NULL AND c.world_visible AND NOT c.site_blocked AND NOT c.world_blocked) AS is_public,
 CASE WHEN c.site_blocked OR c.world_blocked OR NOT c.world_visible THEN 'restricted'
 WHEN c.owner_id IS NULL OR b.persona_id IS NULL THEN 'repair'
 WHEN r.status='submitted' AND e.status='approved' AND e.epoch=s.epoch THEN 'submitted'
 WHEN r.status='rejected' THEN 'rejected'
 WHEN c.published_publication_id IS NULL AND EXISTS(SELECT 1 FROM publications p WHERE p.content_id=c.id) THEN 'unpublished'
 WHEN c.published_publication_id IS NULL THEN 'draft'
 WHEN pub.revision_id=c.head_revision_id THEN 'same' ELSE 'new' END AS state,
 greatest(r.created_at,(SELECT max(t.created_at) FROM revision_locales rl JOIN translations t ON t.id=rl.translation_id WHERE rl.revision_id=r.id AND t.origin='manual'),
 (SELECT max(me.created_at) FROM moderation_events me WHERE me.content_id=c.id AND me.action='provider_saved')) AS last_saved_at,
 coalesce(e.status,'never') AS eligibility
 FROM allowed c JOIN content_revisions r ON r.id=c.head_revision_id LEFT JOIN provider_bindings b ON b.content_id=c.id
 LEFT JOIN publications pub ON pub.id=c.published_publication_id LEFT JOIN revision_locales rl ON rl.revision_id=r.id AND rl.locale=$4 LEFT JOIN translations tx ON tx.id=rl.translation_id
 LEFT JOIN work_eligibilities e ON e.world_id=c.world_id AND e.user_id=c.owner_id LEFT JOIN work_submission_eligibilities s ON s.content_id=c.id AND s.revision_id=r.id
 WHERE ($5::uuid IS NULL OR c.world_id=$5) AND ($6::uuid IS NULL OR b.persona_id=$6)
 AND ($7::text IS NULL OR c.slug ILIKE $7 OR r.source_text->>'title' ILIKE $7 OR EXISTS(SELECT 1 FROM revision_locales x JOIN translations t ON t.id=x.translation_id WHERE x.revision_id=r.id AND t.body->>'title' ILIKE $7))),
 filtered AS MATERIALIZED(SELECT * FROM data WHERE (cardinality($8::text[])=0 OR CASE WHEN is_public THEN 'public' ELSE 'private' END=ANY($8)) AND (cardinality($9::text[])=0 OR state=ANY($9))),
 matched AS MATERIALIZED(SELECT * FROM filtered WHERE $10::text IS NULL OR kind=$10),
 counts AS(SELECT count(*)::int AS total,greatest(1,ceil(count(*)/25.0)::int) AS pages FROM matched),
 paged AS(SELECT * FROM matched ORDER BY last_saved_at DESC,id LIMIT 25 OFFSET (least($11::int,(SELECT pages FROM counts))-1)*25)
 SELECT total,pages,least($11::int,pages) AS page,coalesce((SELECT jsonb_agg(p ORDER BY last_saved_at DESC,id) FROM paged p),'[]') AS items,
 (SELECT jsonb_object_agg(kind,n) FROM(SELECT kind,count(*)::int AS n FROM filtered GROUP BY kind)x) AS facets FROM counts`,[...params,f.locale??'en',f.world??null,f.persona??null,search,f.visibility??[],f.state??[],f.kind??null,f.page??1]);
 return{actorId:actor.id,...result,pageSize:25,canManage:manage,options,items:result.items.map((r:any)=>({...r,provider:options.personas.find(p=>p.id===r.persona_id)??null,actions:{edit:!['repair','restricted'].includes(r.state)&&r.eligibility!=='revoked'&&r.owner_active!==false,savedPreview:!['repair','restricted'].includes(r.state),publicView:r.is_public}}))};
});}
export async function workDetail(db:Connection,actor:Actor,id:string){
 const content=await readWork(db,actor,id);
 const revisions=(await db.query(`SELECT r.*,coalesce((SELECT jsonb_object_agg(rl.locale,t.body) FROM revision_locales rl JOIN translations t ON t.id=rl.translation_id WHERE rl.revision_id=r.id),'{}') AS translations FROM content_revisions r WHERE content_id=$1 ORDER BY number DESC`,[id])).rows;
 const provider=(await db.query('SELECT b.persona_id,p.approved,p.disabled FROM provider_bindings b JOIN personas p ON p.id=b.persona_id WHERE b.content_id=$1',[id])).rows[0]??null;
 const locked=Boolean((await db.query('SELECT 1 FROM work_provider_locks WHERE content_id=$1',[id])).rowCount);
 const eligibility=(await db.query('SELECT e.status,e.epoch,s.epoch AS submitted_epoch FROM work_ownership o LEFT JOIN work_eligibilities e ON e.user_id=o.owner_id AND e.world_id=$2 LEFT JOIN work_submission_eligibilities s ON s.content_id=o.content_id AND s.revision_id=$3 WHERE o.content_id=$1',[id,content.world_id,content.head_revision_id])).rows[0];
 const submissionExpired=revisions[0]?.status==='submitted'&&(!eligibility||eligibility.status!=='approved'||eligibility.epoch!==eligibility.submitted_epoch);
 return{actorId:actor.id,content,provider,locked,submissionExpired,revisions,publications:(await db.query('SELECT * FROM publications WHERE content_id=$1 ORDER BY published_at DESC,id',[id])).rows,events:(await db.query('SELECT action,note,revision_id,created_at FROM moderation_events WHERE content_id=$1 ORDER BY created_at DESC,id',[id])).rows,jobs:(await db.query('SELECT j.id,j.revision_id,j.locale,j.status,j.attempts,j.max_attempts,j.available_at FROM translation_jobs j JOIN content_revisions r ON r.id=j.revision_id WHERE r.content_id=$1 ORDER BY j.created_at DESC',[id])).rows,canReview:false};
}
export interface WorkSave {requestId:string;contentId?:string;providerId:string;expectedProviderId?:string;draft:CreateContentInput|EditContentInput}
export function saveWork(db:Database,actor:Actor,input:WorkSave){return transaction(db,async c=>{
 await activeAccount(c,actor.id,true);const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;const hash=digest(JSON.stringify(canonical(input)));
 await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`work-save:${actor.id}:${input.requestId}`]);
 const prior=(await c.query('SELECT * FROM work_save_requests WHERE actor_id=$1 AND request_id=$2',[actor.id,input.requestId])).rows[0];
 if(prior){assert(prior.payload_hash===hash,409,'REQUEST_REUSED','This request key was used for different input.');await readWork(c,actor,prior.result.id);return prior.result;}
 let result;
 if(input.contentId){
  const draft=editContentSchema.parse(input.draft);const {content}=await lockContent(c,actor,input.contentId,false,true);const provider=await writeWork(c,actor,content);
  assert(content.head_revision_id===draft.baseRevisionId&&content.draft_token===draft.baseDraftToken&&provider===input.expectedProviderId,409,'REVISION_CONFLICT','Content or operating persona changed. Your input has not been overwritten.');
  await bindWorkProvider(c,actor,content,input.providerId);const r=await appendRevision(c,actor,content,draft);result={id:content.id,revisionId:r.id,number:r.number};
 }else{const draft=createContentSchema.parse(input.draft);assert(draft.kind!=='review',400,'INVALID_KIND','Use the review editor.');result=await createContentInTransaction(c,actor,{...draft,personaId:input.providerId},true);}
 const current=(await c.query('SELECT draft_token FROM contents WHERE id=$1',[result.id])).rows[0];result={...result,draftToken:current.draft_token};
 await c.query('INSERT INTO work_save_requests(actor_id,request_id,payload_hash,result)VALUES($1,$2,$3,$4)',[actor.id,input.requestId,hash,result]);return result;
});}
