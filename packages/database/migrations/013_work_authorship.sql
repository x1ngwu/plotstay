-- Ordinary participation grants no world management capability. No legacy ownership guesses.
CREATE TABLE world_participations (
 world_id uuid NOT NULL REFERENCES worlds(id), user_id uuid NOT NULL REFERENCES users(id),
 joined boolean NOT NULL, recorded_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(world_id,user_id)
);
CREATE TABLE work_eligibilities (
 world_id uuid NOT NULL REFERENCES worlds(id),user_id uuid NOT NULL REFERENCES users(id),
 status text NOT NULL CHECK(status IN ('approved','revoked')),epoch integer NOT NULL DEFAULT 1 CHECK(epoch>0),
 updated_by uuid NOT NULL REFERENCES users(id),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(world_id,user_id)
);
CREATE TABLE work_access_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),world_id uuid NOT NULL REFERENCES worlds(id),user_id uuid NOT NULL REFERENCES users(id),
 actor_id uuid NOT NULL REFERENCES users(id),action text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER work_access_event_immutable BEFORE UPDATE OR DELETE ON work_access_events FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TABLE work_ownership (
 content_id uuid PRIMARY KEY REFERENCES contents(id),owner_id uuid NOT NULL REFERENCES users(id),
 source text NOT NULL CHECK(source IN ('self_create','audited')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER work_owner_immutable BEFORE UPDATE OR DELETE ON work_ownership FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE INDEX work_owner_lookup ON work_ownership(owner_id,content_id);
CREATE TABLE work_provider_locks (
 content_id uuid PRIMARY KEY REFERENCES contents(id),locked_at timestamptz NOT NULL,reason text NOT NULL
);
CREATE TRIGGER work_provider_lock_immutable BEFORE UPDATE OR DELETE ON work_provider_locks FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
INSERT INTO work_provider_locks(content_id,locked_at,reason)
 SELECT c.id,min(e.at),'historical_success' FROM contents c JOIN (
 SELECT content_id,created_at AS at FROM moderation_events WHERE action IN ('submitted','published','restored')
 UNION ALL SELECT content_id,published_at FROM publications
 ) e ON e.content_id=c.id WHERE c.kind IN ('stay','service','experience') GROUP BY c.id;
CREATE TABLE work_submission_eligibilities (
 content_id uuid NOT NULL REFERENCES contents(id),revision_id uuid NOT NULL REFERENCES content_revisions(id),
 epoch integer NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(content_id,revision_id)
);
-- This table is a current submission validity record; immutable audit events remain separate.
CREATE TABLE work_save_requests (
 actor_id uuid NOT NULL REFERENCES users(id),request_id uuid NOT NULL,payload_hash text NOT NULL,
 result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id)
);
CREATE TRIGGER work_save_request_immutable BEFORE UPDATE OR DELETE ON work_save_requests FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE INDEX work_saved_events ON moderation_events(content_id,created_at DESC) WHERE action IN ('draft_saved','translation_saved','provider_saved');
-- Database guard also protects old bindings and direct publication/submission paths.
CREATE FUNCTION guard_work_provider() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
 target=CASE WHEN TG_OP='DELETE' THEN OLD.content_id ELSE NEW.content_id END;
 PERFORM 1 FROM contents WHERE id=target FOR UPDATE;
 IF TG_OP='UPDATE' AND NEW.content_id<>OLD.content_id THEN RAISE EXCEPTION 'Binding identity cannot change'; END IF;
 IF TG_OP='UPDATE' AND NEW.persona_id=OLD.persona_id THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM work_provider_locks WHERE content_id=target) THEN RAISE EXCEPTION 'PROVIDER_LOCKED' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER work_provider_guard BEFORE INSERT OR UPDATE OR DELETE ON provider_bindings FOR EACH ROW EXECUTE FUNCTION guard_work_provider();
CREATE FUNCTION remember_work_provider_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; stamp timestamptz;
BEGIN
 IF TG_TABLE_NAME='publications' THEN target=NEW.content_id;stamp=NEW.published_at;
 ELSIF NEW.action IN ('submitted','published','restored') THEN target=NEW.content_id;stamp=NEW.created_at;
 ELSE RETURN NEW;END IF;
 PERFORM 1 FROM contents WHERE id=target FOR UPDATE;
 IF EXISTS(SELECT 1 FROM contents WHERE id=target AND kind IN ('stay','service','experience')) THEN
 INSERT INTO work_provider_locks(content_id,locked_at,reason) VALUES(target,stamp,TG_TABLE_NAME) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER work_lock_event AFTER INSERT ON moderation_events FOR EACH ROW EXECUTE FUNCTION remember_work_provider_lock();
CREATE TRIGGER work_lock_publication AFTER INSERT ON publications FOR EACH ROW EXECUTE FUNCTION remember_work_provider_lock();
