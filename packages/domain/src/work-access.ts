import {transaction,type Connection,type Database,type PoolClient} from '@plotstay/database';
import {requireWorld,type Actor} from './auth.ts';
import {assert} from './errors.ts';
export const isWork=(c:any)=>['stay','service','experience'].includes(c.kind);
export async function workOwner(db:Connection,id:string){return (await db.query('SELECT owner_id FROM work_ownership WHERE content_id=$1',[id])).rows[0]?.owner_id as string|undefined;}
export async function activeAccount(db:Connection,id:string,lock=false){assert((await db.query('SELECT id FROM users WHERE id=$1 AND active'+(lock?' FOR SHARE':''),[id])).rowCount,403,'ACCOUNT_UNAVAILABLE','This account is not active.');}
export async function qualification(db:Connection,worldId:string,userId:string,lock=false){
 if(lock)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`work-access:${worldId}:${userId}`]);
 return (await db.query(`SELECT e.status,e.epoch,coalesce(p.joined,false) AS joined FROM (SELECT $1::uuid AS world_id,$2::uuid AS user_id) x
 LEFT JOIN work_eligibilities e USING(world_id,user_id) LEFT JOIN world_participations p USING(world_id,user_id)`,[worldId,userId])).rows[0];
}
export async function setWorkAccess(db:Database,actor:Actor,worldId:string,userId:string,action:'join'|'leave'|'approve'|'revoke'){
 return transaction(db,async c=>{
  await requireWorld(c,actor,worldId,true);await activeAccount(c,actor.id,true);await activeAccount(c,userId,true);
  const current=await qualification(c,worldId,userId,true);
  if(action==='join'||action==='leave')await c.query(`INSERT INTO world_participations(world_id,user_id,joined,recorded_by) VALUES($1,$2,$3,$4)
   ON CONFLICT(world_id,user_id) DO UPDATE SET joined=excluded.joined,recorded_by=excluded.recorded_by,updated_at=now()`,[worldId,userId,action==='join',actor.id]);
  if(action==='approve')assert(current.joined,409,'WORLD_JOIN_REQUIRED','The account must first join this world.');
  if(['approve','revoke','leave'].includes(action))await c.query(`INSERT INTO work_eligibilities(world_id,user_id,status,updated_by)VALUES($1,$2,$3,$4)
   ON CONFLICT(world_id,user_id) DO UPDATE SET status=excluded.status,epoch=work_eligibilities.epoch+CASE WHEN work_eligibilities.status=excluded.status THEN 0 ELSE 1 END,updated_by=excluded.updated_by,updated_at=now()`,[worldId,userId,action==='approve'?'approved':'revoked',actor.id]);
  await c.query('INSERT INTO work_access_events(world_id,user_id,actor_id,action)VALUES($1,$2,$3,$4)',[worldId,userId,actor.id,action]);return{updated:true};
 });
}
export async function prepareWork(db:Connection,actor:Actor,worldId:string){
 await activeAccount(db,actor.id,true);
 const w=(await db.query(`SELECT w.*,m.role FROM worlds w LEFT JOIN world_members m ON m.world_id=w.id AND m.user_id=$2 WHERE w.id=$1 FOR SHARE OF w`,[worldId,actor.id])).rows[0];
 assert(w&&!w.site_blocked&&(w.visible||actor.siteRole==='admin'||w.owner_id===actor.id||w.role),403,'WORLD_FORBIDDEN','This world is not available for drafting.');
 const q=await qualification(db,worldId,actor.id,true);assert(q.status!=='revoked',403,'ELIGIBILITY_REVOKED','Your operating eligibility was revoked.');return w;
}
export async function readWork(db:Connection,actor:Actor,id:string){
 await activeAccount(db,actor.id);const c=(await db.query("SELECT * FROM contents WHERE id=$1 AND kind IN ('stay','service','experience')",[id])).rows[0];assert(c,404,'NOT_FOUND','Content not found.');
 const owner=await workOwner(db,id);if(owner!==actor.id)await requireWorld(db,actor,c.world_id);return{...c,owner_id:owner??null};
}
export async function writeWork(db:Connection,actor:Actor,c:any){
 if(!isWork(c))return;
 await activeAccount(db,actor.id,true);const owner=await workOwner(db,c.id);
 assert(owner,409,'OWNERSHIP_REVIEW_REQUIRED','Historical ownership needs verification before editing.');
 await activeAccount(db,owner,true);const q=await qualification(db,c.world_id,owner,true);
 assert(q.status!=='revoked',403,'ELIGIBILITY_REVOKED','Operating eligibility was revoked.');
 const w=(await db.query('SELECT * FROM worlds WHERE id=$1 FOR SHARE',[c.world_id])).rows[0];
 assert(w&&w.visible&&!w.site_blocked&&!c.site_blocked,403,'SITE_BLOCKED','This content is restricted.');
 if(owner!==actor.id)await requireWorld(db,actor,c.world_id);
 const binding=(await db.query('SELECT persona_id FROM provider_bindings WHERE content_id=$1',[c.id])).rows[0];
 assert(binding,409,'PROVIDER_REVIEW_REQUIRED','The operating persona needs verification.');return binding.persona_id as string;
}
export async function selectableProvider(db:Connection,actor:Actor,id:string){
 const p=(await db.query('SELECT * FROM personas WHERE id=$1 FOR SHARE',[id])).rows[0];
 const saved=p&&(Object.keys(p.profiles??{}).length||(await db.query("SELECT 1 FROM detail_settings WHERE kind='persona' AND entity_id=$1 AND head_revision_id IS NOT NULL",[id])).rowCount);
 assert(p&&p.owner_id===actor.id&&!p.disabled&&saved,403,'PERSONA_FORBIDDEN','Choose your own saved, enabled persona.');return p;
}
export async function bindWorkProvider(c:PoolClient,actor:Actor,content:any,personaId:string){
 const old=(await c.query('SELECT persona_id FROM provider_bindings WHERE content_id=$1',[content.id])).rows[0];
 if(old?.persona_id===personaId)return{changed:false};
 assert(!(await c.query('SELECT 1 FROM work_provider_locks WHERE content_id=$1',[content.id])).rowCount,409,'PROVIDER_LOCKED','The persona was permanently locked by a successful submission or publication.');
 assert(await workOwner(c,content.id)===actor.id,403,'PROVIDER_FORBIDDEN','Only the owner may change the operating persona.');
 await selectableProvider(c,actor,personaId);
 await c.query(`INSERT INTO provider_bindings(content_id,persona_id,assigned_by)VALUES($1,$2,$3) ON CONFLICT(content_id)DO UPDATE SET persona_id=excluded.persona_id,assigned_by=excluded.assigned_by,assigned_at=now()`,[content.id,personaId,actor.id]);
 await c.query('INSERT INTO provider_binding_events(content_id,persona_id,actor_id)VALUES($1,$2,$3)',[content.id,personaId,actor.id]);
 await c.query("INSERT INTO moderation_events(content_id,world_id,actor_id,action)VALUES($1,$2,$3,'provider_saved')",[content.id,content.world_id,actor.id]);
 await c.query('UPDATE contents SET draft_token=gen_random_uuid() WHERE id=$1',[content.id]);return{changed:true};
}
export async function formalWork(db:PoolClient,actor:Actor,c:any,revisionId?:string,requireSubmission=false){
 if(!isWork(c))return;
 const providerId=await writeWork(db,actor,c);const owner=(await workOwner(db,c.id))!;
 const q=await qualification(db,c.world_id,owner,true);
 assert(q.joined&&q.status==='approved',403,'ELIGIBILITY_REQUIRED','Approved operating eligibility in this world is required.');
 const p=(await db.query('SELECT * FROM personas WHERE id=$1 FOR SHARE',[providerId])).rows[0];
 assert(p?.approved&&!p.disabled,403,'PROVIDER_UNAVAILABLE','The operating persona must have approved, enabled profile data.');
 if(requireSubmission){const s=(await db.query('SELECT epoch FROM work_submission_eligibilities WHERE content_id=$1 AND revision_id=$2',[c.id,revisionId])).rows[0];assert(s?.epoch===q.epoch,409,'SUBMISSION_EXPIRED','Eligibility changed. The owner must submit again.');}
 return q.epoch as number;
}
