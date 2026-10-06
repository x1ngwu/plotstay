-- Additive upgrade: existing identities, revisions and publication snapshots are untouched.
ALTER TABLE contents DROP CONSTRAINT contents_kind_check;
ALTER TABLE contents ADD CONSTRAINT contents_kind_check CHECK (kind IN ('stay','experience','service','review'));

CREATE TABLE world_home_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), world_id uuid NOT NULL REFERENCES worlds(id),
  body jsonb NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,world_id)
);
CREATE TABLE world_home_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), world_id uuid NOT NULL REFERENCES worlds(id), revision_id uuid NOT NULL,
  published_by uuid NOT NULL REFERENCES users(id), published_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(revision_id,world_id) REFERENCES world_home_revisions(id,world_id), UNIQUE(id,world_id)
);
CREATE TABLE world_home_settings (
  world_id uuid PRIMARY KEY REFERENCES worlds(id), head_revision_id uuid NOT NULL, published_id uuid,
  FOREIGN KEY(head_revision_id,world_id) REFERENCES world_home_revisions(id,world_id),
  FOREIGN KEY(published_id,world_id) REFERENCES world_home_publications(id,world_id)
);
CREATE TRIGGER home_revision_immutable BEFORE UPDATE OR DELETE ON world_home_revisions FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER home_publication_immutable BEFORE UPDATE OR DELETE ON world_home_publications FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE INDEX content_place_browse ON contents(world_id,place_id,id);
