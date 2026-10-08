import { transaction, type Database, type Connection } from '@plotstay/database';
import { homeConfigSchema, type HomeConfig, type PublicHome } from '@plotstay/contracts';
import { requireWorld, type Actor } from './auth.ts';
import { assert } from './errors.ts';

export async function publicHome(db: Connection, worldId: string, locale: string): Promise<PublicHome | null> {
  const { rows: [row] } = await db.query(`SELECT r.body FROM world_home_settings s
    JOIN worlds w ON w.id=s.world_id AND w.visible AND NOT w.site_blocked
    JOIN world_home_publications p ON p.id=s.published_id JOIN world_home_revisions r ON r.id=p.revision_id
    WHERE s.world_id=$1`, [worldId]);
  if (!row) return null;
  const { translations, ...config } = homeConfigSchema.parse(row.body);
  const actual = translations[locale] ? locale : config.sourceLocale;
  const text = translations[actual]!;
  const { rows: [language] } = await db.query('SELECT language_tag FROM locales WHERE code=$1', [actual]);
  const promotion = config.promotion;
  if (promotion && (!promotion.enabled || (promotion.startsAt && new Date(promotion.startsAt).getTime() > Date.now()) ||
    (promotion.endsAt && new Date(promotion.endsAt).getTime() <= Date.now()))) { config.promotion = undefined; text.promotion = undefined; }
  return { config, text, locale: actual, languageTag: language.language_tag, availableLocales: Object.keys(translations), isFallback: actual !== locale };
}
async function validateRelations(db: Connection, worldId: string, body: HomeConfig) {
  const enabled = new Set((await db.query('SELECT code FROM locales WHERE enabled')).rows.map(l => l.code));
  assert(Object.keys(body.translations).every(l => enabled.has(l)) && enabled.has(body.sourceLocale), 400, 'INVALID_LOCALE', 'Home configuration languages must be enabled.');
  const places = new Set((await db.query('SELECT slug FROM places WHERE world_id=$1', [worldId])).rows.map(r => r.slug));
  const categories = new Set(body.categories.map(c => c.slug));
  for (const ref of [...body.sections, ...body.benefits.map(b => b.target), ...(body.promotion ? [body.promotion.target] : [])]) {
    assert(!ref.place || places.has(ref.place), 400, 'INVALID_PLACE', 'Configuration place must belong to the world.');
    assert(!ref.category || categories.has(ref.category), 400, 'INVALID_CATEGORY', 'Configuration category must exist.');
  }
  assert(body.placeOrder.every(p => places.has(p)), 400, 'INVALID_PLACE', 'Place order must use this world.');
  for (const section of body.sections) {
    if (!section.recommendedIds.length) continue;
    const result = await db.query('SELECT id FROM contents WHERE world_id=$1 AND id=ANY($2::uuid[]) AND kind=$3', [worldId, section.recommendedIds, section.type === 'stays' ? 'stay' : section.type === 'experiences' ? 'experience' : 'service']);
    assert(result.rowCount === new Set(section.recommendedIds).size, 400, 'INVALID_RECOMMENDATION', 'Recommendations must match the world and section type.');
  }
}
// Controlled configuration API used by seed/import tooling. A future editor uses the same version boundary.
export function saveHomeDraft(db: Database, actor: Actor, worldId: string, raw: unknown, baseRevisionId: string | null) {
  const body = homeConfigSchema.parse(raw);
  return transaction(db, async client => {
    await requireWorld(client, actor, worldId, true);
    await client.query('SELECT id FROM worlds WHERE id=$1 FOR UPDATE', [worldId]);
    const { rows: [settings] } = await client.query('SELECT * FROM world_home_settings WHERE world_id=$1', [worldId]);
    assert((settings?.head_revision_id ?? null) === baseRevisionId, 409, 'REVISION_CONFLICT', 'Home configuration changed.');
    await validateRelations(client, worldId, body);
    const { rows: [revision] } = await client.query('INSERT INTO world_home_revisions(world_id,body,created_by) VALUES ($1,$2,$3) RETURNING id', [worldId, body, actor.id]);
    await client.query(`INSERT INTO world_home_settings(world_id,head_revision_id) VALUES ($1,$2)
      ON CONFLICT(world_id) DO UPDATE SET head_revision_id=excluded.head_revision_id`, [worldId, revision.id]);
    await client.query("INSERT INTO moderation_events(world_id,actor_id,action,note) VALUES ($1,$2,'home_draft_saved',$3)", [worldId, actor.id, revision.id]);
    return { revisionId: revision.id as string };
  });
}
export function publishHome(db: Database, actor: Actor, worldId: string, revisionId: string) {
  return transaction(db, async client => {
    const world = await requireWorld(client, actor, worldId, true);
    assert(!world.site_blocked, 403, 'SITE_BLOCKED', 'This world is restricted.');
    const { rows: [settings] } = await client.query('SELECT * FROM world_home_settings WHERE world_id=$1 FOR UPDATE', [worldId]);
    assert(settings?.head_revision_id === revisionId, 409, 'REVISION_CONFLICT', 'Publish the current configuration draft.');
    const { rows: [revision] } = await client.query('SELECT body FROM world_home_revisions WHERE id=$1', [revisionId]);
    const body = homeConfigSchema.parse(revision.body);
    const required = (await client.query('SELECT code FROM locales WHERE enabled AND required_for_publish')).rows;
    assert(required.every(l => body.translations[l.code]), 409, 'TRANSLATIONS_REQUIRED', 'Complete required home languages.');
    await validateRelations(client, worldId, body);
    const { rows: [publication] } = await client.query('INSERT INTO world_home_publications(world_id,revision_id,published_by) VALUES ($1,$2,$3) RETURNING id', [worldId, revisionId, actor.id]);
    await client.query('UPDATE world_home_settings SET published_id=$2 WHERE world_id=$1', [worldId, publication.id]);
    await client.query("INSERT INTO moderation_events(world_id,actor_id,action,note) VALUES ($1,$2,'home_published',$3)", [worldId, actor.id, publication.id]);
    return { publicationId: publication.id as string };
  });
}

