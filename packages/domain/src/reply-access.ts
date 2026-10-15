import type {Connection} from '@plotstay/database';
import {activeAccount,qualification} from './work-access.ts';
import {assert} from './errors.ts';

// Alias arguments are fixed by server code, never taken from request parameters.
export const effectiveReplySubmission = (reply: string, review: string) => `(
 ${reply}.submitted_revision_id IS NOT NULL AND ${reply}.submitted_access_epoch=(
 SELECT coalesce(e.epoch,0) FROM reply_revisions pending
 LEFT JOIN work_eligibilities e ON e.world_id=${review}.world_id AND e.user_id=pending.created_by
 WHERE pending.id=${reply}.submitted_revision_id AND coalesce(e.status,'never')<>'revoked'))`;

export async function replyAccessEpoch(db:Connection,worldId:string,userId:string){
  await activeAccount(db,userId,true);
  const eligibility=await qualification(db,worldId,userId,true);
  assert(eligibility.status!=='revoked',403,'ELIGIBILITY_REVOKED','Operating eligibility was revoked.');
  // Existing replies retain their permission model; absence of a grant is not a grant.
  return eligibility.epoch??0;
}
