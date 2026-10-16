// Legacy test callers explicitly opt into the combined decision they used to
// obtain implicitly. Production code must obtain this intent from confirmation.
import type {Database} from '@plotstay/database';
import {reviewRevision as review,replyAction as reply,type Actor} from '@plotstay/domain';
export async function reviewRevision(db:Database,a:Actor,id:string,revision:string,decision:'publish'|'reject',note:string,token?:string){
 const signature=(await db.query('SELECT s.persona_revision_id,d.decision FROM review_signatures s LEFT JOIN persona_revision_decisions d ON d.revision_id=s.persona_revision_id WHERE s.revision_id=$1',[revision])).rows[0];
 return review(db,a,id,revision,decision,note,token,decision==='publish'&&a.siteRole==='admin'&&!signature?.decision?signature?.persona_revision_id:undefined);
}
export async function replyAction(db:Database,a:Actor,id:string,action:'submit'|'publish'|'reject'|'hide'|'restore',revision:string,note='',publication?:string){
 const signature=(await db.query('SELECT r.persona_revision_id,d.decision FROM reply_revisions r LEFT JOIN persona_revision_decisions d ON d.revision_id=r.persona_revision_id WHERE r.id=$1',[revision])).rows[0];
 return reply(db,a,id,action,revision,note,publication,action==='publish'&&a.siteRole==='admin'&&!signature?.decision?signature?.persona_revision_id:undefined);
}
