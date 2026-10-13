-- Personal reviews and legacy notes share fixed review submission semantics.
ALTER TABLE contents ADD COLUMN submitted_revision_id uuid,
 ADD COLUMN submission_token uuid;
ALTER TABLE contents ADD FOREIGN KEY (submitted_revision_id,id) REFERENCES content_revisions(id,content_id);
CREATE OR REPLACE FUNCTION keep_content_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW) - ARRAY['head_revision_id','published_publication_id','site_blocked','draft_token','submitted_revision_id','submission_token'])
 IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['head_revision_id','published_publication_id','site_blocked','draft_token','submitted_revision_id','submission_token']) THEN
 RAISE EXCEPTION 'Content identity is immutable; edit through revisions'; END IF;
 RETURN NEW;
END $$;
CREATE TABLE review_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_id uuid NOT NULL REFERENCES contents(id),
 revision_id uuid NOT NULL,
 draft_token uuid NOT NULL,
 submitted_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(revision_id,content_id) REFERENCES content_revisions(id,content_id),
 UNIQUE(id,content_id,revision_id), UNIQUE(id,revision_id)
);
CREATE TABLE review_submission_locales (
 submission_id uuid NOT NULL REFERENCES review_submissions(id),
 revision_id uuid NOT NULL, locale text NOT NULL,
 translation_id uuid NOT NULL,
 PRIMARY KEY(submission_id,locale),
 FOREIGN KEY(submission_id,revision_id) REFERENCES review_submissions(id,revision_id),
 FOREIGN KEY(translation_id,revision_id,locale) REFERENCES translations(id,revision_id,locale)
);
-- Select the latest explicit submission, even if a later draft exists. Never resurrect
-- an earlier orphan submission after the most recent one has been decided.
INSERT INTO review_submissions(content_id,revision_id,draft_token,submitted_by,created_at)
 SELECT c.id,e.revision_id,c.draft_token,e.actor_id,e.created_at
 FROM contents c CROSS JOIN LATERAL (
  SELECT * FROM moderation_events WHERE content_id=c.id AND action='submitted'
  ORDER BY created_at DESC,id DESC LIMIT 1
 ) e JOIN content_revisions r ON r.id=e.revision_id
 WHERE c.kind='review' AND r.status='submitted'
 AND NOT EXISTS(SELECT 1 FROM moderation_events d WHERE d.revision_id=e.revision_id
  AND d.action IN ('published','rejected') AND d.created_at>=e.created_at);
INSERT INTO review_submission_locales SELECT s.id,l.revision_id,l.locale,l.translation_id
 FROM review_submissions s JOIN revision_locales l ON l.revision_id=s.revision_id;
UPDATE contents c SET submitted_revision_id=s.revision_id,submission_token=s.id
 FROM review_submissions s WHERE c.id=s.content_id;
ALTER TABLE contents ADD FOREIGN KEY(submission_token,id,submitted_revision_id)
 REFERENCES review_submissions(id,content_id,revision_id);
ALTER TABLE contents ADD CHECK((submitted_revision_id IS NULL)=(submission_token IS NULL));
CREATE TRIGGER review_submission_immutable BEFORE UPDATE OR DELETE ON review_submissions FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER review_submission_locale_immutable BEFORE UPDATE OR DELETE ON review_submission_locales FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();

ALTER TABLE review_replies ADD COLUMN submitted_revision_id uuid;
ALTER TABLE review_replies ADD FOREIGN KEY(submitted_revision_id,id) REFERENCES reply_revisions(id,reply_id);
UPDATE review_replies r SET submitted_revision_id=e.revision_id FROM (
 SELECT DISTINCT ON(reply_id) reply_id,revision_id,action FROM reply_events
 WHERE action IN ('submit','publish','reject') ORDER BY reply_id,created_at DESC,id DESC
) e WHERE e.reply_id=r.id AND e.action='submit';
CREATE TABLE review_save_commands (
 actor_id uuid NOT NULL REFERENCES users(id), request_id uuid NOT NULL,
 request_hash text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
CREATE INDEX review_event_activity ON moderation_events(content_id,created_at DESC,id DESC);
CREATE INDEX reply_event_activity ON reply_events(reply_id,created_at DESC,id DESC);
CREATE INDEX reply_author_history ON reply_revisions(created_by,reply_id,created_at DESC);
CREATE INDEX review_pending ON contents(submitted_revision_id) WHERE submitted_revision_id IS NOT NULL;

CREATE INDEX reply_revision_event_activity ON reply_events(revision_id,created_at DESC,id DESC);
ALTER TABLE contents ADD CHECK(kind='review' OR submitted_revision_id IS NULL);
