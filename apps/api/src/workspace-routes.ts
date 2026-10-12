import type {FastifyInstance} from 'fastify';
import type {Database} from '@plotstay/database';
import {z} from 'zod';
import {idSchema} from '@plotstay/contracts';
import {getActor,assert,workspaceOverview,workspaceWorlds} from '@plotstay/domain';
export function workspaceRoutes(app:FastifyInstance,db:Database){
 const actor=async(req:any)=>{const a=await getActor(db,req.cookies.plotstay_session);assert(a,401,'SESSION_REQUIRED','Sign in to continue.');return a;};
 const locale=z.enum(['zh-CN','en']).default('en');
 app.get('/api/me/workspace/reply-events/:id',async r=>{const a=await actor(r);const eventId=z.object({id:idSchema}).parse(r.params).id;
  const row=(await db.query(`SELECT e.id,e.created_at,r.body,r.profiles,c.id AS review_id FROM reply_events e JOIN reply_revisions r ON r.id=e.revision_id JOIN review_replies q ON q.id=e.reply_id JOIN contents c ON c.id=q.review_id JOIN contents parent ON parent.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id WHERE e.id=$1 AND e.action IN ('publish','restore') AND c.author_id=$2 AND NOT q.hidden AND c.published_publication_id IS NOT NULL AND NOT c.site_blocked AND parent.published_publication_id IS NOT NULL AND NOT parent.site_blocked AND w.visible AND NOT w.site_blocked`,[eventId,a.id])).rows[0];assert(row,404,'NOT_FOUND','Reply update is unavailable.');return row;
 });
 app.get('/api/me/workspace',async r=>{const a=await actor(r);const q=z.object({locale}).strict().parse(r.query);return workspaceOverview(db,a,q);});
 app.get('/api/me/workspace/items',async r=>{const a=await actor(r);const q=z.object({locale,section:z.enum(['attention','continue','progress']),scope:z.enum(['mine','assisted']).optional(),group:z.enum(['persona','project','world','interaction']).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().parse(r.query);return workspaceOverview(db,a,q);});
 app.get('/api/me/workspace/worlds',async r=>{const a=await actor(r);const q=z.object({locale,ids:z.string().max(800).transform(v=>v?v.split(','):[]).pipe(z.array(idSchema).max(20))}).strict().parse(r.query);return workspaceWorlds(db,a,q.ids,q.locale);});
}
