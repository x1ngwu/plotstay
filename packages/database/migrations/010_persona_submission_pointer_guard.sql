-- A previous unreviewed event is not current when a later submission was decided.
-- Keep the immutable event and decision history; only clear stale current pointers.
UPDATE detail_settings s SET submitted_revision_id=NULL
WHERE s.kind='persona' AND s.submitted_revision_id IS NOT NULL AND (
  EXISTS (SELECT 1 FROM persona_revision_decisions d WHERE d.revision_id=s.submitted_revision_id)
  OR s.submitted_revision_id IS DISTINCT FROM (
    SELECT e.revision_id FROM detail_setting_events e
    WHERE e.setting_id=s.id AND e.action='submitted'
    ORDER BY e.created_at DESC,e.id DESC LIMIT 1
  )
);
