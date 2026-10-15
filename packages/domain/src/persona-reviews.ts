import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction, type Database, type Connection, type PoolClient } from '@plotstay/database';
import { sharedPersonaSchema, personaSaveSchema, personaNotesSchema, textSchema, reviewRatingsSchema, idSchema } from '@plotstay/contracts';
import { type Actor, requireWorld, hashPassword } from './auth.ts';
import { assert } from './errors.ts';
import { appendRevision } from './content.ts';
import { getPublished } from './read.ts';
import {recordReviewSubmission} from './review-submissions.ts';
import {effectiveReplySubmission,replyAccessEpoch} from './reply-access.ts';

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
      `SELECT p.id,p.disabled,p.approved,p.created_at,coalesce(r.created_at,p.created_at) AS updated_at,s.id AS setting_id,s.head_revision_id,s.submitted_revision_id,
 r.body AS draft,sr.body AS submitted,p.profiles AS published,
 d.decision,d.note,pd.decision AS submitted_decision,pd.note AS submitted_note,
 pub.revision_id AS published_revision_id,
 (SELECT jsonb_build_object('revisionId',rr.id,'note',rd.note,'createdAt',rd.created_at)
 FROM detail_setting_revisions rr JOIN persona_revision_decisions rd ON rd.revision_id=rr.id
 WHERE rr.setting_id=s.id AND rd.decision='rejected' ORDER BY rd.created_at DESC,rr.id LIMIT 1) AS last_rejection
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
  return transaction(db, c => savePersonaInTransaction(c,actor,raw,id,baseRevisionId));
}
async function savePersonaInTransaction(c: Connection,actor: Actor,raw: unknown,id?: string,baseRevisionId?: string|null) {
    const body = profilesSchema.parse(raw);
    validateLanguages(body);
    let p;
    if (id) {
      p = await ownPersona(c, actor, id, true);
    } else
      p = (await c.query('INSERT INTO personas(owner_id,profiles)VALUES($1,$2)RETURNING *', [actor.id, {}]))
        .rows[0];
    const previous=id?(await c.query("SELECT head_revision_id FROM detail_settings WHERE kind='persona' AND entity_id=$1",[id])).rows[0]:null;
    const s = await ensureSetting(c, p);
    assert(
      !id || (previous?.head_revision_id??null) === (baseRevisionId??null),
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
}

async function personaSnapshot(c: Connection, actor: Actor, id: string) {
  const p = await ownPersona(c, actor, id, true),
    s = await ensureSetting(c, p);
  const r = (await c.query('SELECT * FROM detail_setting_revisions WHERE id=$1', [s.head_revision_id]))
    .rows[0];
  profilesSchema.parse(r.body);
  return { revisionId: r.id, profiles: signatureProfiles(r.body), settingId: s.id };
}
export async function reviewHistoryBoundary(db:Connection,content:any){
 const boundary=(await db.query('SELECT w.visible,w.site_blocked AS world_blocked,p.site_blocked AS parent_blocked FROM worlds w JOIN contents p ON p.id=$2 WHERE w.id=$1',[content.world_id,content.parent_content_id])).rows[0];
 assert(boundary?.visible&&!boundary.world_blocked&&!boundary.parent_blocked&&!content.site_blocked,409,'TARGET_UNAVAILABLE','World or site restrictions prevent reading this history.');
}
export async function reviewDetail(db: Connection, actor: Actor, id: string, moderate = false, history?:{page:number;revision?:string}) {
  const c = (
    await db.query(
      "SELECT c.*,parent.slug AS target_slug,parent.kind AS target_kind,w.slug AS world_slug FROM contents c JOIN contents parent ON parent.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id WHERE c.id=$1 AND c.kind='review'",
      [id],
    )
  ).rows[0];
  assert(c, 404, 'NOT_FOUND', 'Review not found.');
  if (moderate) await requireWorld(db, actor, c.world_id, true);
  else assert(c.author_id === actor.id, 403, 'REVIEW_FORBIDDEN', 'This review belongs to another account.');
  let contextAvailable=true;
  if(!moderate){await reviewHistoryBoundary(db,c);contextAvailable=Boolean(await getPublished(db,'en',{id:c.parent_content_id}));}
  if(!contextAvailable){c.target_slug=null;c.target_kind=null;c.world_slug=null;}
  const revisions = (
    await db.query(
      `SELECT r.*,s.persona_revision_id,s.profiles,s.managed,d.decision AS persona_decision,d.note AS persona_note,
 CASE WHEN r.id=$2 THEN coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM review_submission_locales l JOIN translations t ON t.id=l.translation_id WHERE l.submission_id=$3),'{}') ELSE coalesce((SELECT jsonb_object_agg(l.locale,t.body) FROM revision_locales l JOIN translations t ON t.id=l.translation_id WHERE l.revision_id=r.id),'{}') END AS texts
 FROM content_revisions r LEFT JOIN review_signatures s ON s.revision_id=r.id LEFT JOIN persona_revision_decisions d ON d.revision_id=s.persona_revision_id WHERE r.content_id=$1 AND ($4::int IS NULL OR r.id=ANY($5::uuid[]) OR r.id=(SELECT revision_id FROM publications WHERE id=$6) OR r.id IN(SELECT id FROM content_revisions WHERE content_id=$1 ORDER BY number DESC LIMIT 20 OFFSET $4)) ORDER BY r.number DESC`,
      [id,c.submitted_revision_id,c.submission_token,history?(history.page-1)*20:null,[c.head_revision_id,c.submitted_revision_id,history?.revision].filter(Boolean),c.published_publication_id],
    )
  ).rows;
  const events = (
    await db.query(
      'SELECT id,revision_id,action,note,created_at FROM moderation_events WHERE content_id=$1 AND ($2::uuid[] IS NULL OR revision_id=ANY($2)) ORDER BY created_at DESC LIMIT $3',
      [id,history?revisions.map((r:any)=>r.id):null,history?100:null],
    )
  ).rows;
  const publications = (
    await db.query(
      'SELECT id,revision_id,published_at FROM publications WHERE content_id=$1 AND ($2::uuid[] IS NULL OR revision_id=ANY($2)) ORDER BY published_at DESC LIMIT $3',
      [id,history?revisions.map((r:any)=>r.id):null,history?100:null],
    )
  ).rows;
  const historyTotal=history?(await db.query('SELECT count(*)::int n FROM content_revisions WHERE content_id=$1',[id])).rows[0].n:revisions.length;
  return { historyTotal,content: c, revisions, events, publications, contextAvailable };
}
export async function myReviews(db: Connection, actor: Actor, page = 1) {
  const {
    rows: [r],
  } = await db.query(
    `WITH entries AS(SELECT c.id,c.persona_id,c.published_publication_id,r.status,r.source_text->>'title' AS title,(SELECT s.profiles FROM review_signatures s WHERE s.revision_id=r.id) AS profiles,r.source_text->'review'->>'name' AS legacy_name,p.slug AS target_slug,p.kind AS target_kind,w.slug AS world_slug,r.created_at FROM contents c JOIN contents p ON p.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id JOIN content_revisions r ON r.id=c.head_revision_id WHERE c.kind='review' AND c.author_id=$1 AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked AND NOT p.site_blocked AND p.published_publication_id IS NOT NULL AND EXISTS(SELECT 1 FROM review_signatures sig WHERE sig.revision_id=r.id AND sig.managed)) SELECT (SELECT count(*)::int FROM entries) AS total,coalesce((SELECT jsonb_agg(e) FROM(SELECT * FROM entries ORDER BY created_at DESC,id LIMIT 20 OFFSET $2)e),'[]') AS items`,
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
  return transaction(db, c => saveReviewInTransaction(c, actor, id, baseRevisionId, raw));
}
export async function saveReviewInTransaction(c: PoolClient, actor: Actor, id: string, baseRevisionId: string, raw: unknown) {
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
    assert(!entry.site_blocked,403,'SITE_BLOCKED','This review is restricted.');
    assert((await c.query('SELECT 1 FROM review_signatures WHERE revision_id=$1 AND managed',[entry.head_revision_id])).rowCount,409,'LEGACY_REVIEW','Use the legacy note editor.');
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
  return transaction(db,c=>submitOwnPersonaInTransaction(c,actor,id,revisionId));
}
async function submitOwnPersonaInTransaction(c: Connection,actor: Actor,id: string,revisionId: string) {
    const p = await ownPersona(c, actor, id, true);
    const s = await ensureSetting(c, p);
    assert(s.head_revision_id === revisionId, 409, 'REVISION_CONFLICT', 'Submit the saved current profile.');
    const body = (await c.query('SELECT body FROM detail_setting_revisions WHERE id=$1', [revisionId])).rows[0]?.body;
    assert(body?.en && body?.['zh-CN'], 409, 'TRANSLATIONS_REQUIRED', 'Complete both profile languages.');
    const decided=(await c.query('SELECT decision FROM persona_revision_decisions WHERE revision_id=$1',[revisionId])).rows[0];
    if(decided?.decision==='approved')return {submitted:false,alreadyApproved:true,revisionId};
    await submitPersona(c, revisionId, actor);
    return { submitted: true, revisionId };
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
  return transaction(db, c => submitReviewInTransaction(c, actor, id, revisionId));
}
export async function submitReviewInTransaction(c: PoolClient, actor: Actor, id: string, revisionId: string) {
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
    assert(!entry.site_blocked,403,'SITE_BLOCKED','This review is restricted.');
    if(entry.submitted_revision_id===revisionId)return {submitted:true,revisionId,submissionToken:entry.submission_token};
    const s = (await c.query('SELECT * FROM review_signatures WHERE revision_id=$1', [revisionId])).rows[0];
    assert(s?.persona_revision_id, 409, 'PROFILE_REQUIRED', 'Save this review with a persona first.');
    await submitPersona(c, s.persona_revision_id, actor);
    const r = await c.query(
      "UPDATE content_revisions SET status='submitted' WHERE id=$1 AND status IN ('draft','submitted') RETURNING id",
      [revisionId],
    );
    assert(r.rowCount, 409, 'REVISION_LOCKED', 'Save a new draft before submitting.');
    await c.query(
      "INSERT INTO moderation_events(content_id,revision_id,world_id,actor_id,action)VALUES($1,$2,$3,$4,'submitted')",
      [id, revisionId, entry.world_id, actor.id],
    );
    return { submitted: true, ...await recordReviewSubmission(c,actor,entry,revisionId) };
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
      `SELECT c.id,c.world_id,c.persona_id,c.author_id,c.published_publication_id,r.id AS revision_id,r.status,r.source_text->>'title' AS title,p.slug AS target_slug,p.kind AS target_kind,w.slug AS world_slug,s.persona_revision_id,d.decision AS persona_decision,(SELECT e.action FROM review_replies q JOIN reply_events e ON e.revision_id=q.submitted_revision_id WHERE q.review_id=c.id AND ${effectiveReplySubmission('q','c')} AND e.action IN ('draft','submit','publish','reject') ORDER BY e.created_at DESC,(e.action='draft') ASC,e.id DESC LIMIT 1) AS reply_status
 FROM contents c JOIN contents p ON p.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id JOIN content_revisions r ON r.id=coalesce(c.submitted_revision_id,c.head_revision_id) LEFT JOIN review_signatures s ON s.revision_id=r.id LEFT JOIN persona_revision_decisions d ON d.revision_id=s.persona_revision_id
 WHERE c.kind='review' AND ($1 OR w.owner_id=$2 OR EXISTS(SELECT 1 FROM world_members m WHERE m.world_id=c.world_id AND m.user_id=$2 AND m.role IN ('owner','admin')))
 ORDER BY ((r.status='submitted') OR EXISTS(SELECT 1 FROM review_replies q WHERE q.review_id=c.id AND ${effectiveReplySubmission('q','c')} AND (SELECT e.action FROM reply_events e WHERE e.revision_id=q.submitted_revision_id AND e.action IN ('draft','submit','publish','reject') ORDER BY e.created_at DESC,(e.action='draft') ASC,e.id DESC LIMIT 1)='submit')) DESC,r.created_at DESC,c.id LIMIT 21 OFFSET $3`,
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
    const {writeWork,bindWorkProvider}=await import('./work-access.ts');
    await writeWork(c,actor,target);
    await bindWorkProvider(c,actor,target,personaId);
    return {bound:true};

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
  const accessEpoch=await replyAccessEpoch(c,r.world_id,actor.id);
  assert(
    await getPublished(c, 'en', { id: reviewId }),
    409,
    'TARGET_UNAVAILABLE',
    'Only a visible published review can receive replies.',
  );
  return {...r,accessEpoch};
}
export async function lockReplyProvider(c:PoolClient,actor:Actor,reviewId:string){
  const target=await providerFor(c,reviewId);
  // Match works: parent content -> account/eligibility -> persona/reply state.
  // The first read must not take the eligibility lock before the parent row.
  await c.query('SELECT id FROM contents WHERE id=$1 FOR UPDATE',[target.parent_content_id]);
  return providerAccess(c,actor,reviewId);
}
export async function replyDetail(db: Connection, actor: Actor, reviewId: string, moderate = false, history?:{page:number;revision?:string}) {
  const target = await providerFor(db,reviewId);
  if(moderate)await requireWorld(db,actor,target.world_id,true);
  const reply=(await db.query('SELECT * FROM review_replies WHERE review_id=$1',[reviewId])).rows[0]??null;
  const authored=reply&&(await db.query('SELECT 1 FROM reply_revisions WHERE reply_id=$1 AND created_by=$2 LIMIT 1',[reply.id,actor.id])).rowCount;
  const contextAvailable=Boolean(await getPublished(db,'en',{id:reviewId}));
  if(!moderate){
    assert(target.provider_owner===actor.id||authored,403,'PROVIDER_FORBIDDEN','Only the current provider or original author can read this reply.');
    await reviewHistoryBoundary(db,target);
    assert(contextAvailable||authored,409,'TARGET_UNAVAILABLE','This review context is not available.');
  }
  const publicRevision=reply&&!reply.hidden&&contextAvailable?(await db.query('SELECT revision_id FROM reply_publications WHERE id=$1',[reply.published_id])).rows[0]?.revision_id:null;
  // Pin the current persona's own editable version independently of history pagination.
  const editRevisionId=reply?(await db.query('SELECT id FROM reply_revisions WHERE reply_id=$1 AND created_by=$2 AND persona_id=$3 ORDER BY created_at DESC,id DESC LIMIT 1',[reply.id,actor.id,target.provider_id])).rows[0]?.id??null:null;
  const revisions=reply?(await db.query(`SELECT r.*,
    coalesce((SELECT action FROM reply_events e WHERE e.revision_id=r.id AND e.action IN ('draft','submit','publish','reject') ORDER BY created_at DESC,(action='draft') ASC,id DESC LIMIT 1),'draft') AS status,
    CASE WHEN $2 OR r.created_by=$3 THEN d.decision END AS persona_decision,
    CASE WHEN $2 OR r.created_by=$3 THEN d.note END AS persona_note
    FROM reply_revisions r LEFT JOIN persona_revision_decisions d ON d.revision_id=r.persona_revision_id
    WHERE reply_id=$1 AND ($2 OR r.created_by=$3 OR r.id=$4)
    AND ($5::int IS NULL OR r.id=ANY($6::uuid[]) OR r.id IN(SELECT id FROM reply_revisions WHERE reply_id=$1 AND created_by=$3 ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET $5))
    ORDER BY created_at DESC,id DESC`,[reply.id,moderate,actor.id,publicRevision??null,history?(history.page-1)*20:null,[reply.head_revision_id,reply.submitted_revision_id,publicRevision,history?.revision,editRevisionId].filter(Boolean)])).rows:[];
  const ownIds=revisions.filter((r:any)=>moderate||r.created_by===actor.id).map((r:any)=>r.id);
  const publications=reply?(await db.query('SELECT * FROM reply_publications WHERE reply_id=$1 AND ($2 OR revision_id=ANY($3::uuid[]) OR id=$4) ORDER BY published_at DESC,id DESC LIMIT $5',[reply.id,moderate,ownIds,reply.hidden||!contextAvailable?null:reply.published_id,history?100:null])).rows:[];
  const events=reply?(await db.query(`SELECT * FROM reply_events WHERE reply_id=$1 AND ($2 OR revision_id=ANY($3::uuid[])) ORDER BY created_at DESC,id DESC LIMIT $4`,[reply.id,moderate,ownIds,history?100:null])).rows:[];
  const eligibility=await (await import('./work-access.ts')).qualification(db,target.world_id,actor.id);
  const canEdit=contextAvailable&&target.provider_owner===actor.id&&!target.provider_disabled&&eligibility.status!=='revoked';
  // A head ID is only a concurrency token, never a reason to return its private body.
  const effective=reply&&Boolean((await db.query(`SELECT ${effectiveReplySubmission('q','review')} AS valid FROM review_replies q JOIN contents review ON review.id=q.review_id WHERE q.id=$1`,[reply.id])).rows[0]?.valid);
  const safeReply=reply?{...reply,submitted_revision_id:effective&&(moderate||ownIds.includes(reply.submitted_revision_id))?reply.submitted_revision_id:null}:null;
  const historyTotal=history&&reply?(await db.query('SELECT count(*)::int n FROM reply_revisions WHERE reply_id=$1 AND created_by=$2',[reply.id,actor.id])).rows[0].n:revisions.length;
  return {historyTotal,target:{id:target.id,world_id:target.world_id,provider_id:target.provider_id,
    profiles:contextAvailable?signatureProfiles(target.provider_profiles??{}):{},target_slug:contextAvailable?target.target_slug:null,target_kind:contextAvailable?target.target_kind:null,world_slug:contextAvailable?target.world_slug:null},
    reply:safeReply,revisions,publications,events,canEdit,contextAvailable,eligibilityRevoked:eligibility.status==='revoked',
    submissionExpired:Boolean(reply?.submitted_revision_id&&!effective&&(moderate||ownIds.includes(reply.submitted_revision_id))),
    editRevisionId,
    submissionGuard:canEdit?reply?.submitted_revision_id??null:null,
    baseRevisionId:reply?.head_revision_id??null};
}
export function saveReply(
  db: Database,
  actor: Actor,
  reviewId: string,
  raw: unknown,
  baseRevisionId: string | null,
  expectedPersonaId?: string,
) {
  return transaction(db, c => saveReplyInTransaction(c, actor, reviewId, raw, baseRevisionId,expectedPersonaId));
}
export async function saveReplyInTransaction(c: PoolClient, actor: Actor, reviewId: string, raw: unknown, baseRevisionId: string | null,expectedPersonaId?:string) {
    const body = z
      .object({
        sourceLocale: z.enum(['en', 'zh-CN']),
        texts: z.record(z.string(), z.string().trim().min(1).max(10000)),
      })
      .strict()
      .parse(raw);
    validateLanguages(body.texts, body.sourceLocale);
    const current = await lockReplyProvider(c,actor,reviewId);
    if(expectedPersonaId)assert(current.provider_id===expectedPersonaId,409,'PROVIDER_CHANGED','Provider changed since this form was opened.');
    else if(baseRevisionId){const base=(await c.query('SELECT persona_id,created_by FROM reply_revisions WHERE id=$1',[baseRevisionId])).rows[0];assert(!base||base.created_by!==actor.id||base.persona_id===current.provider_id,409,'PROVIDER_CHANGED','Confirm the new provider identity before saving.');}
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
  return transaction(db, c => replyActionInTransaction(c, actor, reviewId, action, revisionId, note, publicationId));
}
export async function replyActionInTransaction(c: PoolClient, actor: Actor, reviewId: string, action: 'submit' | 'publish' | 'reject' | 'hide' | 'restore', revisionId: string, note = '', publicationId?: string) {
    const target = await providerFor(c, reviewId);
    if (action !== 'submit') await requireWorld(c, actor, target.world_id, true);
    await c.query('SELECT id FROM contents WHERE id=$1 FOR UPDATE', [target.parent_content_id]);
    if(action==='submit')await providerAccess(c,actor,reviewId);
    const reply = (await c.query('SELECT * FROM review_replies WHERE review_id=$1 FOR UPDATE', [reviewId]))
      .rows[0];
    assert(reply, 404, 'NOT_FOUND', 'Reply not found.');
    assert(
      (action==='publish'||action==='reject' ? reply.submitted_revision_id : reply.head_revision_id) === revisionId,
      409,
      action==='publish'||action==='reject' ? 'SUBMISSION_SUPERSEDED' : 'REVISION_CONFLICT',
      'Reply changed; reload the effective version.',
    );
    let r = (await c.query('SELECT * FROM reply_revisions WHERE id=$1 AND reply_id=$2', [revisionId,reply.id])).rows[0];
    assert(r,404,'NOT_FOUND','Reply version not found.');
    const status = (
      await c.query(
        // Visibility events do not replace this version's writing/moderation state.
        // Atomic save + submit share now(); the transition must sort after its initial draft.
        "SELECT action FROM reply_events WHERE revision_id=$1 AND action IN ('draft','submit','publish','reject') ORDER BY created_at DESC,(action='draft') ASC,id DESC LIMIT 1",
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
        ['draft', 'submit'].includes(status),
        409,
        'REVISION_LOCKED',
        'Save a new reply version first.',
      );
      await ownPersona(c, actor, r.persona_id, true);
      await submitPersona(c, r.persona_revision_id, actor);
      if(reply.submitted_revision_id===revisionId&&reply.submitted_access_epoch===current.accessEpoch)return {action,revisionId};
      await c.query('UPDATE review_replies SET submitted_revision_id=$2,submitted_access_epoch=$3 WHERE id=$1',[reply.id,revisionId,current.accessEpoch]);
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
        await replyAccessEpoch(c,target.world_id,r.created_by);
        const p=(await c.query('SELECT disabled FROM personas WHERE id=$1 FOR UPDATE',[r.persona_id])).rows[0];
        assert(p&&!p.disabled,403,'PERSONA_DISABLED','Provider is disabled.');
      } else {
        assert(status === 'submit', 409, 'NOT_SUBMITTED', 'Submit the reply first.');
        const epoch=await replyAccessEpoch(c,target.world_id,r.created_by);
        assert(reply.submitted_access_epoch===epoch,409,'SUBMISSION_EXPIRED','Operating eligibility changed. The provider must explicitly submit again.');
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
    if(action==='publish'||action==='reject')await c.query('UPDATE review_replies SET submitted_revision_id=NULL,submitted_access_epoch=NULL WHERE id=$1',[reply.id]);
    await c.query(
      'INSERT INTO reply_events(reply_id,revision_id,action,actor_id,note)VALUES($1,$2,$3,$4,$5)',
      [reply.id, r.id, action, actor.id, note],
    );
    return { action };
  }
export async function providerInbox(db: Connection, actor: Actor, page = 1) {
  const rows = (
    await db.query(
      `SELECT c.id,p.slug AS target_slug,p.kind AS target_kind,w.slug AS world_slug,b.persona_id,coalesce(pr.profiles->'en'->>'name','') AS name,r.source_text->>'title' AS title,rr.id AS reply_id FROM provider_bindings b JOIN personas pr ON pr.id=b.persona_id JOIN contents p ON p.id=b.content_id JOIN worlds w ON w.id=p.world_id JOIN contents c ON c.parent_content_id=p.id JOIN publications cp ON cp.id=c.published_publication_id JOIN content_revisions r ON r.id=cp.revision_id LEFT JOIN review_replies rr ON rr.review_id=c.id WHERE (pr.owner_id=$1 OR EXISTS(SELECT 1 FROM reply_revisions history WHERE history.reply_id=rr.id AND history.created_by=$1)) AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked AND NOT p.site_blocked AND p.published_publication_id IS NOT NULL AND c.published_publication_id IS NOT NULL ORDER BY c.created_at DESC,c.id LIMIT 21 OFFSET $2`,
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

// Stable fingerprints contain no body text. The private-note fingerprint is never logged.
function commandHash(value: unknown): string {
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function saveOwnPersona(db: Database,actor: Actor,raw: unknown) {
 const input=personaSaveSchema.parse(raw),hash=commandHash(input);
 return transaction(db,async c=>{
  // Same actor/request serializes even before a new persona has an ID.
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.id+':persona:'+input.requestId]);
  if(input.personaId)await ownPersona(c,actor,input.personaId,true);
  const cached=(await c.query('SELECT request_hash,result FROM persona_profile_commands WHERE actor_id=$1 AND request_id=$2',[actor.id,input.requestId])).rows[0];
  if(cached){assert(cached.request_hash===hash,409,'REQUEST_CONFLICT','This request ID belongs to a different save.');return cached.result;}
  assert(input.personaId||input.baseRevisionId===null,409,'REVISION_CONFLICT','A saved persona requires its current revision.');
  if(input.action==='complete'){
   const current=input.personaId?(await c.query("SELECT submitted_revision_id FROM detail_settings WHERE kind='persona' AND entity_id=$1",[input.personaId])).rows[0]?.submitted_revision_id:null;
   assert((current??null)===input.expectedSubmittedRevisionId,409,'SUBMISSION_CONFLICT','The pending profile changed. Review the current submission before replacing it.');
   assert(input.profiles.en&&input.profiles['zh-CN'],409,'TRANSLATIONS_REQUIRED','Complete Chinese and English profiles.');
  }
  const saved=await savePersonaInTransaction(c,actor,input.profiles,input.personaId,input.baseRevisionId);
  let outcome='draft';
  if(input.action==='complete'){
   await submitOwnPersonaInTransaction(c,actor,saved.id,saved.revisionId);
   outcome='submitted';
   if(actor.siteRole==='admin'){
    await approvePersonaVersion(c,actor,saved.revisionId,'approved','Owner site administrator completed profile');
    outcome='published';
   }
  }
  const metadata=(await c.query(`SELECT r.setting_id,r.created_at AS updated_at,p.created_at
    FROM detail_setting_revisions r JOIN personas p ON p.id=$2 WHERE r.id=$1`,[saved.revisionId,saved.id])).rows[0];
  const result={...saved,outcome,settingId:metadata.setting_id,updatedAt:metadata.updated_at.toISOString(),createdAt:metadata.created_at.toISOString()};
  await c.query('INSERT INTO persona_profile_commands(actor_id,request_id,request_hash,result)VALUES($1,$2,$3,$4)',[actor.id,input.requestId,hash,result]);
  return result;
 });
}
async function ownNotesPersona(c:Connection,actor:Actor,id:string,lock=false){
 // Disabled personas keep access to their owner's private notes. No admin override.
 const p=(await c.query(`SELECT owner_id FROM personas WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
 assert(p&&p.owner_id===actor.id,403,'PERSONA_FORBIDDEN','Choose your own persona.');
}
export async function readPersonaNotes(db:Connection,actor:Actor,id:string){
 await ownNotesPersona(db,actor,id);
 const row=(await db.query('SELECT body,version,updated_at FROM persona_private_notes WHERE persona_id=$1',[id])).rows[0];
 return row?{body:row.body,version:row.version,updatedAt:row.updated_at}:{body:'',version:null,updatedAt:null};
}
export function savePersonaNotes(db:Database,actor:Actor,id:string,raw:unknown){
 const input=personaNotesSchema.parse(raw),hash=commandHash(input);
 return transaction(db,async c=>{
  await ownNotesPersona(c,actor,id,true);
  const row=(await c.query('SELECT version,request_id,request_hash FROM persona_private_notes WHERE persona_id=$1 FOR UPDATE',[id])).rows[0];
  if(row?.request_id===input.requestId){assert(row.request_hash===hash,409,'REQUEST_CONFLICT','This request ID belongs to another save.');return readPersonaNotes(c,actor,id);}
  assert((row?.version??null)===input.baseVersion,409,'NOTES_CONFLICT','Notes changed. Your input has not overwritten them.');
  await c.query(`INSERT INTO persona_private_notes(persona_id,body,request_id,request_hash)VALUES($1,$2,$3,$4)
   ON CONFLICT(persona_id)DO UPDATE SET body=excluded.body,version=gen_random_uuid(),updated_at=clock_timestamp(),request_id=excluded.request_id,request_hash=excluded.request_hash`,[id,input.body,input.requestId,hash]);
  return readPersonaNotes(c,actor,id);
 });
}
