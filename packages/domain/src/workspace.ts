import {transaction,type Connection,type Database} from '@plotstay/database';
import type {Actor} from './auth.ts';
import {effectiveReplySubmission} from './reply-access.ts';

export type WorkspaceSection = 'attention'|'continue'|'progress';
export interface WorkspaceQuery {locale:string;section?:WorkspaceSection;scope?:'mine'|'assisted';group?:string;page?:number}
// All ownership, visibility, current-version and count predicates run before LIMIT.
// Parameters: actor, site administrator, locale, section, scope, group, offset.
const workspaceSQL = `WITH
world_access AS (
 SELECT w.*,($2 OR w.owner_id=$1 OR m.role IS NOT NULL) AS edit,
 ($2 OR w.owner_id=$1 OR m.role IN ('owner','admin')) AS manage
 FROM worlds w LEFT JOIN world_members m ON m.world_id=w.id AND m.user_id=$1
),
content_facts AS (
 SELECT c.*,r.status,r.created_by,r.created_at AS revision_at,r.source_text,
 coalesce(tr.body->>'title',r.source_text->>'title',c.slug) AS title,
 coalesce(w.translations->$3->>'name',w.translations->w.source_locale->>'name',w.slug) AS world_name,
 w.slug AS world_slug,w.edit,w.manage,w.visible AND NOT w.site_blocked AND NOT c.site_blocked AS visible,
 coalesce(s.managed,false) AS managed,p.owner_id AS persona_owner,p.disabled,
 coalesce(s.profiles->$3->>'name',s.profiles->'en'->>'name') AS persona_name,
 parent.slug AS parent_slug,parent.kind AS parent_kind,
 coalesce(pt.body->>'title',pr.source_text->>'title',parent.slug) AS parent_title,
 (parent.published_publication_id IS NOT NULL AND NOT parent.site_blocked AND w.visible AND NOT w.site_blocked) AS parent_visible,
 (r.created_by=$1 OR EXISTS(SELECT 1 FROM revision_locales rl JOIN translations t ON t.id=rl.translation_id
  WHERE rl.revision_id=r.id AND t.origin='manual' AND t.created_by=$1)) AS saved_by_me,
 greatest(r.created_at,(SELECT max(t.created_at) FROM revision_locales rl JOIN translations t ON t.id=rl.translation_id WHERE rl.revision_id=r.id AND t.origin='manual')) AS saved_at,
 (SELECT note FROM moderation_events e WHERE e.revision_id=r.id AND e.action='rejected' ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS feedback,
 (SELECT max(e.created_at) FROM moderation_events e WHERE e.revision_id=r.id AND e.action='rejected') AS rejected_at
 FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id JOIN world_access w ON w.id=c.world_id
 LEFT JOIN revision_locales rl ON rl.revision_id=r.id AND rl.locale=$3 LEFT JOIN translations tr ON tr.id=rl.translation_id
 LEFT JOIN review_signatures s ON s.revision_id=r.id LEFT JOIN personas p ON p.id=c.persona_id
 LEFT JOIN contents parent ON parent.id=c.parent_content_id LEFT JOIN publications parent_pub ON parent_pub.id=parent.published_publication_id LEFT JOIN content_revisions pr ON pr.id=parent_pub.revision_id
 LEFT JOIN revision_locales pl ON pl.revision_id=pr.id AND pl.locale=$3 LEFT JOIN translations pt ON pt.id=pl.translation_id
 WHERE w.edit OR c.author_id=$1
),
content_work AS (
 SELECT CASE WHEN status='rejected' AND saved_at<=rejected_at THEN 'attention' ELSE 'continue' END AS section,
 CASE WHEN author_id=$1 THEN 'mine' ELSE 'assisted' END AS scope,
 CASE WHEN kind='review' THEN 'interaction' ELSE 'project' END AS group_name,
 saved_at AS at,1 AS priority,
 jsonb_build_object('key','content:'||id||':'||head_revision_id,'id',id,'revisionId',head_revision_id,
 'title',title,'kind',CASE WHEN kind='review' THEN CASE WHEN managed THEN 'review' ELSE 'note' END ELSE kind END,
 'world',jsonb_build_object('id',world_id,'name',world_name),'parent',parent_title,'persona',persona_name,
 'state',CASE WHEN status='rejected' AND saved_at>rejected_at THEN 'draft' ELSE status END,'published',published_publication_id IS NOT NULL AND visible,'note',CASE WHEN status='rejected' AND saved_at<=rejected_at THEN feedback END,
 'at',saved_at,'action',CASE WHEN status='rejected' AND saved_at<=rejected_at THEN 'feedback' ELSE 'edit' END,
 'target',CASE WHEN managed THEN jsonb_build_object('view','reviews','review',id,'revision',head_revision_id)
 ELSE jsonb_build_object('view','editor','world',world_id,'content',id,'revision',head_revision_id) END) AS item
 FROM content_facts WHERE status IN ('draft','rejected') AND
 ((managed AND author_id=$1 AND persona_owner=$1 AND NOT disabled AND parent_visible)
 OR (NOT managed AND edit AND (author_id=$1 OR saved_by_me)))
),
settings_facts AS (
 SELECT s.*,r.body,r.created_by,r.created_at,p.owner_id,p.disabled,d.decision,d.note,
 pub.revision_id AS published_revision,
 coalesce(w.translations->$3->>'name',w.translations->w.source_locale->>'name',w.slug) AS world_name,
 coalesce(w.edit,false) AS edit,coalesce(w.manage,false) AND NOT w.site_blocked AS manage,
 ev.action AS latest_action,ev.note AS feedback,
 CASE WHEN s.kind='persona' THEN coalesce(r.body->$3->>'name',r.body->'en'->>'name')
 WHEN s.kind='world' THEN coalesce(r.body->$3->>'name',w.slug)
 WHEN s.kind='place' THEN coalesce(r.body->$3->>'name',pl.slug) ELSE NULL END AS title
 FROM detail_settings s JOIN detail_setting_revisions r ON r.id=s.head_revision_id
 LEFT JOIN detail_setting_publications pub ON pub.id=s.published_id
 LEFT JOIN personas p ON s.kind='persona' AND p.id=s.entity_id
 LEFT JOIN places pl ON s.kind='place' AND pl.id=s.entity_id
 LEFT JOIN world_access w ON w.id=s.world_id
 LEFT JOIN persona_revision_decisions d ON d.revision_id=r.id
 LEFT JOIN LATERAL(SELECT action,note FROM detail_setting_events e WHERE e.setting_id=s.id AND e.revision_id=r.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1) ev ON true
 WHERE (s.kind='persona' AND (p.owner_id=$1 OR $2)) OR (s.kind='copy' AND $2) OR w.edit
),
setting_work AS (
 SELECT CASE WHEN decision='rejected' OR latest_action='rejected' THEN 'attention' ELSE 'continue' END AS section,
 CASE WHEN kind='persona' AND owner_id=$1 THEN 'mine' ELSE 'assisted' END AS scope,
 CASE WHEN kind='persona' THEN 'persona' ELSE 'world' END AS group_name,created_at AS at,1 AS priority,
 jsonb_build_object('key','setting:'||id||':'||head_revision_id,'id',entity_id,'revisionId',head_revision_id,'title',title,'kind',kind,
 'world',CASE WHEN world_id IS NOT NULL THEN jsonb_build_object('id',world_id,'name',world_name) END,
 'state',CASE WHEN decision='rejected' OR latest_action='rejected' THEN 'rejected' ELSE 'draft' END,
 'published',published_id IS NOT NULL,'note',coalesce(note,feedback),'at',created_at,
 'action',CASE WHEN decision='rejected' OR latest_action='rejected' THEN 'feedback' ELSE 'edit' END,
 'target',CASE WHEN kind='persona' AND owner_id=$1 THEN jsonb_build_object('view','personas','persona',entity_id,'revision',head_revision_id)
 WHEN world_id IS NOT NULL THEN jsonb_build_object('view','world-settings','world',world_id,'setting',id,'revision',head_revision_id)
 ELSE jsonb_build_object('view','shared-settings','setting',id,'revision',head_revision_id) END) AS item
 FROM settings_facts WHERE (kind<>'persona' OR owner_id<>$1 OR NOT disabled) AND head_revision_id IS DISTINCT FROM published_revision
 AND NOT (head_revision_id IS NOT DISTINCT FROM submitted_revision_id AND decision IS NULL AND latest_action NOT IN ('rejected','published','restored','approved'))
 AND (kind='persona' AND owner_id=$1 OR created_by=$1 AND EXISTS(SELECT 1 FROM detail_setting_events e WHERE e.setting_id=settings_facts.id AND e.revision_id=head_revision_id AND e.action='draft_saved' AND e.actor_id=$1))
),
home_facts AS (
 SELECT s.*,r.created_by,r.created_at,coalesce(w.translations->$3->>'name',w.slug) AS title,w.manage,w.site_blocked,
 p.revision_id AS published_revision,ev.action AS last_action
 FROM world_home_settings s JOIN world_home_revisions r ON r.id=s.head_revision_id
 JOIN world_access w ON w.id=s.world_id LEFT JOIN world_home_publications p ON p.id=s.published_id
 LEFT JOIN LATERAL(SELECT action FROM moderation_events e WHERE e.world_id=s.world_id AND e.note=s.head_revision_id::text AND e.action IN ('home_submit','home_reject','home_draft_saved') ORDER BY e.created_at DESC,e.id DESC LIMIT 1) ev ON true
 WHERE w.manage
),
home_work AS (
 SELECT CASE WHEN last_action='home_reject' THEN 'attention' ELSE 'continue' END AS section,'assisted' AS scope,'world' AS group_name,created_at AS at,1 AS priority,
 jsonb_build_object('key','home:'||world_id||':'||head_revision_id,'id',world_id,'revisionId',head_revision_id,'title',title,'kind','home',
 'world',jsonb_build_object('id',world_id,'name',title),'state',CASE WHEN last_action='home_reject' THEN 'rejected' ELSE 'draft' END,
 'published',published_id IS NOT NULL,'at',created_at,'action','edit',
 'target',jsonb_build_object('view','world-settings','world',world_id,'setting','home','revision',head_revision_id)) AS item
 FROM home_facts WHERE created_by=$1 AND head_revision_id IS DISTINCT FROM published_revision
 AND NOT (head_revision_id IS NOT DISTINCT FROM submitted_revision_id AND last_action='home_submit')
),
reply_facts AS (
 SELECT c.id AS review_id,c.world_id,c.author_id,c.published_publication_id,
 coalesce(rt.body->>'title',r.source_text->>'title',c.slug) AS title,
 coalesce(w.translations->$3->>'name',w.slug) AS world_name,coalesce(parent_text.body->>'title',parent_revision.source_text->>'title',parent.slug) AS parent_title,
 coalesce(person.profiles->$3->>'name',person.profiles->'en'->>'name') AS persona_name,
 person.owner_id,person.disabled,person.id AS provider_id,w.manage,
 q.id,q.head_revision_id,CASE WHEN ${effectiveReplySubmission('q','c')} THEN q.submitted_revision_id END AS submitted_revision_id,submitted_reply.created_at AS submitted_at,q.published_id,q.hidden,rr.created_by,rr.persona_id,rr.created_at,ev.action,ev.note,
 cp.published_at,coalesce(rt.body->>'description',r.source_text->>'description') AS excerpt
 FROM contents c JOIN contents parent ON parent.id=c.parent_content_id JOIN world_access w ON w.id=c.world_id
 JOIN publications parent_publication ON parent_publication.id=parent.published_publication_id JOIN content_revisions parent_revision ON parent_revision.id=parent_publication.revision_id
 LEFT JOIN publication_locales parent_locale ON parent_locale.publication_id=parent_publication.id AND parent_locale.locale=$3 LEFT JOIN translations parent_text ON parent_text.id=parent_locale.translation_id
 JOIN publications cp ON cp.id=c.published_publication_id JOIN content_revisions r ON r.id=cp.revision_id
 LEFT JOIN publication_locales rl ON rl.publication_id=cp.id AND rl.locale=$3 LEFT JOIN translations rt ON rt.id=rl.translation_id
 JOIN provider_bindings b ON b.content_id=parent.id JOIN personas person ON person.id=b.persona_id
 LEFT JOIN review_replies q ON q.review_id=c.id LEFT JOIN reply_revisions submitted_reply ON submitted_reply.id=q.submitted_revision_id LEFT JOIN reply_revisions rr ON rr.id=q.head_revision_id
 LEFT JOIN LATERAL(SELECT action,note FROM reply_events e WHERE e.revision_id=rr.id AND e.action IN ('draft','submit','publish','reject') ORDER BY e.created_at DESC,(e.action='draft') ASC,e.id DESC LIMIT 1) ev ON true
 WHERE c.kind='review' AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked
 AND parent.published_publication_id IS NOT NULL AND NOT parent.site_blocked
 AND (person.owner_id=$1 OR w.manage OR c.author_id=$1)
),
reply_work AS (
 SELECT CASE WHEN id IS NULL OR action='reject' THEN 'attention' ELSE 'continue' END AS section,'mine' AS scope,'interaction' AS group_name,
 coalesce(created_at,published_at) AS at,CASE WHEN id IS NULL THEN 2 ELSE 1 END AS priority,
 jsonb_build_object('key','reply:'||review_id||':'||coalesce(head_revision_id::text,'new'),'id',review_id,'revisionId',head_revision_id,
 'title',title,'kind','reply','world',jsonb_build_object('id',world_id,'name',world_name),'parent',parent_title,'persona',persona_name,
 'state',CASE WHEN id IS NULL THEN 'optional' WHEN action='reject' THEN 'rejected' ELSE 'draft' END,
 'published',published_id IS NOT NULL AND NOT hidden,'note',CASE WHEN id IS NULL THEN left(excerpt,150) WHEN action='reject' THEN note END,
 'at',coalesce(created_at,published_at),'action',CASE WHEN id IS NULL THEN 'reply' WHEN action='reject' THEN 'feedback' ELSE 'edit-reply' END,
 'target',jsonb_build_object('view','replies','reply',review_id,'revision',head_revision_id)) AS item
 FROM reply_facts WHERE owner_id=$1 AND NOT disabled AND (id IS NULL OR created_by=$1 AND persona_id=provider_id AND action IN ('draft','reject'))
),
review_tasks AS (
 SELECT 'attention' AS section,'' AS scope,'world' AS group_name,max(revision_at) AS at,0 AS priority,
 jsonb_build_object('key','queue:'||world_id,'id',world_id,'title',world_name,'kind','world','state','queue','quantity',count(*)::int,'action','review',
 'target',jsonb_build_object('view','world-review','world',world_id,'status','submitted')) AS item
 FROM content_facts WHERE manage AND (kind='review' AND submitted_revision_id IS NOT NULL OR kind<>'review' AND status='submitted') GROUP BY world_id,world_name
 UNION ALL
 SELECT 'attention','','interaction',submitted_at,0,
 jsonb_build_object('key','reply-moderation:'||id||':'||submitted_revision_id,'id',review_id,'revisionId',submitted_revision_id,'title',title,'kind','reply','state','submitted','action','review',
 'world',jsonb_build_object('id',world_id,'name',world_name),'target',jsonb_build_object('view','moderation','moderateReply',review_id,'revision',submitted_revision_id))
 FROM reply_facts WHERE manage AND submitted_revision_id IS NOT NULL
 UNION ALL
 SELECT 'attention','','persona',sr.created_at,0,
 jsonb_build_object('key','persona-review:'||sf.id||':'||sr.id,'id',sf.entity_id,'revisionId',sr.id,'title',coalesce(sr.body->$3->>'name',sr.body->'en'->>'name'),
 'kind','persona','state','submitted','action','review','target',jsonb_build_object('view','site','submission',sr.id))
 FROM settings_facts sf JOIN detail_setting_revisions sr ON sr.id=sf.submitted_revision_id
 WHERE $2 AND sf.kind='persona' AND NOT EXISTS(SELECT 1 FROM persona_revision_decisions d WHERE d.revision_id=sr.id)
 UNION ALL
 SELECT 'attention','','world',created_at,0,
 jsonb_build_object('key','setting-review:'||id||':'||head_revision_id,'id',entity_id,'revisionId',head_revision_id,'title',title,'kind',kind,'state','submitted','action','review',
 'world',CASE WHEN world_id IS NOT NULL THEN jsonb_build_object('id',world_id,'name',world_name) END,
 'target',CASE WHEN world_id IS NOT NULL THEN jsonb_build_object('view','world-settings','world',world_id,'setting',id,'revision',head_revision_id)
 ELSE jsonb_build_object('view','shared-settings','setting',id,'revision',head_revision_id) END)
 FROM settings_facts WHERE kind<>'persona' AND (manage OR kind='copy' AND $2) AND head_revision_id=submitted_revision_id
 AND head_revision_id IS DISTINCT FROM published_revision AND latest_action='submitted'
 UNION ALL
 SELECT 'attention','','world',created_at,0,
 jsonb_build_object('key','home-review:'||world_id||':'||head_revision_id,'id',world_id,'revisionId',head_revision_id,'title',title,'kind','home','state','submitted','action','review',
 'target',jsonb_build_object('view','world-settings','world',world_id,'setting','home','revision',head_revision_id))
 FROM home_facts WHERE NOT site_blocked AND head_revision_id=submitted_revision_id AND head_revision_id IS DISTINCT FROM published_revision AND last_action='home_submit'
),
progress AS (
 SELECT 'progress' AS section,'' AS scope,'' AS group_name,e.created_at AS at,0 AS priority,
 jsonb_build_object('key','event:'||e.id,'id',c.id,'revisionId',e.revision_id,'title',coalesce(event_text.body->>'title',r.source_text->>'title',c.title),'kind',CASE WHEN c.managed THEN 'review' ELSE c.kind END,
 'world',jsonb_build_object('id',c.world_id,'name',c.world_name),'state',e.action,'at',e.created_at,'action','view',
 'target',CASE WHEN c.managed THEN jsonb_build_object('view','reviews','review',c.id,'revision',e.revision_id,'event',e.id)
 ELSE jsonb_build_object('view','editor','world',c.world_id,'content',c.id,'revision',e.revision_id,'event',e.id) END) AS item
 FROM content_facts c JOIN moderation_events e ON e.content_id=c.id JOIN content_revisions r ON r.id=e.revision_id LEFT JOIN revision_locales event_locale ON event_locale.revision_id=r.id AND event_locale.locale=$3 LEFT JOIN translations event_text ON event_text.id=event_locale.translation_id
 WHERE e.action IN ('submitted','published','rejected','restored','unpublished') AND
 ((c.managed AND c.author_id=$1) OR (NOT c.managed AND c.edit AND (c.author_id=$1 OR r.created_by=$1 OR EXISTS(SELECT 1 FROM moderation_events saved WHERE saved.revision_id=r.id AND saved.actor_id=$1 AND saved.action='translation_saved'))))
 UNION ALL
 SELECT 'progress','','',e.created_at,0,
 jsonb_build_object('key','setting-event:'||e.id,'id',s.entity_id,'revisionId',e.revision_id,'title',coalesce(r.body->$3->>'name',r.body->'en'->>'name',s.title),'kind',s.kind,
 'world',CASE WHEN s.world_id IS NOT NULL THEN jsonb_build_object('id',s.world_id,'name',s.world_name) END,'state',e.action,'at',e.created_at,'action','view',
 'target',CASE WHEN s.kind='persona' AND s.owner_id=$1 THEN jsonb_build_object('view','personas','persona',s.entity_id,'revision',e.revision_id,'event',e.id)
 WHEN s.world_id IS NOT NULL THEN jsonb_build_object('view','world-settings','world',s.world_id,'setting',s.id,'revision',e.revision_id,'event',e.id)
 ELSE jsonb_build_object('view','shared-settings','setting',s.id,'revision',e.revision_id,'event',e.id) END)
 FROM settings_facts s JOIN detail_setting_events e ON e.setting_id=s.id JOIN detail_setting_revisions r ON r.id=e.revision_id
 WHERE e.action IN ('submitted','approved','rejected','published','restored') AND (s.kind='persona' AND s.owner_id=$1 OR r.created_by=$1)
 UNION ALL
 SELECT 'progress','','',e.created_at,0,
 jsonb_build_object('key','reply-event:'||e.id,'id',f.review_id,'revisionId',e.revision_id,'title',f.title,'kind','reply',
 'world',jsonb_build_object('id',f.world_id,'name',f.world_name),'state',CASE WHEN f.author_id=$1 AND e.action IN ('publish','restore') THEN 'received-reply' ELSE e.action END,
 'at',e.created_at,'action','view','target',CASE WHEN f.owner_id=$1 AND NOT f.disabled THEN jsonb_build_object('view','replies','reply',f.review_id,'revision',e.revision_id,'event',e.id)
 ELSE jsonb_build_object('view','reviews','review',f.review_id,'replyEvent',e.id) END)
 FROM reply_facts f JOIN reply_events e ON e.reply_id=f.id JOIN reply_revisions r ON r.id=e.revision_id
 WHERE (f.owner_id=$1 AND r.created_by=$1 AND NOT f.disabled AND e.action IN ('submit','publish','reject','restore')) OR (f.author_id=$1 AND e.action IN ('publish','restore') AND NOT f.hidden)
 UNION ALL
 SELECT 'progress','','',e.created_at,0,
 jsonb_build_object('key','home-event:'||e.id,'id',h.world_id,'title',h.title,'kind','home','state',replace(e.action,'home_',''),'at',e.created_at,'action','view',
 'target',jsonb_build_object('view','world-settings','world',h.world_id,'setting','home','event',e.id,'revision',coalesce(hp.revision_id,hr.id)))
 FROM home_facts h JOIN moderation_events e ON e.world_id=h.world_id AND e.action IN ('home_submit','home_publish','home_published','home_reject','home_restore')
 LEFT JOIN world_home_publications hp ON hp.world_id=h.world_id AND hp.id::text=e.note
 LEFT JOIN world_home_revisions hr ON hr.world_id=h.world_id AND hr.id=coalesce(hp.revision_id,(SELECT id FROM world_home_revisions WHERE world_id=h.world_id AND id::text=e.note))
 WHERE e.actor_id=$1 OR hr.created_by=$1
),
all_items AS (SELECT * FROM content_work UNION ALL SELECT * FROM setting_work UNION ALL SELECT * FROM home_work UNION ALL SELECT * FROM reply_work UNION ALL SELECT * FROM review_tasks UNION ALL SELECT * FROM progress),
filtered AS (SELECT * FROM all_items WHERE ($4::text IS NULL OR section=$4) AND ($5::text IS NULL OR scope=$5) AND ($6::text IS NULL OR group_name=$6)),
ranked AS (SELECT *,count(*) OVER(PARTITION BY section,CASE WHEN section='continue' THEN scope ELSE '' END,CASE WHEN section='continue' THEN group_name ELSE '' END)::int AS total,
 row_number() OVER(PARTITION BY section,CASE WHEN section='continue' THEN scope ELSE '' END,CASE WHEN section='continue' THEN group_name ELSE '' END ORDER BY priority,at DESC,item->>'key') AS n,
 row_number() OVER(ORDER BY priority,at DESC,item->>'key') AS page_n,count(*) OVER()::int AS page_total FROM filtered)
SELECT (SELECT count(*)::int FROM filtered) AS full_total,coalesce(jsonb_agg(jsonb_build_object('section',section,'scope',scope,'group_name',group_name,'total',total,'item',item) ORDER BY priority,at DESC,item->>'key'),'[]'::jsonb) AS entries FROM ranked WHERE
 CASE WHEN $4::text IS NOT NULL THEN page_n>$7 AND page_n<=$7+20 ELSE n<=CASE WHEN section='continue' THEN 2 WHEN section='progress' THEN 5 ELSE 6 END END`;

