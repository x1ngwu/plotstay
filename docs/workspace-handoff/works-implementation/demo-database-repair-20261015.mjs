// One-off demo repair explicitly authorized on 2026-10-15. Not a production ownership inference.
// Run from the repository root: node <this-file> --apply
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';

assert.ok(process.argv.includes('--apply'),'Explicit --apply required');
const backup=(await readFile('/tmp/plotstay-demo-pre014-backup-path','utf8')).trim();
assert.ok((await readFile(backup+'/database.dump')).length>0,'Backup required');
const db=new pg.Client({connectionString:parse(await readFile('.env','utf8')).DATABASE_URL});
const admin='d2b3f23f-ae68-4f6c-a2e6-0a64cf8d1e4c';
const adminPersona='cf7a56c1-a46f-4726-9ecd-778c85f6e76b';
const provider='f234ba4a-80d5-47c4-abb8-d79339013cfe';
const providerPersona='0a578bd6-6d94-40eb-ae90-05983246e511';
const providerWorks=['6464651e-3245-4e6a-94a0-8562eadcd633','0a4b3dea-28c6-4c17-96ab-8dbf6ae0c1b5','ef8525dc-0d8a-4dc1-81d6-0fff0fabcc90'];
const historical=['contents','content_revisions','publications','review_signatures','reply_revisions','reply_events','reply_publications','bookings','world_members'];
const snapshot=async()=>{const result={};for(const table of historical)result[table]=(await db.query(`SELECT count(*)::int AS count,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'')) AS hash FROM ${table} t`)).rows[0];return result;};
const migration=async(name)=>{
  const sql=await readFile(new URL('../../../packages/database/migrations/'+name,import.meta.url),'utf8');
  await db.query(sql);await db.query('INSERT INTO schema_migrations(name,checksum)VALUES($1,$2)',[name,createHash('sha256').update(sql).digest('hex')]);
};
await db.connect();
try{
  await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
  await db.query('SELECT pg_advisory_xact_lock(184570921)');
  const applied=(await db.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  assert.equal(applied.at(-1)?.name,'012_review_submissions.sql','This repair only targets the inspected pre-013 demo database');
  for(const m of applied){const sql=await readFile(new URL('../../../packages/database/migrations/'+m.name,import.meta.url));assert.equal(createHash('sha256').update(sql).digest('hex'),m.checksum);}
  await db.query('LOCK TABLE contents,provider_bindings IN SHARE ROW EXCLUSIVE MODE');
  const works=(await db.query("SELECT id,author_id FROM contents WHERE kind IN ('stay','service','experience')")).rows;
  assert.equal(works.length,24);assert.ok(works.every(w=>w.author_id===admin));
  assert.equal((await db.query('SELECT count(*)::int n FROM personas WHERE (id=$1 AND owner_id=$2 OR id=$3 AND owner_id=$4) AND approved AND NOT disabled',[adminPersona,admin,providerPersona,provider])).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int n FROM provider_bindings WHERE content_id=ANY($1::uuid[]) AND persona_id=$2',[providerWorks,providerPersona])).rows[0].n,3);
  const before=await snapshot();
  // Fill missing bindings before 013 freezes historical successful works; no trigger is disabled.
  const filled=(await db.query(`INSERT INTO provider_bindings(content_id,persona_id,assigned_by)
    SELECT c.id,$1,$2 FROM contents c WHERE c.kind IN ('stay','service','experience')
    AND NOT EXISTS(SELECT 1 FROM provider_bindings b WHERE b.content_id=c.id) RETURNING content_id`,[adminPersona,admin])).rows;
  assert.equal(filled.length,21);
  await db.query('INSERT INTO provider_binding_events(content_id,persona_id,actor_id) SELECT unnest($1::uuid[]),$2,$3',[filled.map(r=>r.content_id),adminPersona,admin]);
  await migration('013_work_authorship.sql');
  await db.query(`INSERT INTO work_ownership(content_id,owner_id,source)
    SELECT id,CASE WHEN id=ANY($1::uuid[]) THEN $2::uuid ELSE $3::uuid END,'audited'
    FROM contents WHERE kind IN ('stay','service','experience')`,[providerWorks,provider,admin]);
  await db.query(`INSERT INTO world_participations(world_id,user_id,joined,recorded_by)
    SELECT DISTINCT c.world_id,o.owner_id,true,$1::uuid FROM contents c JOIN work_ownership o ON o.content_id=c.id`,[admin]);
  await db.query(`INSERT INTO work_eligibilities(world_id,user_id,status,updated_by)
    SELECT world_id,user_id,'approved',$1::uuid FROM world_participations`,[admin]);
  await db.query(`INSERT INTO work_access_events(world_id,user_id,actor_id,action)
    SELECT world_id,user_id,$1::uuid,action FROM world_participations CROSS JOIN (VALUES('join'),('approve')) actions(action)`,[admin]);
  await migration('014_reply_operating_eligibility.sql');
  const unresolved=(await db.query(`SELECT count(*)::int n FROM contents c
    LEFT JOIN work_ownership o ON o.content_id=c.id LEFT JOIN provider_bindings b ON b.content_id=c.id
    LEFT JOIN personas p ON p.id=b.persona_id LEFT JOIN work_eligibilities e ON e.world_id=c.world_id AND e.user_id=o.owner_id
    WHERE c.kind IN ('stay','service','experience') AND
    (o.owner_id IS NULL OR p.id IS NULL OR p.owner_id<>o.owner_id OR p.disabled OR NOT p.approved OR e.status IS DISTINCT FROM 'approved')`)).rows[0].n;
  assert.equal(unresolved,0);const after=await snapshot();assert.deepEqual(after,before);
  const report={completedAt:new Date().toISOString(),backup,applied:['013_work_authorship.sql','014_reply_operating_eligibility.sql'],
    ownership:{admin:21,existingDemoProvider:3},bindingsFilled:filled.length,bindingsPreserved:3,
    participationAndEligibilityPairs:3,unresolved,historyUnchanged:after,
    mapping:(await db.query(`SELECT c.slug,o.owner_id,b.persona_id FROM contents c JOIN work_ownership o ON o.content_id=c.id JOIN provider_bindings b ON b.content_id=c.id ORDER BY c.slug`)).rows,
    deployment:false,serviceRestart:false,seedOrCleanup:false};
  await db.query('COMMIT');
  await writeFile(new URL('demo-database-repair-20261015.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({applied:report.applied,ownership:report.ownership,bindingsFilled:report.bindingsFilled,unresolved,historyUnchanged:true,backup}));
}catch(error){await db.query('ROLLBACK');throw error;}finally{await db.end();}
