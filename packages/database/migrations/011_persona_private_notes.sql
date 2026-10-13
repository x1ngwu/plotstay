-- Private notes never enter shared profile revisions, decisions or signatures.
CREATE TABLE persona_private_notes (
 persona_id uuid PRIMARY KEY REFERENCES personas(id),
 body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
 version uuid NOT NULL DEFAULT gen_random_uuid(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 request_id uuid NOT NULL,
 request_hash text NOT NULL
);
-- Store only public command fingerprints/results to make retries (including creation) safe.
CREATE TABLE persona_profile_commands (
 actor_id uuid NOT NULL REFERENCES users(id),
 request_id uuid NOT NULL,
 request_hash text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
CREATE INDEX persona_revision_history ON detail_setting_revisions(setting_id,created_at DESC,id);
