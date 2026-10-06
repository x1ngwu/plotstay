-- Identity and world relations are stable; edits belong in new revisions.
CREATE FUNCTION keep_content_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['head_revision_id','published_publication_id','site_blocked'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['head_revision_id','published_publication_id','site_blocked']) THEN
    RAISE EXCEPTION 'Content identity is immutable; edit through revisions';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER content_identity_immutable BEFORE UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION keep_content_identity();
CREATE TRIGGER revision_delete_forbidden BEFORE DELETE ON content_revisions
  FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();

ALTER TABLE publications ADD FOREIGN KEY (restored_from, content_id) REFERENCES publications(id, content_id);
ALTER TABLE bookings ADD FOREIGN KEY (publication_id, content_id) REFERENCES publications(id, content_id);
