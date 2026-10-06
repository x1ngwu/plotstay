ALTER TABLE translation_jobs ADD COLUMN provider text NOT NULL DEFAULT 'disabled';
ALTER TABLE translation_jobs ADD COLUMN configuration jsonb NOT NULL DEFAULT '{}';
ALTER TABLE translation_jobs ADD COLUMN max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10);
CREATE INDEX translation_job_lease ON translation_jobs(leased_until) WHERE status='running';

-- A translation may change without creating another source revision. Editors must
-- also compare this token so a stale form cannot discard somebody else's translation.
ALTER TABLE contents ADD COLUMN draft_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE OR REPLACE FUNCTION keep_content_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['head_revision_id','published_publication_id','site_blocked','draft_token'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['head_revision_id','published_publication_id','site_blocked','draft_token']) THEN
    RAISE EXCEPTION 'Content identity is immutable; edit through revisions';
  END IF;
  RETURN NEW;
END $$;