export async function adminHome(db:Connection,actor:Actor,worldId:string){
 await requireWorld(db,actor,worldId);
 const setting=(await db.query('SELECT * FROM world_home_settings WHERE world_id=$1',[worldId])).rows[0];
 const revisions=(await db.query('SELECT * FROM world_home_revisions WHERE world_id=$1 ORDER BY created_at DESC,id DESC',[worldId])).rows;
 const publications=(await db.query('SELECT * FROM world_home_publications WHERE world_id=$1 ORDER BY published_at DESC,id DESC',[worldId])).rows;
 return {setting,revisions,publications};
}
export function reviewHome(db:Database,actor:Actor,worldId:string,action:'submit'|'publish'|'reject'|'restore',revisionId:string,publicationId?:string){return transaction(db,async client=>{
 const world=await requireWorld(client,actor,worldId,true);assert(!world.site_blocked,403,'SITE_BLOCKED','World is restricted.');
 const s=(await client.query('SELECT * FROM world_home_settings WHERE world_id=$1 FOR UPDATE',[worldId])).rows[0];
 assert(s?.head_revision_id===revisionId,409,'REVISION_CONFLICT','Configuration changed.');
 if(action==='submit'||action==='reject'){
  await client.query('UPDATE world_home_settings SET submitted_revision_id=$2 WHERE world_id=$1',[worldId,action==='submit'?revisionId:null]);
 }else{
  let target=revisionId;
  if(action==='restore'){const p=(await client.query('SELECT revision_id FROM world_home_publications WHERE id=$1 AND world_id=$2',[publicationId,worldId])).rows[0];assert(p,404,'NOT_FOUND','Publication not found.');target=p.revision_id;}
  else assert(s.submitted_revision_id===revisionId,409,'NOT_SUBMITTED','Submit this version first.');
  const r=(await client.query('SELECT body FROM world_home_revisions WHERE id=$1',[target])).rows[0];const body=homeConfigSchema.parse(r.body);
  const required=(await client.query('SELECT code FROM locales WHERE enabled AND required_for_publish')).rows;
  assert(required.every(l=>body.translations[l.code]),409,'TRANSLATIONS_REQUIRED','Complete required languages.');await validateRelations(client,worldId,body);
  const p=(await client.query('INSERT INTO world_home_publications(world_id,revision_id,published_by)VALUES($1,$2,$3)RETURNING id',[worldId,target,actor.id])).rows[0];
  await client.query('UPDATE world_home_settings SET published_id=$2 WHERE world_id=$1',[worldId,p.id]);
 }
 await client.query('INSERT INTO moderation_events(world_id,actor_id,action,note)VALUES($1,$2,$3,$4)',[worldId,actor.id,'home_'+action,publicationId??revisionId]);return {done:true};
});}
