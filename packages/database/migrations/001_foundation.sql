CREATE TABLE locales (
  code text PRIMARY KEY, name text NOT NULL, enabled boolean NOT NULL DEFAULT true,
  required_for_publish boolean NOT NULL DEFAULT false
);
INSERT INTO locales (code, name, required_for_publish) VALUES ('en', 'English', true), ('zh-CN', '简体中文', true);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text NOT NULL, site_role text NOT NULL DEFAULT 'user' CHECK (site_role IN ('user', 'admin')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claimed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid REFERENCES users(id), guest_id uuid REFERENCES guests(id),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL)::int + (guest_id IS NOT NULL)::int = 1)
);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE fandoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, names jsonb NOT NULL
);
CREATE TABLE worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
  fandom_id uuid REFERENCES fandoms(id), owner_id uuid NOT NULL REFERENCES users(id),
  source_locale text NOT NULL REFERENCES locales(code), translations jsonb NOT NULL,
  theme_id text NOT NULL DEFAULT 'lime', site_blocked boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE world_members (
  world_id uuid NOT NULL REFERENCES worlds(id), user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'editor')), PRIMARY KEY (world_id, user_id)
);
CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), world_id uuid NOT NULL REFERENCES worlds(id),
  slug text NOT NULL, names jsonb NOT NULL, UNIQUE(world_id, slug), UNIQUE(id, world_id)
);
CREATE TABLE personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id),
  profiles jsonb NOT NULL, approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE glossaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), world_id uuid NOT NULL REFERENCES worlds(id),
  version integer NOT NULL CHECK (version > 0), entries jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(world_id, version)
);

CREATE TABLE contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), world_id uuid NOT NULL REFERENCES worlds(id),
  kind text NOT NULL CHECK (kind IN ('stay', 'experience', 'review')),
  slug text NOT NULL, place_id uuid, parent_content_id uuid, persona_id uuid REFERENCES personas(id),
  author_id uuid NOT NULL REFERENCES users(id), head_revision_id uuid,
  published_publication_id uuid, site_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(world_id, kind, slug), UNIQUE(id, world_id),
  FOREIGN KEY (place_id, world_id) REFERENCES places(id, world_id),
  FOREIGN KEY (parent_content_id, world_id) REFERENCES contents(id, world_id),
  CHECK ((kind = 'review') = (parent_content_id IS NOT NULL))
);
CREATE TABLE content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL REFERENCES contents(id),
  number integer NOT NULL CHECK (number > 0), source_locale text NOT NULL REFERENCES locales(code),
  source_text jsonb NOT NULL, attributes jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, number), UNIQUE(id, content_id)
);
ALTER TABLE contents ADD FOREIGN KEY (head_revision_id, id) REFERENCES content_revisions(id, content_id);
CREATE TABLE translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES content_revisions(id),
  locale text NOT NULL REFERENCES locales(code), body jsonb NOT NULL,
  origin text NOT NULL CHECK (origin IN ('source','manual','machine')),
  glossary_id uuid REFERENCES glossaries(id), created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id, revision_id, locale)
);
CREATE TABLE revision_locales (
  revision_id uuid NOT NULL REFERENCES content_revisions(id), locale text NOT NULL REFERENCES locales(code),
  translation_id uuid NOT NULL, PRIMARY KEY(revision_id, locale),
  FOREIGN KEY (translation_id, revision_id, locale) REFERENCES translations(id, revision_id, locale)
);
CREATE TABLE publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL REFERENCES contents(id),
  revision_id uuid NOT NULL, published_by uuid NOT NULL REFERENCES users(id),
  published_at timestamptz NOT NULL DEFAULT now(), restored_from uuid REFERENCES publications(id),
  FOREIGN KEY (revision_id, content_id) REFERENCES content_revisions(id, content_id),
  UNIQUE(id, content_id), UNIQUE(id, revision_id)
);
ALTER TABLE contents ADD FOREIGN KEY (published_publication_id, id) REFERENCES publications(id, content_id);
CREATE TABLE publication_locales (
  publication_id uuid NOT NULL, revision_id uuid NOT NULL, locale text NOT NULL,
  translation_id uuid NOT NULL, PRIMARY KEY(publication_id, locale),
  FOREIGN KEY (publication_id, revision_id) REFERENCES publications(id, revision_id),
  FOREIGN KEY (translation_id, revision_id, locale) REFERENCES translations(id, revision_id, locale)
);
CREATE TABLE moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid REFERENCES contents(id),
  revision_id uuid REFERENCES content_revisions(id), world_id uuid NOT NULL REFERENCES worlds(id),
  actor_id uuid NOT NULL REFERENCES users(id), action text NOT NULL, note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_world_kind ON contents(world_id, kind);
CREATE INDEX content_parent ON contents(parent_content_id);
CREATE INDEX revision_history ON content_revisions(content_id, number DESC);

CREATE TABLE translation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES content_revisions(id),
  locale text NOT NULL REFERENCES locales(code), glossary_id uuid REFERENCES glossaries(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed','superseded')),
  attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, leased_until timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(revision_id, locale)
);
CREATE INDEX translation_job_queue ON translation_jobs(status, available_at);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), world_id uuid NOT NULL REFERENCES worlds(id),
  source text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_items (
  world_id uuid NOT NULL REFERENCES worlds(id), source text NOT NULL, external_id text NOT NULL,
  content_id uuid NOT NULL REFERENCES contents(id), payload_hash text NOT NULL,
  batch_id uuid NOT NULL REFERENCES import_batches(id), PRIMARY KEY(world_id, source, external_id)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guest_id uuid REFERENCES guests(id), user_id uuid REFERENCES users(id),
  persona_id uuid REFERENCES personas(id), content_id uuid NOT NULL REFERENCES contents(id),
  publication_id uuid NOT NULL REFERENCES publications(id), locale text NOT NULL REFERENCES locales(code),
  idempotency_key uuid NOT NULL, request_hash text NOT NULL, snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(guest_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE UNIQUE INDEX booking_guest_idempotency ON bookings(guest_id, idempotency_key) WHERE guest_id IS NOT NULL;
CREATE UNIQUE INDEX booking_user_idempotency ON bookings(user_id, idempotency_key) WHERE user_id IS NOT NULL;
CREATE INDEX bookings_guest ON bookings(guest_id, created_at DESC);

-- Published snapshots and version bodies are append-only. Moderation can change only revision status.
CREATE FUNCTION keep_revision_body() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Revision bodies are immutable; create a new revision';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER revision_body_immutable BEFORE UPDATE ON content_revisions FOR EACH ROW EXECUTE FUNCTION keep_revision_body();
CREATE FUNCTION forbid_snapshot_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable'; END $$;
CREATE TRIGGER translation_immutable BEFORE UPDATE OR DELETE ON translations FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER publication_immutable BEFORE UPDATE OR DELETE ON publications FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
CREATE TRIGGER publication_locale_immutable BEFORE UPDATE OR DELETE ON publication_locales FOR EACH ROW EXECUTE FUNCTION forbid_snapshot_change();
