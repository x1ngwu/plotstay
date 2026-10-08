-- Refuse ambiguous legacy identities without deleting or rewriting any history.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM contents WHERE kind='review' AND persona_id IS NOT NULL GROUP BY persona_id,parent_content_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Duplicate legacy persona reviews require explicit reconciliation before migration';
 END IF;
END $$;
CREATE UNIQUE INDEX one_persona_review ON contents(persona_id,parent_content_id) WHERE kind='review' AND persona_id IS NOT NULL;
ALTER TABLE personas ADD COLUMN disabled boolean NOT NULL DEFAULT false;
CREATE TABLE persona_revision_decisions (
 revision_id uuid PRIMARY KEY REFERENCES detail_setting_revisions(id),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')), actor_id uuid NOT NULL REFERENCES users(id),
 note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER persona_decision_immutable BEFORE UPDATE OR DELETE ON persona_revision_decisions FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
-- Existing approved published profiles keep their approval; old rows stay untouched.
INSERT INTO persona_revision_decisions(revision_id,decision,actor_id,note)
 SELECT DISTINCT p.revision_id,'approved',p.published_by,'Existing approved profile' FROM detail_settings s
 JOIN detail_setting_publications p ON p.id=s.published_id JOIN personas person ON person.id=s.entity_id
 WHERE s.kind='persona' AND person.approved;
CREATE TABLE review_signatures (
 revision_id uuid PRIMARY KEY REFERENCES content_revisions(id), persona_id uuid NOT NULL REFERENCES personas(id),
 persona_revision_id uuid REFERENCES detail_setting_revisions(id), profiles jsonb NOT NULL,
 managed boolean NOT NULL DEFAULT true
);
INSERT INTO review_signatures(revision_id,persona_id,profiles,managed)
 SELECT r.id,c.persona_id,p.profiles,false FROM content_revisions r JOIN contents c ON c.id=r.content_id
 JOIN personas p ON p.id=c.persona_id WHERE c.kind='review';
CREATE TRIGGER review_signature_immutable BEFORE UPDATE OR DELETE ON review_signatures FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
-- Explicit provider assignment is separate from immutable historical content identity.
CREATE TABLE provider_bindings (
 content_id uuid PRIMARY KEY REFERENCES contents(id), persona_id uuid NOT NULL REFERENCES personas(id),
 assigned_by uuid NOT NULL REFERENCES users(id), assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE provider_binding_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),content_id uuid NOT NULL REFERENCES contents(id),
 persona_id uuid NOT NULL REFERENCES personas(id),actor_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER provider_binding_event_immutable BEFORE UPDATE OR DELETE ON provider_binding_events FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TABLE review_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid NOT NULL UNIQUE REFERENCES contents(id),
 head_revision_id uuid,published_id uuid,hidden boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reply_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reply_id uuid NOT NULL REFERENCES review_replies(id),
 persona_id uuid NOT NULL REFERENCES personas(id),persona_revision_id uuid NOT NULL REFERENCES detail_setting_revisions(id),
 profiles jsonb NOT NULL,body jsonb NOT NULL,source_locale text NOT NULL REFERENCES locales(code),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,reply_id)
);
CREATE TABLE reply_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reply_id uuid NOT NULL REFERENCES review_replies(id),
 revision_id uuid NOT NULL REFERENCES reply_revisions(id),action text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id),note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reply_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reply_id uuid NOT NULL REFERENCES review_replies(id),revision_id uuid NOT NULL,
 published_by uuid NOT NULL REFERENCES users(id),published_at timestamptz NOT NULL DEFAULT now(),
 restored_from uuid REFERENCES reply_publications(id),UNIQUE(id,reply_id),
 FOREIGN KEY(revision_id,reply_id) REFERENCES reply_revisions(id,reply_id)
);
ALTER TABLE review_replies ADD FOREIGN KEY(head_revision_id,id) REFERENCES reply_revisions(id,reply_id);
ALTER TABLE review_replies ADD FOREIGN KEY(published_id,id) REFERENCES reply_publications(id,reply_id);
CREATE TRIGGER reply_revision_immutable BEFORE UPDATE OR DELETE ON reply_revisions FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER reply_event_immutable BEFORE UPDATE OR DELETE ON reply_events FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER reply_publication_immutable BEFORE UPDATE OR DELETE ON reply_publications FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