export async function workspaceOverview(database:Database,actor:Actor,query:WorkspaceQuery):Promise<any>{
 return transaction(database,async db=>{
 // This interactive summary is faster without per-request JIT compilation.
 // SET LOCAL is scoped to this transaction and cannot leak into pooled callers.
 await db.query('SET LOCAL jit = off');
 const result=await db.query(workspaceSQL,[actor.id,actor.siteRole==='admin',query.locale,query.section??null,query.scope??null,query.group??null,((query.page??1)-1)*20]);
 const rows=result.rows[0].entries as any[];
 if(query.section){const total=result.rows[0].full_total;return {items:rows.map(r=>r.item),total,hasNext:(query.page??1)*20<total,page:query.page??1};}
 const section=(name:string)=>{const matching=rows.filter(r=>r.section===name);return {items:matching.map(r=>r.item),total:matching[0]?.total??0};};
 const groups:Record<string,Record<string,{items:any[];total:number}>>={mine:{},assisted:{}};
 for(const r of rows.filter(r=>r.section==='continue')){const group=groups[r.scope]![r.group_name]??={items:[],total:r.total};group.items.push(r.item);}
 const capability=await db.query(`SELECT EXISTS(SELECT 1 FROM worlds w WHERE $2 OR w.owner_id=$1 OR EXISTS(SELECT 1 FROM world_members m WHERE m.world_id=w.id AND m.user_id=$1)) AS allowed`,[actor.id,actor.siteRole==='admin']);
 return {attention:section('attention'),continue:groups,progress:section('progress'),canManage:capability.rows[0].allowed};
 });
}

export async function workspaceWorlds(db:Connection,actor:Actor,ids:string[],locale:string){
 if(!ids.length)return {worlds:[]};
 const {rows}=await db.query(`SELECT w.id,w.slug,coalesce(w.translations->$3->>'name',w.slug) AS name,
 CASE WHEN w.owner_id=$1 THEN 'owner' WHEN m.role IS NOT NULL THEN m.role WHEN $2 THEN 'site-admin' ELSE 'visitor' END AS role,
 (w.visible AND NOT w.site_blocked) AS "canVisit",($2 OR w.owner_id=$1 OR m.role IS NOT NULL) AS "canManage"
 FROM worlds w LEFT JOIN world_members m ON m.world_id=w.id AND m.user_id=$1
 WHERE w.id=ANY($4::uuid[]) AND ((w.visible AND NOT w.site_blocked) OR $2 OR w.owner_id=$1 OR m.role IS NOT NULL)
 ORDER BY array_position($4::uuid[],w.id) LIMIT 4`,[actor.id,actor.siteRole==='admin',locale,ids]);
 return {worlds:rows};
}
