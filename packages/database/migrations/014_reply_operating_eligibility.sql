-- The submission pointer is mutable; historical replies, signatures and events are not.
ALTER TABLE review_replies ADD COLUMN submitted_access_epoch integer
 CHECK (submitted_access_epoch >= 0);

-- Preserve pre-eligibility submissions only when no revocation history is present.
-- A revoked or previously revoked account must explicitly submit again.
UPDATE review_replies q SET submitted_access_epoch=coalesce(e.epoch,0)
FROM reply_revisions r JOIN review_replies original ON original.submitted_revision_id=r.id
JOIN contents review ON review.id=original.review_id
LEFT JOIN work_eligibilities e ON e.world_id=review.world_id AND e.user_id=r.created_by
WHERE q.id=original.id
 AND coalesce(e.status,'never')<>'revoked'
 AND NOT EXISTS(SELECT 1 FROM work_access_events a
  WHERE a.world_id=review.world_id AND a.user_id=r.created_by AND a.action IN ('revoke','leave'));
