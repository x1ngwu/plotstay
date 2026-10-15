import type {FastifyInstance} from 'fastify';
import {transaction,type Database} from '@plotstay/database';
import {z} from 'zod';
import {idSchema,localeSchema,createContentSchema,editContentSchema} from '@plotstay/contracts';
import {getActor,assert,submitRevision,previewDetail,retryTranslation} from '@plotstay/domain';
import {listWorks,workOptions,workDetail,saveWork,workEditorOptions} from '../../../packages/domain/src/works.ts';
import {setWorkAccess} from '../../../packages/domain/src/work-access.ts';
const params=z.object({id:idSchema});
const scope=z.enum(['mine','managed']).default('mine');
export function worksRoutes(app:FastifyInstance,db:Database){
 const actor=async(token?:string)=>{const a=await getActor(db,token);assert(a,401,'SESSION_REQUIRED','Sign in to continue.');return a;};
 app.get('/api/me/works',async r=>{
  const csv=(values:readonly[string,...string[]])=>z.string().transform(s=>s?s.split(','):[]).pipe(z.array(z.enum(values)).max(values.length)).optional();
  const q=z.object({scope,world:idSchema.optional(),persona:idSchema.optional(),kind:z.enum(['stay','service','experience']).optional(),q:z.string().trim().max(200).optional(),visibility:csv(['public','private']),state:csv(['draft','new','submitted','rejected','same','unpublished','restricted','repair']),page:z.coerce.number().int().min(1).max(100000).default(1),locale:localeSchema.default('en')}).strict().parse(r.query);
  return listWorks(db,await actor(r.cookies.plotstay_session),q);
 });
 for(const [route,creating]of [['filter-options',false],['create-options',true]] as const)app.get('/api/me/works/'+route,async r=>{const q=z.object({scope}).strict().parse(r.query);return workOptions(db,await actor(r.cookies.plotstay_session),creating,q);});
 app.get('/api/me/works/:id',async r=>{const a=await actor(r.cookies.plotstay_session),id=params.parse(r.params).id;return transaction(db,async c=>{await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return workDetail(c,a,id);});});
 app.get('/api/me/works/editor-options',async r=>{const q=z.object({world:idSchema,content:idSchema.optional()}).strict().parse(r.query);return workEditorOptions(db,await actor(r.cookies.plotstay_session),q.world,q.content);});
 const writingActor=async(r:any)=>{const a=await actor(r.cookies.plotstay_session);assert(r.headers['x-plotstay-actor']===a.id,409,'ACCOUNT_CHANGED','The account changed. Reopen the workspace before saving.');return a;};
 app.post('/api/me/works/save',async r=>{
  const b=z.object({requestId:idSchema,contentId:idSchema.optional(),providerId:idSchema,expectedProviderId:idSchema.optional(),draft:z.union([createContentSchema,editContentSchema])}).strict().parse(r.body);
  return saveWork(db,await writingActor(r),b);
 });
 app.post('/api/me/works/:id/submit',async r=>{const b=z.object({revisionId:idSchema,draftToken:idSchema}).strict().parse(r.body);return submitRevision(db,await writingActor(r),params.parse(r.params).id,b.revisionId,b.draftToken,true);});
 app.post('/api/me/works/:id/translation-jobs/:jobId/retry',async r=>{const p=z.object({id:idSchema,jobId:idSchema}).parse(r.params);z.object({}).strict().parse(r.body);return retryTranslation(db,await writingActor(r),p.jobId,p.id);});
 app.get('/api/me/works/:id/preview',async r=>{const q=z.object({revisionId:idSchema,token:idSchema,locale:localeSchema}).strict().parse(r.query);return previewDetail(db,await actor(r.cookies.plotstay_session),params.parse(r.params).id,q.revisionId,q.token,q.locale,true);});
 app.post('/api/moderation/worlds/:worldId/operating-access/:userId',async r=>{const p=z.object({worldId:idSchema,userId:idSchema}).parse(r.params);const b=z.object({action:z.enum(['join','leave','approve','revoke'])}).strict().parse(r.body);return setWorkAccess(db,await actor(r.cookies.plotstay_session),p.worldId,p.userId,b.action);});
}
