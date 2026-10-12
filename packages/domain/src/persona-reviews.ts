import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction, type Database, type Connection } from '@plotstay/database';
import { sharedPersonaSchema, textSchema, reviewRatingsSchema, idSchema } from '@plotstay/contracts';
import { type Actor, requireWorld, hashPassword } from './auth.ts';
import { assert } from './errors.ts';
import { appendRevision } from './content.ts';
import { getPublished } from './read.ts';

const profilesSchema = sharedPersonaSchema.refine((b) => Object.keys(b).length > 0, 'Add a profile language');
const reviewBody = z
  .object({
    sourceLocale: z.enum(['en', 'zh-CN']),
    texts: z.record(
      z.string(),
      z
        .object({
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().min(1).max(20000),
          origin: z.string().max(200).default(''),
          stayDuration: z.string().max(200).default(''),
          tags: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
        })
        .strict(),
    ),
    rating: z.number().int().min(1).max(5).nullable().default(null),
    reviewRatings: reviewRatingsSchema.default({}),
  })
  .strict();
function validateLanguages(body: Record<string, unknown>, source?: string) {
  assert(
    Object.keys(body).every((l) => ['en', 'zh-CN'].includes(l)) && (!source || body[source]),
    400,
    'INVALID_LOCALE',
    'Use Chinese or English and complete the source language.',
  );
}
export function signatureProfiles(body: any) {
  return Object.fromEntries(
    Object.entries(body).map(([locale, raw]) => {
      const p = raw as any;
      const color = ({ mint: '#b8f264', amber: '#ffd36e', violet: '#c9b0ff', sky: '#a4ddf5' } as any)[
        p.avatar ?? 'mint'
      ];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/><circle cx="32" cy="23" r="11" fill="#26332b"/><path d="M12 58V46q20-23 40 0v12" fill="#26332b"/></svg>`;
      return [
        locale,
        { ...p, avatarImage: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') },
      ];
    }),
  );
}
async function ownPersona(db: Connection, actor: Actor, id: string, lock = false) {
  const p = (await db.query(`SELECT * FROM personas WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  assert(p && p.owner_id === actor.id, 403, 'PERSONA_FORBIDDEN', 'Choose your own persona.');
  assert(!p.disabled, 403, 'PERSONA_DISABLED', 'This persona is disabled.');
  return p;
}
async function ensureSetting(db: Connection, p: any) {
  let s = (
    await db.query("SELECT * FROM detail_settings WHERE kind='persona' AND entity_id=$1 FOR UPDATE", [p.id])
  ).rows[0];
  if (!s) {
    s = (
      await db.query("INSERT INTO detail_settings(kind,entity_id)VALUES('persona',$1) RETURNING *", [p.id])
    ).rows[0];
    const r = (
      await db.query(
        'INSERT INTO detail_setting_revisions(setting_id,body,created_by)VALUES($1,$2,$3)RETURNING id',
        [s.id, p.profiles, p.owner_id],
      )
    ).rows[0];
    await db.query('UPDATE detail_settings SET head_revision_id=$2 WHERE id=$1', [s.id, r.id]);
    s.head_revision_id = r.id;
    if (p.approved)
      await db.query(
        "INSERT INTO persona_revision_decisions(revision_id,decision,actor_id,note)VALUES($1,'approved',$2,'Existing approved profile')",
        [r.id, p.owner_id],
      );
  }
  return s;
}
export async function myPersonas(db: Connection, actor: Actor) {
  const rows = (
    await db.query(
      `SELECT p.id,p.disabled,s.id AS setting_id,s.head_revision_id,s.submitted_revision_id,
 r.body AS draft,sr.body AS submitted,p.profiles AS published,
 d.decision,d.note,pd.decision AS submitted_decision,pd.note AS submitted_note,
 pub.revision_id AS published_revision_id
 FROM personas p LEFT JOIN detail_settings s ON s.kind='persona' AND s.entity_id=p.id
 LEFT JOIN detail_setting_revisions r ON r.id=s.head_revision_id
 LEFT JOIN detail_setting_revisions sr ON sr.id=s.submitted_revision_id
 LEFT JOIN persona_revision_decisions d ON d.revision_id=r.id
 LEFT JOIN persona_revision_decisions pd ON pd.revision_id=s.submitted_revision_id
 LEFT JOIN detail_setting_publications pub ON pub.id=s.published_id
 WHERE p.owner_id=$1 ORDER BY p.created_at,p.id`,
      [actor.id],
    )
  ).rows;
  return rows.map((p) => ({ ...p, preview_profiles: signatureProfiles(p.draft ?? p.published) }));
}
export function savePersona(
  db: Database,
  actor: Actor,
  raw: unknown,
  id?: string,
  baseRevisionId?: string | null,
) {
  return transaction(db, async (c) => {
    const body = profilesSchema.parse(raw);
    validateLanguages(body);
    let p;
    if (id) {
      p = await ownPersona(c, actor, id, true);
    } else
      p = (await c.query('INSERT INTO personas(owner_id,profiles)VALUES($1,$2)RETURNING *', [actor.id, {}]))
        .rows[0];
    const s = await ensureSetting(c, p);
    assert(
      !id || s.head_revision_id === baseRevisionId,
      409,
      'REVISION_CONFLICT',
      'Persona changed. Your input is preserved; reload before saving.',
    );
    const r = (
      await c.query(
        'INSERT INTO detail_setting_revisions(setting_id,body,created_by)VALUES($1,$2,$3)RETURNING id',
        [s.id, body, actor.id],
      )
    ).rows[0];
    await c.query('UPDATE detail_settings SET head_revision_id=$2 WHERE id=$1', [
      s.id,
      r.id,
    ]);
    await c.query(
      "INSERT INTO detail_setting_events(setting_id,actor_id,action,revision_id)VALUES($1,$2,'draft_saved',$3)",
      [s.id, actor.id, r.id],
    );
    return { id: p.id, revisionId: r.id };
  });
}
async function personaSnapshot(c: Connection, actor: Actor, id: string) {
  const p = await ownPersona(c, actor, id, true),
    s = await ensureSetting(c, p);
  const r = (await c.query('SELECT * FROM detail_setting_revisions WHERE id=$1', [s.head_revision_id]))
    .rows[0];
  profilesSchema.parse(r.body);
  return { revisionId: r.id, profiles: signatureProfiles(r.body), settingId: s.id };
}
export async function reviewDetail(db: Connection, actor: Actor, id: string, moderate = false) {
  const c = (
    await db.query(
      "SELECT c.*,parent.slug AS target_slug,parent.kind AS target_kind,w.slug AS world_slug FROM contents c JOIN contents parent ON parent.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id WHERE c.id=$1 AND c.kind='review'",
      [id],
    )
  ).rows[0];
  assert(c, 404, 'NOT_FOUND', 'Review not found.');
  if (moderate) await requireWorld(db, actor, c.world_id, true);
  else assert(c.author_id === actor.id, 403, 'REVIEW_FORBIDDEN', 'This review belongs to another account.');
  const revisions = (
    await db.query(
      `SELECT r.*,s.persona_revision_id,s.profiles,s.managed,d.decision AS persona_decision,d.note AS persona_note,
 coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM revision_locales l JOIN translations t ON t.id=l.translation_id WHERE l.revision_id=r.id),'{}') AS texts
 FROM content_revisions r LEFT JOIN review_signatures s ON s.revision_id=r.id LEFT JOIN persona_revision_decisions d ON d.revision_id=s.persona_revision_id WHERE r.content_id=$1 ORDER BY r.number DESC`,
      [id],
    )
  ).rows;
  const events = (
    await db.query(
      'SELECT action,note,created_at FROM moderation_events WHERE content_id=$1 ORDER BY created_at DESC',
      [id],
    )
  ).rows;
  const publications = (
    await db.query(
      'SELECT id,revision_id,published_at FROM publications WHERE content_id=$1 ORDER BY published_at DESC',
      [id],
    )
  ).rows;
  return { content: c, revisions, events, publications };
}
export async function myReviews(db: Connection, actor: Actor, page = 1) {
  const {
    rows: [r],
  } = await db.query(
    `WITH entries AS(SELECT c.id,c.persona_id,c.published_publication_id,r.status,r.source_text->>'title' AS title,(SELECT s.profiles FROM review_signatures s WHERE s.revision_id=r.id) AS profiles,r.source_text->'review'->>'name' AS legacy_name,p.slug AS target_slug,p.kind AS target_kind,w.slug AS world_slug,r.created_at FROM contents c JOIN contents p ON p.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.kind='review' AND c.author_id=$1) SELECT (SELECT count(*)::int FROM entries) AS total,coalesce((SELECT jsonb_agg(e) FROM(SELECT * FROM entries ORDER BY created_at DESC,id LIMIT 20 OFFSET $2)e),'[]') AS items`,
    [actor.id, (page - 1) * 20],
  );
  return { ...r, page, pages: Math.max(1, Math.ceil(r.total / 20)) };
}
export function startReview(db: Database, actor: Actor, parentId: string, personaId: string) {
  return transaction(db, async (c) => {
    await ownPersona(c, actor, personaId, true);
    const parent = await getPublished(c, 'en', { id: parentId });
    assert(
      parent && parent.kind !== 'review',
      404,
      'NOT_FOUND',
      'Choose a published entry in a visible world.',
    );
    const old = (
      await c.query(
        "SELECT id,author_id FROM contents WHERE kind='review' AND parent_content_id=$1 AND persona_id=$2",
        [parentId, personaId],
      )
    ).rows[0];
    if (old) {
      assert(
        old.author_id === actor.id,
        409,
        'LEGACY_REVIEW',
        'This legacy review is maintained by its original author.',
      );
      return { id: old.id, created: false };
    }
    const s = await personaSnapshot(c, actor, personaId);
    const entry = (
      await c.query(
        "INSERT INTO contents(world_id,kind,slug,parent_content_id,persona_id,author_id)VALUES($1,'review',$2,$3,$4,$5)RETURNING *",
        [parent.worldId, 'persona-' + randomUUID(), parentId, personaId, actor.id],
      )
    ).rows[0];
    const source = Object.keys(s.profiles)[0]!;
    const revision = await appendRevision(
      c,
      actor,
      entry,
      {
        sourceLocale: source,
        text: textSchema.parse({
          title: source === 'en' ? 'My review' : '我的评价',
          description: source === 'en' ? 'Draft' : '草稿',
        }),
        translations: {},
        attributes: { images: [] },
      },
      false,
    );
    await c.query(
      'INSERT INTO review_signatures(revision_id,persona_id,persona_revision_id,profiles)VALUES($1,$2,$3,$4)',
      [revision.id, personaId, s.revisionId, s.profiles],
    );
    return { id: entry.id, created: true };
  });
}
export function saveReview(db: Database, actor: Actor, id: string, baseRevisionId: string, raw: unknown) {
  return transaction(db, async (c) => {
    const input = reviewBody.parse(raw);
    validateLanguages(input.texts, input.sourceLocale);
    const entry = (await c.query("SELECT * FROM contents WHERE id=$1 AND kind='review' FOR UPDATE", [id]))
      .rows[0];
    assert(
      entry && entry.author_id === actor.id,
      403,
      'REVIEW_FORBIDDEN',
      'Only the author can edit this review.',
    );
    assert(
      entry.head_revision_id === baseRevisionId,
      409,
      'REVISION_CONFLICT',
      'Review changed. Your input is preserved.',
    );
    const parent = await getPublished(c, input.sourceLocale, { id: entry.parent_content_id });
    assert(parent, 409, 'TARGET_UNAVAILABLE', 'The entry is not accepting reviews.');
    const s = await personaSnapshot(c, actor, entry.persona_id);
    const texts = Object.fromEntries(
      Object.entries(input.texts).map(([locale, t]) => [
        locale,
        textSchema.parse({
          title: t.title,
          description: t.description,
          tags: t.tags,
          review: {
            name: (s.profiles[locale] ?? (Object.values(s.profiles)[0] as any)).name,
            origin: t.origin,
            stayDuration: t.stayDuration,
          },
        }),
      ]),
    );
    const translations = { ...texts };
    delete translations[input.sourceLocale];
    const revision = await appendRevision(
      c,
      actor,
      entry,
      {
        sourceLocale: input.sourceLocale,
        text: texts[input.sourceLocale]!,
        translations,
        attributes: {
          images: [],
          ...(input.rating === null ? {} : { rating: input.rating }),
          reviewRatings: input.reviewRatings,
        },
      },
      false,
    );
    await c.query(
      'INSERT INTO review_signatures(revision_id,persona_id,persona_revision_id,profiles)VALUES($1,$2,$3,$4)',
      [revision.id, entry.persona_id, s.revisionId, s.profiles],
    );
    return { id, revisionId: revision.id };
  });
}
export async function submitPersona(c: Connection, revisionId: string, actor: Actor) {
  const r = (await c.query('SELECT * FROM detail_setting_revisions WHERE id=$1', [revisionId])).rows[0];
  assert(r, 409, 'PROFILE_REQUIRED', 'Save a persona first.');
  const setting = (await c.query('SELECT * FROM detail_settings WHERE id=$1 FOR UPDATE', [r.setting_id])).rows[0];
  assert(setting?.kind === 'persona', 409, 'PROFILE_REQUIRED', 'Save a persona first.');
  const d = (
    await c.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1', [revisionId])
  ).rows[0];
  assert(
    d?.decision !== 'rejected',
    409,
    'PERSONA_REJECTED',
    'Edit the returned persona and save the review again.',
  );
  assert(d?.decision === 'approved' || setting.submitted_revision_id === revisionId || setting.head_revision_id === revisionId,
    409,'PROFILE_SIGNATURE_STALE','The profile submission changed. Save a new review or reply signature before submitting.');
  if (!d && setting.submitted_revision_id !== revisionId) {
    await c.query('UPDATE detail_settings SET submitted_revision_id=$2 WHERE id=$1', [
      r.setting_id,
      revisionId,
    ]);
    await c.query(
      "INSERT INTO detail_setting_events(setting_id,actor_id,action,revision_id)VALUES($1,$2,'submitted',$3)",
      [r.setting_id, actor.id, revisionId],
    );
  }
}
export function submitOwnPersona(db: Database, actor: Actor, id: string, revisionId: string) {
  return transaction(db, async c => {
    const p = await ownPersona(c, actor, id, true);
    const s = await ensureSetting(c, p);
    assert(s.head_revision_id === revisionId, 409, 'REVISION_CONFLICT', 'Submit the saved current profile.');
    const body = (await c.query('SELECT body FROM detail_setting_revisions WHERE id=$1', [revisionId])).rows[0]?.body;
    assert(body?.en && body?.['zh-CN'], 409, 'TRANSLATIONS_REQUIRED', 'Complete both profile languages.');
    const decided=(await c.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1',[revisionId])).rows[0];
    if(decided?.decision==='approved')return {submitted:false,alreadyApproved:true,revisionId};
    await submitPersona(c, revisionId, actor);
    return { submitted: true, revisionId };
  });
}
export async function personaQueue(db: Connection, actor: Actor, page = 1) {
  assert(actor.siteRole === 'admin', 403, 'SITE_ADMIN_REQUIRED', 'A site administrator reviews profiles.');
  const rows = (await db.query(`SELECT p.id AS persona_id,p.owner_id,u.email,s.submitted_revision_id AS revision_id,
    r.body,d.decision,d.note,e.created_at AS submitted_at
    FROM detail_settings s JOIN personas p ON p.id=s.entity_id JOIN users u ON u.id=p.owner_id
    JOIN detail_setting_revisions r ON r.id=s.submitted_revision_id
    LEFT JOIN persona_revision_decisions d ON d.revision_id=r.id
    LEFT JOIN LATERAL (SELECT created_at FROM detail_setting_events WHERE setting_id=s.id AND revision_id=r.id AND action='submitted' ORDER BY created_at DESC LIMIT 1) e ON true
    WHERE s.kind='persona' AND d.revision_id IS NULL
    ORDER BY e.created_at DESC,p.id LIMIT 21 OFFSET $1`, [(page-1)*20])).rows;
  return { items: rows.slice(0,20), page, hasNext: rows.length>20 };
}
export function submitReview(db: Database, actor: Actor, id: string, revisionId: string) {
  return transaction(db, async (c) => {
    const entry = (await c.query('SELECT * FROM contents WHERE id=$1 FOR UPDATE', [id])).rows[0];
    assert(
      entry && entry.kind === 'review' && entry.author_id === actor.id,
      403,
      'REVIEW_FORBIDDEN',
      'Only the author can submit this review.',
    );
    await ownPersona(c, actor, entry.persona_id, true);
    assert(
      entry.head_revision_id === revisionId,
      409,
      'REVISION_CONFLICT',
      'Submit the saved current review.',
    );
    assert(
      await getPublished(c, 'en', { id: entry.parent_content_id }),
      409,
      'TARGET_UNAVAILABLE',
      'The entry is not accepting reviews.',
    );
    const s = (await c.query('SELECT * FROM review_signatures WHERE revision_id=$1', [revisionId])).rows[0];
    assert(s?.persona_revision_id, 409, 'PROFILE_REQUIRED', 'Save this review with a persona first.');
    await submitPersona(c, s.persona_revision_id, actor);
    const r = await c.query(
      "UPDATE content_revisions SET status='submitted' WHERE id=$1 AND status IN ('draft','rejected','submitted') RETURNING id",
      [revisionId],
    );
    assert(r.rowCount, 409, 'REVISION_LOCKED', 'Save a new draft before submitting.');
    await c.query(
      "INSERT INTO moderation_events(content_id,revision_id,world_id,actor_id,action)VALUES($1,$2,$3,$4,'submitted')",
      [id, revisionId, entry.world_id, actor.id],
    );
    return { submitted: true };
  });
}
export async function approvePersonaVersion(
  c: Connection,
  actor: Actor,
  revisionId: string,
  decision: 'approved' | 'rejected',
  note = '',
) {
  assert(
    actor.siteRole === 'admin',
    403,
    'SITE_ADMIN_REQUIRED',
    'A site administrator reviews shared persona profiles.',
  );
  const r = (
    await c.query(
      "SELECT r.*,s.entity_id FROM detail_setting_revisions r JOIN detail_settings s ON s.id=r.setting_id WHERE r.id=$1 AND s.kind='persona'",
      [revisionId],
    )
  ).rows[0];
  assert(r, 404, 'NOT_FOUND', 'Profile version not found.');
  await c.query('SELECT id FROM personas WHERE id=$1 FOR UPDATE', [r.entity_id]);
  const current = (await c.query('SELECT submitted_revision_id FROM detail_settings WHERE id=$1 FOR UPDATE', [r.setting_id])).rows[0];
  const existing = (
    await c.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1', [revisionId])
  ).rows[0];
  if (existing) {
    assert(
      existing.decision === decision,
      409,
      'REVISION_LOCKED',
      'This profile decision is final. Save a new version.',
    );
    return;
  }
  assert(current?.submitted_revision_id === revisionId, 409, 'SUBMISSION_SUPERSEDED', 'This profile submission was replaced. Reopen the current request.');
  assert(
    (
      await c.query("SELECT 1 FROM detail_setting_events WHERE revision_id=$1 AND action='submitted'", [
        revisionId,
      ])
    ).rowCount,
    409,
    'NOT_SUBMITTED',
    'Profile version has not been submitted.',
  );
  if (decision === 'approved') {
    const body = profilesSchema.parse(r.body);
    validateLanguages(body);
    assert(
      body.en && body['zh-CN'],
      409,
      'TRANSLATIONS_REQUIRED',
      'Complete Chinese and English persona profiles.',
    );
  }
  await c.query(
    'INSERT INTO persona_revision_decisions(revision_id,decision,actor_id,note)VALUES($1,$2,$3,$4)',
    [revisionId, decision, actor.id, note],
  );
  await c.query('UPDATE detail_settings SET submitted_revision_id=NULL WHERE id=$1', [r.setting_id]);
  if (decision === 'approved') {
    const p = (
      await c.query(
        'INSERT INTO detail_setting_publications(setting_id,revision_id,published_by)VALUES($1,$2,$3)RETURNING id',
        [r.setting_id, revisionId, actor.id],
      )
    ).rows[0];
    // Approving an older fixed submission must not roll back a newer public profile.
    // Explicit profile restoration remains available through the settings history.
    const projected = await c.query(
      `UPDATE detail_settings s SET published_id=$2 WHERE s.id=$1
      AND NOT EXISTS(SELECT 1 FROM detail_setting_publications current_publication
        JOIN detail_setting_revisions current_revision ON current_revision.id=current_publication.revision_id
        JOIN detail_setting_revisions candidate ON candidate.id=$3
        WHERE current_publication.id=s.published_id AND current_revision.created_at>candidate.created_at)
      RETURNING s.id`,
      [r.setting_id, p.id, revisionId],
    );
    if (projected.rowCount)
      await c.query('UPDATE personas SET profiles=$2,approved=true WHERE id=$1', [r.entity_id, r.body]);
  }
  await c.query(
    'INSERT INTO detail_setting_events(setting_id,actor_id,action,revision_id,note)VALUES($1,$2,$3,$4,$5)',
    [r.setting_id, actor.id, decision, revisionId, note],
  );
}
export function moderatePersona(
  db: Database,
  actor: Actor,
  revisionId: string,
  decision: 'approved' | 'rejected',
  note: string,
) {
  return transaction(db, (c) => approvePersonaVersion(c, actor, revisionId, decision, note));
}
export async function validateReviewPublication(
  c: Connection,
  actor: Actor,
  content: any,
  revisionId: string,
) {
  if (!(await c.query("SELECT to_regclass('review_signatures') AS t")).rows[0].t) return; // Populated pre-008 upgrade fixtures remain constructible.
  const s = (await c.query('SELECT * FROM review_signatures WHERE revision_id=$1', [revisionId])).rows[0];
  if (!s?.managed) return;
  const persona = (await c.query('SELECT disabled FROM personas WHERE id=$1 FOR UPDATE', [s.persona_id]))
    .rows[0];
  assert(persona && !persona.disabled, 403, 'PERSONA_DISABLED', 'This persona is disabled.');
  assert(
    await getPublished(c, 'en', { id: content.parent_content_id }),
    409,
    'TARGET_UNAVAILABLE',
    'The parent entry is not visible.',
  );
  const d = (
    await c.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1', [
      s.persona_revision_id,
    ])
  ).rows[0];
  if (!d && actor.siteRole === 'admin')
    await approvePersonaVersion(c, actor, s.persona_revision_id, 'approved');
  else
    assert(
      d?.decision === 'approved',
      409,
      'PERSONA_APPROVAL_REQUIRED',
      'The submitted persona version needs site administrator approval.',
    );
}
export async function moderationQueue(db: Connection, actor: Actor, page = 1) {
  const rows = (
    await db.query(
      `SELECT c.id,c.world_id,c.persona_id,c.author_id,c.published_publication_id,r.id AS revision_id,r.status,r.source_text->>'title' AS title,p.slug AS target_slug,p.kind AS target_kind,w.slug AS world_slug,s.persona_revision_id,d.decision AS persona_decision,(SELECT e.action FROM review_replies q JOIN reply_events e ON e.revision_id=q.head_revision_id WHERE q.review_id=c.id ORDER BY e.created_at DESC,e.id DESC LIMIT 1) AS reply_status
 FROM contents c JOIN contents p ON p.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id JOIN content_revisions r ON r.id=c.head_revision_id LEFT JOIN review_signatures s ON s.revision_id=r.id LEFT JOIN persona_revision_decisions d ON d.revision_id=s.persona_revision_id
 WHERE c.kind='review' AND ($1 OR w.owner_id=$2 OR EXISTS(SELECT 1 FROM world_members m WHERE m.world_id=c.world_id AND m.user_id=$2 AND m.role IN ('owner','admin')))
 ORDER BY ((r.status='submitted') OR EXISTS(SELECT 1 FROM review_replies q WHERE q.review_id=c.id AND (SELECT e.action FROM reply_events e WHERE e.revision_id=q.head_revision_id ORDER BY e.created_at DESC,e.id DESC LIMIT 1)='submit')) DESC,r.created_at DESC,c.id LIMIT 21 OFFSET $3`,
      [actor.siteRole === 'admin', actor.id, (page - 1) * 20],
    )
  ).rows;
  return { items: rows.slice(0, 20), hasNext: rows.length > 20, page };
}
export function createAccount(db: Database, actor: Actor, raw: unknown) {
  assert(
    actor.siteRole === 'admin',
    403,
    'SITE_ADMIN_REQUIRED',
    'Only a site administrator can create accounts.',
  );
  const b = z
    .object({ email: z.email().max(254), password: z.string().min(12).max(200) })
    .strict()
    .parse(raw);
  return hashPassword(b.password).then(
    async (hash) =>
      (
        await db.query('INSERT INTO users(email,password_hash)VALUES($1,$2)RETURNING id,email,site_role', [
          b.email.toLowerCase(),
          hash,
        ])
      ).rows[0],
  );
}
export async function disablePersona(db: Database, actor: Actor, id: string, disabled: boolean) {
  assert(
    actor.siteRole === 'admin',
    403,
    'SITE_ADMIN_REQUIRED',
    'Only a site administrator can disable a persona.',
  );
  return transaction(db, async (c) => {
    const p = (await c.query('UPDATE personas SET disabled=$2 WHERE id=$1 RETURNING id', [id, disabled]))
      .rows[0];
    assert(p, 404, 'NOT_FOUND', 'Persona not found.');
    const s = (await c.query("SELECT * FROM detail_settings WHERE kind='persona' AND entity_id=$1", [id]))
      .rows[0];
    if (s)
      await c.query(
        'INSERT INTO detail_setting_events(setting_id,actor_id,action,revision_id)VALUES($1,$2,$3,$4)',
        [s.id, actor.id, disabled ? 'disabled' : 'enabled', s.head_revision_id],
      );
    return { disabled };
  });
}

export function bindProvider(db: Database, actor: Actor, contentId: string, personaId: string) {
  return transaction(db, async (c) => {
    const target = (
      await c.query(
        "SELECT * FROM contents WHERE id=$1 AND kind IN ('stay','experience','service') FOR UPDATE",
        [contentId],
      )
    ).rows[0];
    assert(target, 404, 'NOT_FOUND', 'Entry not found.');
    await requireWorld(c, actor, target.world_id, true);
    const p = (await c.query('SELECT * FROM personas WHERE id=$1 FOR UPDATE', [personaId])).rows[0];
    assert(
      p && p.approved && !p.disabled && (actor.siteRole === 'admin' || p.owner_id === actor.id),
      403,
      'PERSONA_FORBIDDEN',
      'Assign an approved persona you own, or ask a site administrator.',
    );
    await c.query(
      'INSERT INTO provider_bindings(content_id,persona_id,assigned_by)VALUES($1,$2,$3)ON CONFLICT(content_id)DO UPDATE SET persona_id=excluded.persona_id,assigned_by=excluded.assigned_by,assigned_at=now()',
      [contentId, personaId, actor.id],
    );
    await c.query('INSERT INTO provider_binding_events(content_id,persona_id,actor_id)VALUES($1,$2,$3)', [
      contentId,
      personaId,
      actor.id,
    ]);
    return { bound: true };
  });
}
async function providerFor(c: Connection, reviewId: string) {
  const r = (
    await c.query(
      `SELECT review.*,b.persona_id AS provider_id,p.owner_id AS provider_owner,p.disabled AS provider_disabled,p.profiles AS provider_profiles,parent.slug AS target_slug,parent.kind AS target_kind,w.slug AS world_slug FROM contents review JOIN contents parent ON parent.id=review.parent_content_id JOIN worlds w ON w.id=review.world_id LEFT JOIN provider_bindings b ON b.content_id=parent.id LEFT JOIN personas p ON p.id=b.persona_id WHERE review.id=$1 AND review.kind='review'`,
      [reviewId],
    )
  ).rows[0];
  assert(r, 404, 'NOT_FOUND', 'Review not found.');
  return r;
}
async function providerAccess(c: Connection, actor: Actor, reviewId: string) {
  const r = await providerFor(c, reviewId);
  assert(
    r.provider_owner === actor.id,
    403,
    'PROVIDER_FORBIDDEN',
    'Only the assigned provider persona owner may reply.',
  );
  assert(!r.provider_disabled, 403, 'PERSONA_DISABLED', 'This provider persona is disabled.');
  assert(
    await getPublished(c, 'en', { id: reviewId }),
    409,
    'TARGET_UNAVAILABLE',
    'Only a visible published review can receive replies.',
  );
  return r;
}
export async function replyDetail(db: Connection, actor: Actor, reviewId: string, moderate = false) {
  const target = moderate ? await providerFor(db, reviewId) : await providerAccess(db, actor, reviewId);
  if (moderate) await requireWorld(db, actor, target.world_id, true);
  const reply =
    (await db.query('SELECT * FROM review_replies WHERE review_id=$1', [reviewId])).rows[0] ?? null;
  const revisions = reply
    ? (
        await db.query(
          `SELECT r.*,coalesce((SELECT action FROM reply_events e WHERE e.revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1),'draft') AS status,d.decision AS persona_decision,d.note AS persona_note FROM reply_revisions r LEFT JOIN persona_revision_decisions d ON d.revision_id=r.persona_revision_id WHERE reply_id=$1 ORDER BY created_at DESC,id DESC`,
          [reply.id],
        )
      ).rows
    : [];
  return {
    target: {
      id: target.id,
      world_id: target.world_id,
      provider_id: target.provider_id,
      profiles: signatureProfiles(target.provider_profiles ?? {}),
      target_slug: target.target_slug,
      target_kind: target.target_kind,
      world_slug: target.world_slug,
    },
    reply,
    revisions,
    publications: reply
      ? (
          await db.query(
            'SELECT * FROM reply_publications WHERE reply_id=$1 ORDER BY published_at DESC,id DESC',
            [reply.id],
          )
        ).rows
      : [],
    events: reply
      ? (
          await db.query('SELECT * FROM reply_events WHERE reply_id=$1 ORDER BY created_at DESC,id DESC', [
            reply.id,
          ])
        ).rows
      : [],
  };
}
export function saveReply(
  db: Database,
  actor: Actor,
  reviewId: string,
  raw: unknown,
  baseRevisionId: string | null,
) {
  return transaction(db, async (c) => {
    const body = z
      .object({
        sourceLocale: z.enum(['en', 'zh-CN']),
        texts: z.record(z.string(), z.string().trim().min(1).max(10000)),
      })
      .strict()
      .parse(raw);
    validateLanguages(body.texts, body.sourceLocale);
    const target = await providerAccess(c, actor, reviewId);
    await c.query('SELECT id FROM contents WHERE id=$1 FOR UPDATE', [target.parent_content_id]);
    // Recheck binding under the parent lock so assignment cannot race the reply author.
    const current = await providerAccess(c, actor, reviewId);
    const s = await personaSnapshot(c, actor, current.provider_id);
    await c.query('INSERT INTO review_replies(review_id)VALUES($1)ON CONFLICT(review_id)DO NOTHING', [
      reviewId,
    ]);
    const reply = (await c.query('SELECT * FROM review_replies WHERE review_id=$1 FOR UPDATE', [reviewId]))
      .rows[0];
    assert(
      reply.head_revision_id === baseRevisionId,
      409,
      'REVISION_CONFLICT',
      'Reply changed. Your input is preserved.',
    );
    const r = (
      await c.query(
        'INSERT INTO reply_revisions(reply_id,persona_id,persona_revision_id,profiles,body,source_locale,created_by)VALUES($1,$2,$3,$4,$5,$6,$7)RETURNING id',
        [reply.id, current.provider_id, s.revisionId, s.profiles, body.texts, body.sourceLocale, actor.id],
      )
    ).rows[0];
    await c.query('UPDATE review_replies SET head_revision_id=$2 WHERE id=$1', [reply.id, r.id]);
    await c.query("INSERT INTO reply_events(reply_id,revision_id,action,actor_id)VALUES($1,$2,'draft',$3)", [
      reply.id,
      r.id,
      actor.id,
    ]);
    return { id: reply.id, revisionId: r.id };
  });
}
export function replyAction(
  db: Database,
  actor: Actor,
  reviewId: string,
  action: 'submit' | 'publish' | 'reject' | 'hide' | 'restore',
  revisionId: string,
  note = '',
  publicationId?: string,
) {
  return transaction(db, async (c) => {
    const target = await providerFor(c, reviewId);
    if (action === 'submit') await providerAccess(c, actor, reviewId);
    else await requireWorld(c, actor, target.world_id, true);
    await c.query('SELECT id FROM contents WHERE id=$1 FOR UPDATE', [target.parent_content_id]);
    const reply = (await c.query('SELECT * FROM review_replies WHERE review_id=$1 FOR UPDATE', [reviewId]))
      .rows[0];
    assert(reply, 404, 'NOT_FOUND', 'Reply not found.');
    assert(
      reply.head_revision_id === revisionId,
      409,
      'REVISION_CONFLICT',
      'Reply changed; reload before reviewing.',
    );
    let r = (await c.query('SELECT * FROM reply_revisions WHERE id=$1', [revisionId])).rows[0];
    const status = (
      await c.query(
        'SELECT action FROM reply_events WHERE revision_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',
        [r.id],
      )
    ).rows[0]?.action;
    if (action === 'submit') {
      const current = await providerAccess(c, actor, reviewId);
      assert(
        r.persona_id === current.provider_id && r.created_by === actor.id,
        403,
        'PROVIDER_FORBIDDEN',
        'Save a reply under the current provider identity.',
      );
      assert(
        ['draft', 'reject', 'submit'].includes(status),
        409,
        'REVISION_LOCKED',
        'Save a new reply version first.',
      );
      await ownPersona(c, actor, r.persona_id, true);
      await submitPersona(c, r.persona_revision_id, actor);
    } else if (action === 'hide')
      await c.query('UPDATE review_replies SET hidden=true WHERE id=$1', [reply.id]);
    else if (action === 'reject')
      assert(status === 'submit', 409, 'NOT_SUBMITTED', 'Submit the reply first.');
    else {
      assert(
        await getPublished(c, 'en', { id: reviewId }),
        409,
        'TARGET_UNAVAILABLE',
        'The parent review is not visible.',
      );
      if (action === 'restore') {
        const old = (
          await c.query('SELECT * FROM reply_publications WHERE id=$1 AND reply_id=$2', [
            publicationId,
            reply.id,
          ])
        ).rows[0];
        assert(old, 404, 'NOT_FOUND', 'Reply publication not found.');
        r = (await c.query('SELECT * FROM reply_revisions WHERE id=$1', [old.revision_id])).rows[0];
      } else {
        assert(status === 'submit', 409, 'NOT_SUBMITTED', 'Submit the reply first.');
        const current = await providerFor(c, reviewId);
        assert(
          current.provider_id === r.persona_id,
          409,
          'PROVIDER_CHANGED',
          'Provider changed; save a new reply.',
        );
        const p = (await c.query('SELECT * FROM personas WHERE id=$1 FOR UPDATE', [r.persona_id])).rows[0];
        assert(!p.disabled, 403, 'PERSONA_DISABLED', 'Provider is disabled.');
        const d = (
          await c.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1', [
            r.persona_revision_id,
          ])
        ).rows[0];
        if (!d && actor.siteRole === 'admin')
          await approvePersonaVersion(c, actor, r.persona_revision_id, 'approved');
        else
          assert(
            d?.decision === 'approved',
            409,
            'PERSONA_APPROVAL_REQUIRED',
            'Profile approval is required.',
          );
        assert(
          r.body.en && r.body['zh-CN'],
          409,
          'TRANSLATIONS_REQUIRED',
          'Complete Chinese and English reply text.',
        );
      }
      const p = (
        await c.query(
          'INSERT INTO reply_publications(reply_id,revision_id,published_by,restored_from)VALUES($1,$2,$3,$4)RETURNING id',
          [reply.id, r.id, actor.id, action === 'restore' ? publicationId : null],
        )
      ).rows[0];
      await c.query('UPDATE review_replies SET published_id=$2,hidden=false WHERE id=$1', [reply.id, p.id]);
    }
    await c.query(
      'INSERT INTO reply_events(reply_id,revision_id,action,actor_id,note)VALUES($1,$2,$3,$4,$5)',
      [reply.id, r.id, action, actor.id, note],
    );
    return { action };
  });
}
export async function providerInbox(db: Connection, actor: Actor, page = 1) {
  const rows = (
    await db.query(
      `SELECT c.id,p.slug AS target_slug,p.kind AS target_kind,w.slug AS world_slug,b.persona_id,coalesce(pr.profiles->'en'->>'name','') AS name,r.source_text->>'title' AS title,rr.id AS reply_id FROM provider_bindings b JOIN personas pr ON pr.id=b.persona_id JOIN contents p ON p.id=b.content_id JOIN worlds w ON w.id=p.world_id JOIN contents c ON c.parent_content_id=p.id JOIN publications cp ON cp.id=c.published_publication_id JOIN content_revisions r ON r.id=cp.revision_id LEFT JOIN review_replies rr ON rr.review_id=c.id WHERE pr.owner_id=$1 AND c.published_publication_id IS NOT NULL ORDER BY c.created_at DESC,c.id LIMIT 21 OFFSET $2`,
      [actor.id, (page - 1) * 20],
    )
  ).rows;
  return { items: rows.slice(0, 20), hasNext: rows.length > 20, page };
}
export async function providerOptions(db: Connection, actor: Actor, worldId: string) {
  await requireWorld(db, actor, worldId, true);
  return {
    entries: (
      await db.query(
        "SELECT c.id,c.slug,c.kind,b.persona_id FROM contents c LEFT JOIN provider_bindings b ON b.content_id=c.id WHERE c.world_id=$1 AND c.kind IN ('stay','experience','service') ORDER BY c.slug",
        [worldId],
      )
    ).rows,
    personas: (
      await db.query(
        'SELECT id,profiles FROM personas WHERE approved AND NOT disabled AND (owner_id=$1 OR $2) ORDER BY created_at',
        [actor.id, actor.siteRole === 'admin'],
      )
    ).rows,
  };
}
export async function readReplies(db: Connection, locale: string, reviewIds: string[]) {
  if (!reviewIds.length) return {};
  const rows = (
    await db.query(
      `SELECT q.review_id,q.id,p.published_at,r.body,r.profiles,r.source_locale FROM review_replies q JOIN reply_publications p ON p.id=q.published_id JOIN reply_revisions r ON r.id=p.revision_id WHERE q.review_id=ANY($1::uuid[]) AND NOT q.hidden`,
      [reviewIds],
    )
  ).rows;
  return Object.fromEntries(
    rows.map((r) => {
      const language = r.body[locale] ? locale : r.source_locale,
        profile = r.profiles[language] ?? r.profiles[r.source_locale] ?? Object.values(r.profiles)[0];
      return [
        r.review_id,
        {
          id: r.id,
          body: r.body[language],
          name: profile.name,
          avatarImage: profile.avatarImage,
          publishedAt: r.published_at.toISOString(),
          isFallback: language !== locale,
        },
      ];
    }),
  );
}
