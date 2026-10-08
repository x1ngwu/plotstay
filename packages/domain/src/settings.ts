import {transaction,type Database,type Connection} from '@plotstay/database';
import {settingsSchema,initialDetailCopy,completeDetailCopy} from '@plotstay/contracts';
import {requireWorld,type Actor} from './auth.ts';
import {assert} from './errors.ts';
async function access(db:Connection,actor:Actor,s:any,manage=false){
 assert(s,404,'NOT_FOUND','Configuration not found.');
 if(s.kind==='copy')assert(actor.siteRole==='admin',403,'SITE_ADMIN_REQUIRED','Site copy requires a site administrator.');
 else if(s.kind==='persona'){
  const p=(await db.query('SELECT owner_id FROM personas WHERE id=$1',[s.entity_id])).rows[0];
  assert(actor.siteRole==='admin'||p?.owner_id===actor.id,403,'PERSONA_FORBIDDEN','Only the profile owner or site administrator can edit this shared persona.');
 }else{const world=await requireWorld(db,actor,s.world_id,manage);if(manage)assert(!world.site_blocked,403,'SITE_BLOCKED','World is restricted.');}
}
async function record(db:Connection,actor:Actor,s:any,action:string,revisionId:string,note=''){
 await db.query('INSERT INTO detail_setting_events(setting_id,actor_id,action,revision_id,note)VALUES($1,$2,$3,$4,$5)',[s.id,actor.id,action,revisionId,note]);
}
async function validate(db:Connection,kind:string,raw:unknown,publish=false){
 const body=settingsSchema(kind).parse(raw);
 const languages=(await db.query('SELECT code,required_for_publish FROM locales WHERE enabled')).rows;
 assert(Object.keys(body).every(l=>languages.some(row=>row.code===l)),400,'INVALID_LOCALE','Language is not enabled.');
 if(publish)assert(languages.filter(l=>l.required_for_publish).every(l=>body[l.code]),409,'TRANSLATIONS_REQUIRED','Complete required languages before publication.');
 return body;
}
// Public projection changes only within the publication transaction. Histories stay immutable.
async function project(db:Connection,s:any,body:any){
 if(s.kind==='world')await db.query('UPDATE worlds SET translations=$2 WHERE id=$1',[s.entity_id,body]);
 if(s.kind==='place')await db.query('UPDATE places SET names=$2 WHERE id=$1',[s.entity_id,body]);
 if(s.kind==='persona')await db.query('UPDATE personas SET profiles=$2 WHERE id=$1',[s.entity_id,body]);
}
export async function listSettings(db:Connection,actor:Actor,worldId:string){
 await requireWorld(db,actor,worldId);
 return (await db.query(`SELECT s.*,CASE WHEN s.kind='world' THEN w.slug WHEN s.kind='place' THEN pl.slug WHEN s.kind='persona' THEN coalesce(p.profiles->'en'->>'name',s.entity_id::text) ELSE 'Detail interface copy' END AS name
 FROM detail_settings s LEFT JOIN worlds w ON w.id=s.entity_id LEFT JOIN places pl ON pl.id=s.entity_id LEFT JOIN personas p ON p.id=s.entity_id
 WHERE s.world_id=$1 OR (s.kind='copy' AND $2) OR (s.kind='persona' AND ($2 OR p.owner_id=$3)) ORDER BY s.kind,name`,[worldId,actor.siteRole==='admin',actor.id])).rows;
}
export async function settingDetail(db:Connection,actor:Actor,id:string){
 const s=(await db.query('SELECT * FROM detail_settings WHERE id=$1',[id])).rows[0];await access(db,actor,s);
 const revisions=(await db.query('SELECT * FROM detail_setting_revisions WHERE setting_id=$1 ORDER BY created_at DESC,id DESC',[id])).rows;
 const publications=(await db.query('SELECT * FROM detail_setting_publications WHERE setting_id=$1 ORDER BY published_at DESC,id DESC',[id])).rows;
 const events=(await db.query('SELECT * FROM detail_setting_events WHERE setting_id=$1 ORDER BY created_at DESC,id DESC',[id])).rows;
 const impacts=s.kind==='copy'?[]:(await db.query(`SELECT c.id,c.kind,c.slug,w.slug AS world FROM contents c JOIN worlds w ON w.id=c.world_id WHERE (( $1='world' AND c.world_id=$2) OR ($1='place' AND c.place_id=$2) OR ($1='persona' AND c.persona_id=$2)) AND ($3 OR w.owner_id=$4 OR EXISTS(SELECT 1 FROM world_members m WHERE m.world_id=w.id AND m.user_id=$4)) ORDER BY c.kind,c.slug`,[s.kind,s.entity_id,actor.siteRole==='admin',actor.id])).rows;
 let canReview=true;try{await access(db,actor,s,true);}catch{canReview=false;}
 return {setting:s,revisions,publications,events,impacts,canReview};
}
export function saveSetting(db:Database,actor:Actor,id:string,raw:unknown,baseRevisionId:string){return transaction(db,async client=>{
 const s=(await client.query('SELECT * FROM detail_settings WHERE id=$1 FOR UPDATE',[id])).rows[0];await access(client,actor,s);
 assert(s.head_revision_id===baseRevisionId,409,'REVISION_CONFLICT','Configuration changed. Your input is preserved.');
 const body=await validate(client,s.kind,raw);
 const r=(await client.query('INSERT INTO detail_setting_revisions(setting_id,body,created_by)VALUES($1,$2,$3)RETURNING id',[id,body,actor.id])).rows[0];
 await client.query('UPDATE detail_settings SET head_revision_id=$2,submitted_revision_id=NULL WHERE id=$1',[id,r.id]);await record(client,actor,s,'draft_saved',r.id);return {revisionId:r.id};
});}
export function settingAction(db:Database,actor:Actor,id:string,action:'submit'|'publish'|'reject'|'restore',revisionId:string,publicationId?:string){return transaction(db,async client=>{
 const s=(await client.query('SELECT * FROM detail_settings WHERE id=$1 FOR UPDATE',[id])).rows[0];await access(client,actor,s,action!=='submit');
 assert(s.head_revision_id===revisionId,409,'REVISION_CONFLICT','Configuration changed. Reload before reviewing.');
 if(action==='submit'){await client.query('UPDATE detail_settings SET submitted_revision_id=$2 WHERE id=$1',[id,revisionId]);await record(client,actor,s,'submitted',revisionId);return {submitted:true};}
 if(action==='reject'){assert(s.submitted_revision_id===revisionId,409,'NOT_SUBMITTED','Submit the current revision.');await client.query('UPDATE detail_settings SET submitted_revision_id=NULL WHERE id=$1',[id]);await record(client,actor,s,'rejected',revisionId);return {rejected:true};}
 let target=revisionId;
 if(action==='restore'){
  const old=(await client.query('SELECT revision_id FROM detail_setting_publications WHERE id=$1 AND setting_id=$2',[publicationId,id])).rows[0];assert(old,404,'NOT_FOUND','Publication not found.');target=old.revision_id;
 }else assert(s.submitted_revision_id===revisionId,409,'NOT_SUBMITTED','Submit the current revision.');
 const r=(await client.query('SELECT body FROM detail_setting_revisions WHERE id=$1 AND setting_id=$2',[target,id])).rows[0];
 const body=await validate(client,s.kind,s.kind==='copy'&&action==='restore'?completeDetailCopy(r.body):r.body,true);await project(client,s,body);
 const p=(await client.query('INSERT INTO detail_setting_publications(setting_id,revision_id,published_by,restored_from)VALUES($1,$2,$3,$4)RETURNING id',[id,target,actor.id,publicationId??null])).rows[0];
 await client.query('UPDATE detail_settings SET published_id=$2 WHERE id=$1',[id,p.id]);await record(client,actor,s,action==='restore'?'restored':'published',target,p.id);return {publicationId:p.id};
});}
export async function publicDetailCopy(db:Connection){
 const r=(await db.query(`SELECT r.body FROM detail_settings s JOIN detail_setting_publications p ON p.id=s.published_id JOIN detail_setting_revisions r ON r.id=p.revision_id WHERE s.kind='copy'`)).rows[0];
 return r?completeDetailCopy(r.body):initialDetailCopy();
}
// Explicit, idempotent bootstrap; never called at application startup. Dry-run makes no writes.
export async function initializeSettings(db:Database,actor:Actor,apply=false){
 assert(actor.siteRole==='admin',403,'SITE_ADMIN_REQUIRED','Initialization requires a site administrator.');
 return transaction(db,async client=>{
  await client.query("SELECT pg_advisory_xact_lock(hashtext('plotstay-detail-settings-init'))");
  const entries:any[]=[{kind:'copy',entity_id:null,world_id:null,body:initialDetailCopy()}];
  for(const w of (await client.query('SELECT id,translations FROM worlds')).rows)entries.push({kind:'world',entity_id:w.id,world_id:w.id,body:w.translations});
  for(const p of (await client.query('SELECT id,world_id,names FROM places')).rows)entries.push({kind:'place',entity_id:p.id,world_id:p.world_id,body:p.names});
  for(const p of (await client.query('SELECT id,profiles FROM personas')).rows)entries.push({kind:'persona',entity_id:p.id,world_id:null,body:p.profiles});
  const result=[];
  for(const e of entries){
   if((await client.query('SELECT id FROM detail_settings WHERE kind=$1 AND entity_id IS NOT DISTINCT FROM $2',[e.kind,e.entity_id])).rowCount)continue;
   result.push({kind:e.kind,entityId:e.entity_id});if(!apply)continue;
   const s=(await client.query('INSERT INTO detail_settings(kind,entity_id,world_id)VALUES($1,$2,$3)RETURNING *',[e.kind,e.entity_id,e.world_id])).rows[0];
   const r=(await client.query('INSERT INTO detail_setting_revisions(setting_id,body,created_by)VALUES($1,$2,$3)RETURNING id',[s.id,e.body,actor.id])).rows[0];
   const p=(await client.query('INSERT INTO detail_setting_publications(setting_id,revision_id,published_by)VALUES($1,$2,$3)RETURNING id',[s.id,r.id,actor.id])).rows[0];
   await client.query('UPDATE detail_settings SET head_revision_id=$2,published_id=$3 WHERE id=$1',[s.id,r.id,p.id]);await record(client,actor,s,'initialized_from_existing',r.id,'Phase 5.5: original public values preserved');
  }return {apply,missing:result};
 });
}
