// Deployment-only incremental migration audit. Does not seed or write business rows.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {createDatabase,transaction,type Connection} from '@plotstay/database';
import {migrate} from '../../../packages/database/src/migrate.ts';
assert(process.argv.includes('--apply'),'Pass --apply after the isolated tests and build have passed.');
const db=createDatabase();
try {
 const schema=(await db.query('SELECT current_schema() AS name')).rows[0].name;
 assert.equal(schema,'public','Deployment audit expects the existing public schema.');
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename<>'schema_migrations' ORDER BY tablename")).rows.map(r=>r.tablename as string);
 const digest=async(c:Connection)=>{
  const hash=createHash('sha256'),counts:Record<string,number>={};
  for(const table of tables){const quoted='"'+table.replaceAll('"','""')+'"';const {rows}=await c.query(`SELECT to_jsonb(t)::text AS value FROM ${quoted} t ORDER BY to_jsonb(t)::text`);counts[table]=rows.length;hash.update(table).update(JSON.stringify(rows));}
  return {sha256:hash.digest('hex'),counts};
 };
 const beforeMigrations=(await db.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);
 const before=await transaction(db,digest);
 await migrate(db);
 const after=await transaction(db,digest);
 const afterMigrations=(await db.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(r=>r.name);
 const additions=afterMigrations.filter(n=>!beforeMigrations.includes(n));
 const report={time:new Date().toISOString(),schema,additions,before,after,unchanged:before.sha256===after.sha256,notesRows:Number((await db.query('SELECT count(*) FROM persona_private_notes')).rows[0].count),commandRows:Number((await db.query('SELECT count(*) FROM persona_profile_commands')).rows[0].count)};
 await writeFile(new URL('./migration-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 assert.equal(report.unchanged,true,'Existing rows changed during migration; inspect audit before claiming unchanged.');
 assert(additions.every(n=>n==='011_persona_private_notes.sql'));
 console.log(JSON.stringify({applied:additions,existingRowsUnchanged:true,tables:tables.length,notesRows:report.notesRows,commandRows:report.commandRows}));
} finally {await db.end();}
