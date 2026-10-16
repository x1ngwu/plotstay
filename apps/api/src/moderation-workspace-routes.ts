import type {FastifyInstance} from 'fastify';
import {transaction,type Database} from '@plotstay/database';
import {z} from 'zod';
import {idSchema,localeSchema} from '@plotstay/contracts';
import {getActor,assert,approvePersonaVersion,disablePersona,hashPassword} from '@plotstay/domain';
import {moderationScopes,moderationList,moderationProfile,moderationRecord,decideModeration,moderationBindings,saveModerationBinding} from '../../../packages/domain/src/moderation-workspace.ts';
export function moderationWorkspaceRoutes(app:FastifyInstance,db:Database){
 const actor=async(r:any)=>{const a=await getActor(db,r.cookies.plotstay_session);assert(a,401,'SESSION_REQUIRED','Sign in to continue.');if(r.method!=='GET'||r.headers['x-plotstay-actor'])assert(r.headers['x-plotstay-actor']===a.id,409,'ACCOUNT_CHANGED','The account changed. Reopen the workspace.');return a;};
 const site=(a:any)=>assert(a.siteRole==='admin',403,'SITE_ADMIN_REQUIRED','Site administrator access required.');
 const params=z.object({kind:z.enum(['reviews','replies']),id:idSchema});
 const id=(r:any)=>z.object({id:idSchema}).parse(r.params).id;
 app.get('/api/moderation-workspace/scopes',async r=>moderationScopes(db,await actor(r)));
 app.get('/api/moderation-workspace/queue',async r=>{
  const q=z.object({kind:z.enum(['reviews','replies','profiles']),world:idSchema.optional(),locale:localeSchema.default('en'),status:z.enum(['pending','approved','rejected','published','hidden','expired','all']).default('pending'),enabled:z.enum(['all','enabled','disabled']).default('all'),q:z.string().trim().max(200).default(''),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().parse(r.query);
  return moderationList(db,await actor(r),q);
 });
 app.get('/api/moderation-workspace/profiles/:id',async r=>{const a=await actor(r);return transaction(db,async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return moderationProfile(c,a,id(r));});});
 app.post('/api/moderation-workspace/profiles/:id',async r=>{const b=z.object({decision:z.enum(['approved','rejected']),note:z.string().trim().max(2000).default('')}).strict().parse(r.body);const a=await actor(r);site(a);await transaction(db,async c=>{const profile=(await c.query("SELECT s.entity_id,s.id FROM detail_setting_revisions r JOIN detail_settings s ON s.id=r.setting_id WHERE r.id=$1 AND s.kind='persona'",[id(r)])).rows[0];assert(profile,404,'NOT_FOUND','Profile not found.');await c.query('SELECT id FROM personas WHERE id=$1 FOR UPDATE',[profile.entity_id]);const current=(await c.query('SELECT submitted_revision_id FROM detail_settings WHERE id=$1 FOR UPDATE',[profile.id])).rows[0];assert(current.submitted_revision_id===id(r),409,'SUBMISSION_SUPERSEDED','This submission was replaced or handled.');await approvePersonaVersion(c,a,id(r),b.decision,b.note);});return {saved:true,revisionId:id(r),decision:b.decision};});
 app.post('/api/moderation-workspace/personas/:id/availability',async r=>{const b=z.object({disabled:z.boolean(),expectedDisabled:z.boolean()}).strict().parse(r.body);return disablePersona(db,await actor(r),id(r),b.disabled,b.expectedDisabled);});
 app.get('/api/moderation-workspace/records/:kind/:id',async r=>{const p=params.parse(r.params);return moderationRecord(db,await actor(r),p.kind,p.id);});
 app.post('/api/moderation-workspace/records/:kind/:id',async r=>{
  const p=params.parse(r.params);const b=z.object({action:z.enum(['publish','reject','hide','restore']),revisionId:idSchema.nullable(),submissionToken:idSchema.nullable(),headId:idSchema,publicationId:idSchema.nullable(),hidden:z.boolean(),accessEpoch:z.number().int().nullable(),restoreId:idSchema.optional(),approvePersonaRevisionId:idSchema.optional(),note:z.string().trim().max(2000).default('')}).strict().parse(r.body);
  return decideModeration(db,await actor(r),p.kind,p.id,b);
 });
 app.get('/api/moderation-workspace/providers/:id',async r=>moderationBindings(db,await actor(r),id(r)));
 app.put('/api/moderation-workspace/providers/:id',async r=>{const b=z.object({personaId:idSchema,expectedPersonaId:idSchema,token:idSchema}).strict().parse(r.body);return saveModerationBinding(db,await actor(r),id(r),b.personaId,b.expectedPersonaId,b.token);});
 // An exact command ID permits read-back after a lost response without a user list,
 // a second credential write, a password cache, or a new idempotency table.
 app.post('/api/moderation-workspace/accounts',async r=>{
  const a=await actor(r);site(a);const b=z.object({requestId:idSchema,email:z.email().max(254),password:z.string().min(12).max(200)}).strict().parse(r.body);
  const hash=await hashPassword(b.password);
  return transaction(db,async c=>{
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ordinary-account:${b.requestId}`]);
   const existing=(await c.query('SELECT id,email,site_role FROM users WHERE id=$1',[b.requestId])).rows[0];
   if(existing){assert(existing.email===b.email.toLowerCase()&&existing.site_role==='user',409,'REVISION_CONFLICT','This request identifier has already been used.');return existing;}
   return (await c.query("INSERT INTO users(id,email,password_hash)VALUES($1,$2,$3)RETURNING id,email,site_role",[b.requestId,b.email.toLowerCase(),hash])).rows[0];
  });
 });
 app.get('/api/moderation-workspace/accounts/:id',async r=>{site(await actor(r));const q=z.object({email:z.email().max(254)}).strict().parse(r.query);const result=(await db.query("SELECT id,email,site_role FROM users WHERE id=$1 AND email=$2 AND site_role='user'",[id(r),q.email.toLowerCase()])).rows[0];return {confirmed:Boolean(result),account:result??null};});
}
