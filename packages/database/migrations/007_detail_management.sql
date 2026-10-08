-- New histories only. Existing snapshots, identities and orders are not rewritten.
CREATE TABLE detail_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('copy','world','place','persona')),
 entity_id uuid, world_id uuid REFERENCES worlds(id), head_revision_id uuid, published_id uuid, submitted_revision_id uuid,
 UNIQUE NULLS NOT DISTINCT(kind,entity_id)
);
CREATE TABLE detail_setting_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_id uuid NOT NULL REFERENCES detail_settings(id),
 body jsonb NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,setting_id)
);
CREATE TABLE detail_setting_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_id uuid NOT NULL REFERENCES detail_settings(id), revision_id uuid NOT NULL,
 published_by uuid NOT NULL REFERENCES users(id), published_at timestamptz NOT NULL DEFAULT now(), restored_from uuid REFERENCES detail_setting_publications(id),
 FOREIGN KEY(revision_id,setting_id) REFERENCES detail_setting_revisions(id,setting_id), UNIQUE(id,setting_id)
);
ALTER TABLE detail_settings ADD FOREIGN KEY(head_revision_id,id) REFERENCES detail_setting_revisions(id,setting_id);
ALTER TABLE detail_settings ADD FOREIGN KEY(submitted_revision_id,id) REFERENCES detail_setting_revisions(id,setting_id);
ALTER TABLE detail_settings ADD FOREIGN KEY(published_id,id) REFERENCES detail_setting_publications(id,setting_id);
CREATE TABLE detail_setting_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_id uuid NOT NULL REFERENCES detail_settings(id),
 actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, revision_id uuid REFERENCES detail_setting_revisions(id),
 note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER detail_revision_immutable BEFORE UPDATE OR DELETE ON detail_setting_revisions FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER detail_publication_immutable BEFORE UPDATE OR DELETE ON detail_setting_publications FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER detail_event_immutable BEFORE UPDATE OR DELETE ON detail_setting_events FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE INDEX admin_content_parent ON contents(world_id,parent_content_id,id);
-- Review/restore metadata for the existing home configuration authority.
ALTER TABLE world_home_settings ADD COLUMN submitted_revision_id uuid;
ALTER TABLE world_home_settings ADD FOREIGN KEY(submitted_revision_id,world_id) REFERENCES world_home_revisions(id,world_id);
