import {createDatabase} from '@plotstay/database';
import {initializeSettings,type Actor} from '@plotstay/domain';
const db=createDatabase();
try{const u=(await db.query("SELECT id,email FROM users WHERE site_role='admin' AND active ORDER BY created_at LIMIT 1")).rows[0];if(!u)throw new Error('No active site administrator');console.log(JSON.stringify(await initializeSettings(db,{...u,siteRole:'admin'} as Actor,process.argv.includes('--apply')),null,2));}finally{await db.end();}
