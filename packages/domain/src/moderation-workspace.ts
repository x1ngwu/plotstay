import {transaction,type Database,type Connection} from '@plotstay/database';
import {requireWorld,type Actor} from './auth.ts';
import {assert} from './errors.ts';
import {adminWorlds,getPublished} from './read.ts';
import {reviewDetail,replyDetail,replyActionInTransaction,approvePersonaVersion,signatureProfiles} from './persona-reviews.ts';
import {reviewRevisionInTransaction,restorePublicationInTransaction,unpublishContentInTransaction} from './content.ts';
import {effectiveReplySubmission} from './reply-access.ts';
import {bindWorkProvider,writeWork} from './work-access.ts';

export type ModerationKind='reviews'|'replies'|'profiles';
export interface ModerationQuery {kind:ModerationKind;world?:string;locale:string;status:string;enabled:string;q:string;page:number}
const site=(a:Actor)=>assert(a.siteRole==='admin',403,'SITE_ADMIN_REQUIRED','Site administrator access is required.');
export async function moderationScopes(db:Connection,actor:Actor){
 const worlds=(await adminWorlds(db,actor)).filter(w=>actor.siteRole==='admin'||['owner','admin'].includes(w.role));
 assert(actor.siteRole==='admin'||worlds.length,403,'REVIEW_FORBIDDEN','World moderation access is required.');
 const pendingProfiles=actor.siteRole==='admin'?(await db.query("SELECT count(*)::int n FROM detail_settings s LEFT JOIN persona_revision_decisions d ON d.revision_id=s.submitted_revision_id WHERE s.kind='persona' AND s.submitted_revision_id IS NOT NULL AND d.revision_id IS NULL")).rows[0].n:null;
 return {actor,worlds,pendingProfiles};
}
const recordsSQL=`WITH authorized AS MATERIALIZED (
 SELECT c.*,w.slug AS world_slug,w.translations AS world_names,w.visible AS world_visible,w.site_blocked AS world_blocked,parent.site_blocked AS entry_blocked,parent.published_publication_id AS entry_publication,parent.slug AS entry_slug,parent.kind AS entry_kind,
 coalesce(pr.source_text->>'title',parent.slug) AS entry_title
 FROM contents c JOIN worlds w ON w.id=c.world_id JOIN contents parent ON parent.id=c.parent_content_id
 LEFT JOIN content_revisions pr ON pr.id=parent.head_revision_id
 WHERE c.kind='review' AND ($2 OR w.owner_id=$1 OR EXISTS(SELECT 1 FROM world_members m WHERE m.world_id=w.id AND m.user_id=$1 AND m.role IN ('owner','admin')))
 AND ($3::uuid IS NULL OR w.id=$3)
), records AS (
 SELECT 'reviews'::text AS kind,c.id,c.id AS object_id,c.world_id,c.world_slug,c.world_names,c.entry_slug,c.entry_title,c.entry_kind,
 r.id AS revision_id,r.number::text AS version,r.source_locale,
 r.source_text AS source_text,sig.profiles,sig.persona_revision_id,c.persona_id,u.email AS author,
 CASE WHEN c.submitted_revision_id IS NOT NULL THEN 'pending' WHEN r.status='rejected' THEN 'rejected' ELSE 'approved' END AS status,
 c.published_publication_id IS NOT NULL AND c.world_visible AND NOT c.world_blocked AND NOT c.site_blocked AND NOT c.entry_blocked AND c.entry_publication IS NOT NULL AS published,EXISTS(SELECT 1 FROM publications WHERE content_id=c.id) AS has_history,c.published_publication_id IS NOT NULL AS active_publication,
 coalesce(sub.created_at,pub.published_at,r.created_at) AS at,
 CASE WHEN r.id=c.submitted_revision_id THEN coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM review_submission_locales l JOIN translations t ON t.id=l.translation_id WHERE l.submission_id=c.submission_token),'{}')
 WHEN r.id=pub.revision_id THEN coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM publication_locales l JOIN translations t ON t.id=l.translation_id WHERE l.publication_id=pub.id),'{}')
 ELSE coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM review_submission_locales l JOIN translations t ON t.id=l.translation_id WHERE l.submission_id=sub.id),'{}') END AS texts
 FROM authorized c LEFT JOIN publications pub ON pub.id=c.published_publication_id
 LEFT JOIN LATERAL(SELECT * FROM review_submissions WHERE content_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1)sub ON true
 JOIN content_revisions r ON r.id=coalesce(c.submitted_revision_id,sub.revision_id,pub.revision_id)
 LEFT JOIN review_signatures sig ON sig.revision_id=r.id JOIN users u ON u.id=c.author_id
 UNION ALL
 SELECT 'replies',c.id,q.id,c.world_id,c.world_slug,c.world_names,c.entry_slug,c.entry_title,c.entry_kind,
 r.id,(SELECT count(*) FROM reply_revisions nr WHERE nr.reply_id=q.id AND (nr.created_at,nr.id)<=(r.created_at,r.id))::text,r.source_locale,
 jsonb_build_object('description',r.body->>r.source_locale),r.profiles,r.persona_revision_id,r.persona_id,u.email,
 CASE WHEN ${effectiveReplySubmission('q','c')} THEN 'pending' WHEN ev.action='reject' THEN 'rejected' WHEN q.submitted_revision_id IS NOT NULL THEN 'expired' ELSE 'approved' END,
 q.published_id IS NOT NULL AND NOT q.hidden AND c.published_publication_id IS NOT NULL AND c.world_visible AND NOT c.world_blocked AND NOT c.site_blocked AND NOT c.entry_blocked AND c.entry_publication IS NOT NULL, q.published_id IS NOT NULL,q.published_id IS NOT NULL AND NOT q.hidden,coalesce(ev.created_at,r.created_at),
 (SELECT jsonb_object_agg(key,jsonb_build_object('description',value)) FROM jsonb_each_text(r.body))
 FROM authorized c JOIN review_replies q ON q.review_id=c.id
 LEFT JOIN reply_publications pub ON pub.id=q.published_id
 LEFT JOIN LATERAL(SELECT * FROM reply_events WHERE reply_id=q.id AND action IN ('submit','publish','reject') ORDER BY created_at DESC,(action='submit') ASC,id DESC LIMIT 1)ev ON true
 JOIN reply_revisions r ON r.id=coalesce(q.submitted_revision_id,ev.revision_id,pub.revision_id)
 JOIN users u ON u.id=r.created_by
)`;
export async function moderationList(db:Connection,actor:Actor,q:ModerationQuery){
 await moderationScopes(db,actor);if(q.world)await requireWorld(db,actor,q.world,true);
 if(q.kind==='profiles')return profileList(db,actor,q);
 const {rows:[result]}=await db.query(`${recordsSQL}, matching AS MATERIALIZED (
 SELECT * FROM records WHERE kind=$4 AND ($5='all' OR status=$5 OR $5='published' AND published OR $5='hidden' AND has_history AND NOT published)
 AND ($6='' OR concat_ws(' ',entry_title,entry_slug,author,profiles::text,texts::text,source_text::text) ILIKE $6 ESCAPE '\\')
 ), stats AS(SELECT count(*)::int AS total,greatest(1,ceil(count(*)/20.0)::int) AS pages FROM matching), paging AS(SELECT *,least($7,pages) AS page FROM stats)
 SELECT total,pages,page,20 AS "pageSize",
 (SELECT count(*)::int FROM records WHERE kind='reviews' AND status='pending') AS "pendingReviews",
 (SELECT count(*)::int FROM records WHERE kind='replies' AND status='pending') AS "pendingReplies",
 coalesce((SELECT jsonb_agg(x ORDER BY at DESC,object_id) FROM(SELECT * FROM matching ORDER BY at DESC,object_id LIMIT 20 OFFSET ((SELECT page FROM paging)-1)*20)x),'[]') AS items FROM paging`,
 [actor.id,actor.siteRole==='admin',q.world??null,q.kind,q.status,q.q?`%${q.q.replace(/[\\%_]/g,'\\$&')}%`:'',q.page]);
 return result;
}
async function profileList(db:Connection,actor:Actor,q:ModerationQuery){
 site(actor);
 const {rows:[result]}=await db.query(`WITH records AS MATERIALIZED (
 SELECT p.id,p.id AS persona_id,p.disabled,u.email AS author,r.id AS revision_id,r.body AS profiles,r.created_at AS at,
 coalesce(d.decision,'pending') AS status,s.published_id IS NOT NULL AS has_approved,
 (SELECT count(*)::int FROM detail_setting_revisions nr WHERE nr.setting_id=s.id AND (nr.created_at,nr.id)<=(r.created_at,r.id)) AS version
 FROM personas p JOIN users u ON u.id=p.owner_id JOIN detail_settings s ON s.kind='persona' AND s.entity_id=p.id
 LEFT JOIN LATERAL(SELECT revision_id FROM detail_setting_events WHERE setting_id=s.id AND action IN ('submitted','approved','rejected') ORDER BY created_at DESC,id DESC LIMIT 1)e ON true
 JOIN detail_setting_revisions r ON r.id=coalesce(s.submitted_revision_id,e.revision_id)
 LEFT JOIN persona_revision_decisions d ON d.revision_id=r.id
 ), matching AS MATERIALIZED(SELECT * FROM records WHERE ($1='all' OR status=$1) AND ($2='all' OR disabled=($2='disabled')) AND ($3='' OR concat_ws(' ',author,profiles::text) ILIKE $3 ESCAPE '\\')),
 stats AS(SELECT count(*)::int AS total,greatest(1,ceil(count(*)/20.0)::int) AS pages FROM matching),paging AS(SELECT *,least($4,pages) AS page FROM stats)
 SELECT total,pages,page,20 AS "pageSize",(SELECT count(*)::int FROM records WHERE status='pending') AS "pendingProfiles",
 coalesce((SELECT jsonb_agg(x ORDER BY at DESC,id) FROM(SELECT * FROM matching ORDER BY at DESC,id LIMIT 20 OFFSET((SELECT page FROM paging)-1)*20)x),'[]') AS items FROM paging`,[q.status,q.enabled,q.q?`%${q.q.replace(/[\\%_]/g,'\\$&')}%`:'',q.page]);
 return result;
}
async function profileReference(db:Connection,id:string|undefined){
 if(!id)return null;
 return (await db.query(`SELECT r.id,r.setting_id,s.entity_id AS persona_id,r.body,r.created_at,p.disabled,u.email AS owner,
 s.submitted_revision_id,d.decision,(s.submitted_revision_id=r.id AND d.revision_id IS NULL) AS current,
 (SELECT count(*)::int FROM detail_setting_revisions nr WHERE nr.setting_id=s.id AND (nr.created_at,nr.id)<=(r.created_at,r.id)) AS number
 FROM detail_setting_revisions r JOIN detail_settings s ON s.id=r.setting_id AND s.kind='persona' JOIN personas p ON p.id=s.entity_id JOIN users u ON u.id=p.owner_id
 LEFT JOIN persona_revision_decisions d ON d.revision_id=r.id WHERE r.id=$1`,[id])).rows[0]??null;
}
export async function moderationProfile(db:Connection,actor:Actor,id:string){
 site(actor);const fixed=await profileReference(db,id);assert(fixed,404,'NOT_FOUND','Profile submission not found.');
 const approved=(await db.query(`SELECT r.id,r.body,r.created_at FROM detail_settings s JOIN detail_setting_publications p ON p.id=s.published_id JOIN detail_setting_revisions r ON r.id=p.revision_id WHERE s.id=$1`,[fixed.setting_id])).rows[0]??null;
 const events=(await db.query('SELECT e.id,e.revision_id,e.action,e.note,e.created_at,u.email AS actor FROM detail_setting_events e JOIN users u ON u.id=e.actor_id WHERE e.setting_id=$1 ORDER BY e.created_at DESC,e.id DESC',[fixed.setting_id])).rows;
 const related=(await db.query(`SELECT 'reviews' AS kind,c.id,r.source_text->>'title' AS title,w.slug AS world,parent.slug AS entry FROM contents c JOIN content_revisions r ON r.id=c.submitted_revision_id JOIN review_signatures s ON s.revision_id=r.id JOIN worlds w ON w.id=c.world_id JOIN contents parent ON parent.id=c.parent_content_id WHERE s.persona_revision_id=$1
 UNION ALL SELECT 'replies',c.id,r.body->>r.source_locale,w.slug,parent.slug FROM review_replies q JOIN contents c ON c.id=q.review_id JOIN worlds w ON w.id=c.world_id JOIN contents parent ON parent.id=c.parent_content_id JOIN reply_revisions r ON r.id=q.submitted_revision_id WHERE r.persona_revision_id=$1 AND ${effectiveReplySubmission('q','c')}`,[id])).rows;
 return {kind:'profiles',id,fixed:{...fixed,body:signatureProfiles(fixed.body)},approved:approved?{...approved,body:signatureProfiles(approved.body)}:null,events,related,canDecide:fixed.current,disabled:fixed.disabled};
}
export function moderationRecord(db:Database,actor:Actor,kind:'reviews'|'replies',id:string){
 return transaction(db,async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const data=kind==='reviews'?await reviewDetail(c,actor,id,true):await replyDetail(c,actor,id,true);
  const review=(await c.query(`SELECT c.*,w.slug AS world_slug,w.translations AS world_names,w.site_blocked AS world_blocked,w.visible AS world_visible,parent.site_blocked AS entry_blocked,parent.published_publication_id AS entry_publication,parent.slug AS entry_slug,parent.kind AS entry_kind,pr.source_text->>'title' AS entry_title FROM contents c JOIN worlds w ON w.id=c.world_id JOIN contents parent ON parent.id=c.parent_content_id LEFT JOIN content_revisions pr ON pr.id=parent.head_revision_id WHERE c.id=$1`,[id])).rows[0];
  const object=kind==='reviews'?(data as any).content:(data as any).reply;
  assert(object,404,'NOT_FOUND','Reply not found.');
  const revisions:any[]=data.revisions;
  const ids=revisions.map(r=>r.created_by);const authors=(await c.query('SELECT id,email FROM users WHERE id=ANY($1::uuid[])',[ids])).rows;
  const version=(r:any)=>r?{...r,number:r.number??(revisions.length-revisions.findIndex(x=>x.id===r.id)),texts:kind==='reviews'?r.texts:Object.fromEntries(Object.entries(r.body).map(([l,t])=>[l,{description:t}])),author:authors.find(a=>a.id===r.created_by)?.email??r.created_by}:null;
  // Historical submissions keep their own translations, even after the revision is returned
  // and its editable locale pointers change. Publication snapshots remain separate below.
  const submissionRows=kind==='reviews'?(await c.query(`SELECT s.id,s.revision_id,s.created_at,
   coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM review_submission_locales l JOIN translations t ON t.id=l.translation_id WHERE l.submission_id=s.id),'{}') AS texts
   FROM review_submissions s WHERE s.content_id=$1 ORDER BY s.created_at DESC,s.id DESC`,[id])).rows:
   data.events.filter((e:any)=>e.action==='submit');
  const submissionHistory=submissionRows.map((s:any)=>{
   const r=version(revisions.find(r=>r.id===s.revision_id));
   if(r&&kind==='reviews')r.texts=s.texts;
   return {id:s.id,revision_id:s.revision_id,created_at:s.created_at,version:r};
  }).filter((s:any)=>s.version);
  const submitted=version(revisions.find(r=>r.id===object.submitted_revision_id));
  const head=version(revisions.find(r=>r.id===object.head_revision_id));
  const currentPublicationId=kind==='reviews'?object.published_publication_id:object.published_id;
  const publications:any[]=data.publications;
  const snapshots=await Promise.all(publications.map(async p=>{
   const r=version(revisions.find(r=>r.id===p.revision_id));
   if(kind==='reviews'&&r)r.texts=(await c.query(`SELECT coalesce(jsonb_object_agg(l.locale,t.body),'{}') AS texts FROM publication_locales l JOIN translations t ON t.id=l.translation_id WHERE l.publication_id=$1`,[p.id])).rows[0].texts;
   return {...p,version:r};
  }));
  const current=snapshots.find(p=>p.id===currentPublicationId)??null;
  const profile=await profileReference(c,submitted?.persona_revision_id);
  const context=await getPublished(c,'en',{id:kind==='reviews'?review.parent_content_id:id});
  const contextZh=await getPublished(c,'zh-CN',{id:kind==='reviews'?review.parent_content_id:id});
  let reason:string|null=null;
  if(review.site_blocked||review.world_blocked)reason='SITE_BLOCKED';
  else if(!context)reason='TARGET_UNAVAILABLE';
  else if(profile?.disabled)reason='PERSONA_DISABLED';
  else if(profile&&profile.decision!=='approved'&&(!profile.current||actor.siteRole!=='admin'))reason=profile.current?'PERSONA_APPROVAL_REQUIRED':'SUBMISSION_SUPERSEDED';
  if(kind==='replies'&&(data as any).submissionExpired)reason='SUBMISSION_EXPIRED';
  if(!reason&&submitted){const required=(await c.query('SELECT code FROM locales WHERE enabled AND required_for_publish')).rows;if(required.some(l=>!submitted.texts?.[l.code])||profile&&(!profile.body.en||!profile.body['zh-CN']))reason='TRANSLATIONS_REQUIRED';}
  const joint=Boolean(submitted&&profile?.current&&actor.siteRole==='admin');
  return {kind,id,world:{id:review.world_id,slug:review.world_slug,names:review.world_names},entry:{slug:review.entry_slug,title:review.entry_title,kind:review.entry_kind},submitted,current,head,profile,submissionHistory,context:context?{'en':context,'zh-CN':contextZh}:null,
   publications:snapshots,events:data.events,versions:revisions.map(version),hasActivePublication:Boolean(currentPublicationId&&(kind==='reviews'||!object.hidden)),published:Boolean(currentPublicationId&&(kind==='reviews'||!object.hidden)&&review.world_visible&&!review.world_blocked&&!review.site_blocked&&!review.entry_blocked&&review.entry_publication&&(kind==='reviews'||context)),joint,canPublish:Boolean(submitted&&!reason),reason,
   guard:{revisionId:submitted?.id??null,submissionToken:kind==='reviews'?object.submission_token:null,headId:object.head_revision_id,publicationId:currentPublicationId,hidden:kind==='replies'?object.hidden:false,accessEpoch:kind==='replies'?object.submitted_access_epoch:null},canReject:Boolean(submitted)};
 });
}
export interface ModerationDecision {action:'publish'|'reject'|'hide'|'restore';revisionId:string|null;submissionToken:string|null;headId:string;publicationId:string|null;hidden:boolean;accessEpoch:number|null;restoreId?:string;approvePersonaRevisionId?:string;note:string}
export function decideModeration(db:Database,actor:Actor,kind:'reviews'|'replies',id:string,b:ModerationDecision){
 return transaction(db,async c=>{
  const review=(await c.query("SELECT * FROM contents WHERE id=$1 AND kind='review'",[id])).rows[0];assert(review,404,'NOT_FOUND','Review not found.');
  await requireWorld(c,actor,review.world_id,true);
  // Same order as the existing reply service: entry, then reply. Review actions lock review.
  await c.query('SELECT id FROM contents WHERE id=$1 FOR UPDATE',[kind==='replies'?review.parent_content_id:id]);
  const object=kind==='reviews'?(await c.query('SELECT * FROM contents WHERE id=$1',[id])).rows[0]:(await c.query('SELECT * FROM review_replies WHERE review_id=$1 FOR UPDATE',[id])).rows[0];
  assert(object,404,'NOT_FOUND','Reply not found.');
  const publication=kind==='reviews'?object.published_publication_id:object.published_id;
  assert(publication===b.publicationId&&(kind==='reviews'||object.hidden===b.hidden),409,'REVISION_CONFLICT','Publication changed. Review the latest state.');
  if(b.action==='publish'||b.action==='reject'){
   assert(b.revisionId&&object.submitted_revision_id===b.revisionId&&(kind==='reviews'?object.submission_token===b.submissionToken:object.submitted_access_epoch===b.accessEpoch),409,'SUBMISSION_SUPERSEDED','The submitted version was replaced or already processed.');
   if(kind==='reviews')return reviewRevisionInTransaction(c,actor,id,b.revisionId,b.action,b.note,b.submissionToken??undefined,b.approvePersonaRevisionId);
  }
  if(kind==='replies')return replyActionInTransaction(c,actor,id,b.action,b.action==='publish'||b.action==='reject'?b.revisionId!:object.head_revision_id,b.note,b.restoreId,b.approvePersonaRevisionId);
  if(b.action==='hide'){assert(publication,409,'REVISION_CONFLICT','No current publication.');return unpublishContentInTransaction(c,actor,id,false,b.note);}
  assert(b.restoreId,400,'INVALID_INPUT','Choose a historical publication.');return restorePublicationInTransaction(c,actor,id,b.restoreId);
 });
}
export async function moderationBindings(db:Connection,actor:Actor,worldId:string){
 await requireWorld(db,actor,worldId,true);
 const entries=(await db.query(`SELECT c.id,c.kind,c.slug,c.draft_token,r.source_text->>'title' AS title,o.owner_id,u.email AS owner,u.active AS owner_active,b.persona_id,CASE WHEN p.approved THEN p.profiles ELSE coalesce(bound_revision.body,p.profiles) END AS profiles,p.disabled,
 l.content_id IS NOT NULL AS locked,c.site_blocked OR w.site_blocked OR NOT w.visible AS restricted,
 coalesce(e.status='revoked',false) AS revoked
 FROM contents c JOIN worlds w ON w.id=c.world_id LEFT JOIN content_revisions r ON r.id=c.head_revision_id LEFT JOIN work_ownership o ON o.content_id=c.id LEFT JOIN users u ON u.id=o.owner_id
 LEFT JOIN provider_bindings b ON b.content_id=c.id LEFT JOIN personas p ON p.id=b.persona_id LEFT JOIN detail_settings bound_setting ON bound_setting.kind='persona' AND bound_setting.entity_id=p.id LEFT JOIN detail_setting_revisions bound_revision ON bound_revision.id=bound_setting.head_revision_id LEFT JOIN work_provider_locks l ON l.content_id=c.id LEFT JOIN work_eligibilities e ON e.world_id=c.world_id AND e.user_id=o.owner_id
 WHERE c.world_id=$1 AND c.kind IN ('stay','experience','service') ORDER BY c.slug,c.id`,[worldId])).rows;
 const personas=(await db.query(`SELECT p.id,coalesce(r.body,p.profiles) AS profiles,u.email AS owner FROM personas p JOIN users u ON u.id=p.owner_id LEFT JOIN detail_settings s ON s.kind='persona' AND s.entity_id=p.id LEFT JOIN detail_setting_revisions r ON r.id=s.head_revision_id WHERE p.owner_id=$1 AND NOT p.disabled AND (r.id IS NOT NULL OR p.profiles<>'{}'::jsonb) ORDER BY p.created_at,p.id`,[actor.id])).rows;
 return {entries:entries.map(e=>({...e,reason:e.locked?'PROVIDER_LOCKED':!e.owner_id||!e.persona_id?'OWNERSHIP_REVIEW_REQUIRED':e.owner_id!==actor.id?'PROVIDER_FORBIDDEN':!e.owner_active?'ACCOUNT_UNAVAILABLE':e.restricted?'SITE_BLOCKED':e.revoked?'ELIGIBILITY_REVOKED':!personas.length?'NO_CANDIDATES':null})),personas};
}
export function saveModerationBinding(db:Database,actor:Actor,id:string,personaId:string,expectedPersonaId:string,token:string){
 return transaction(db,async c=>{
  const target=(await c.query("SELECT * FROM contents WHERE id=$1 AND kind IN ('stay','experience','service') FOR UPDATE",[id])).rows[0];assert(target,404,'NOT_FOUND','Entry not found.');
  await requireWorld(c,actor,target.world_id,true);await writeWork(c,actor,target);
  const old=(await c.query('SELECT persona_id FROM provider_bindings WHERE content_id=$1',[id])).rows[0];
  assert(old?.persona_id===expectedPersonaId&&target.draft_token===token,409,'PROVIDER_CHANGED','The entry or provider changed. Reload before assigning.');
  const result=await bindWorkProvider(c,actor,target,personaId);return {...result,personaId,contentId:id};
 });
}
