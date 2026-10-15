// Explicitly read-only audit of the authorized demo database; never seeds or migrates.
import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import pg from 'pg';
const db=new pg.Client({connectionString:parse(await readFile('.env','utf8')).DATABASE_URL});
await db.connect();
try{
 await db.query('BEGIN READ ONLY');
 const migrations=(await db.query("SELECT name,applied_at FROM schema_migrations WHERE name>='013' ORDER BY name")).rows;
 const works=(await db.query(`SELECT count(*)::int total,
 count(*) FILTER(WHERE o.owner_id IS NULL)::int missing_owner,
 count(*) FILTER(WHERE b.persona_id IS NULL)::int missing_binding,
 count(*) FILTER(WHERE p.owner_id<>o.owner_id)::int owner_binding_mismatch,
 count(*) FILTER(WHERE c.created_at>(SELECT applied_at FROM schema_migrations WHERE name='013_work_authorship.sql'))::int created_after_migration
 FROM contents c LEFT JOIN work_ownership o ON o.content_id=c.id LEFT JOIN provider_bindings b ON b.content_id=c.id LEFT JOIN personas p ON p.id=b.persona_id
 WHERE c.kind IN ('stay','service','experience')`)).rows[0];
 const pending=(await db.query(`SELECT
 (SELECT count(*)::int FROM review_replies WHERE submitted_revision_id IS NOT NULL AND submitted_access_epoch IS NULL) AS reply_missing_epoch,
 (SELECT count(*)::int FROM contents c JOIN content_revisions r ON r.id=c.head_revision_id LEFT JOIN work_submission_eligibilities s ON s.content_id=c.id AND s.revision_id=r.id WHERE c.kind IN ('stay','service','experience') AND r.status='submitted' AND s.epoch IS NULL) AS work_missing_epoch`)).rows[0];
 await db.query('COMMIT');
 const result={checkedAt:new Date().toISOString(),readOnly:true,migrations,works,pending};
 await writeFile(new URL('live-audit.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await db.end();}
