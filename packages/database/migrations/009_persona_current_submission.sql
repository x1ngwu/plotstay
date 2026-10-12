-- Reconnect legacy pending submissions whose pointer was cleared by a later draft save.
-- Immutable revisions, decisions, events and publications remain untouched.
UPDATE detail_settings s SET submitted_revision_id = (
  SELECT e.revision_id
  FROM detail_setting_events e
  LEFT JOIN persona_revision_decisions d ON d.revision_id=e.revision_id
  WHERE e.setting_id=s.id AND e.action='submitted' AND d.revision_id IS NULL
  ORDER BY e.created_at DESC,e.id DESC LIMIT 1
)
WHERE s.kind='persona' AND s.submitted_revision_id IS NULL;
