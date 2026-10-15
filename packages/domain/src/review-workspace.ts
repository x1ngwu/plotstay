import { z } from "zod";
import type { Connection } from "@plotstay/database";
import { idSchema } from "@plotstay/contracts";
import type { Actor } from "./auth.ts";
import { assert } from "./errors.ts";
import {effectiveReplySubmission} from './reply-access.ts';
import { getPublished, publicFrom, publicVisibility } from "./read.ts";
import {
  reviewDetail,
  replyDetail,
  signatureProfiles,
} from "./persona-reviews.ts";

export const reviewListSchema = z
  .object({
    view: z.enum(["reviews", "replies"]).default("reviews"),
    locale: z.enum(["en", "zh-CN"]).default("en"),
    persona: idSchema.optional(),
    world: idSchema.optional(),
    kind: z.enum(["stay", "experience", "service"]).optional(),
    status: z
      .enum([
        "draft",
        "submitted",
        "published",
        "rejected",
        "unanswered",
        "readonly",
      ])
      .optional(),
    q: z.string().trim().max(200).default(""),
    sort: z.enum(["recent", "action"]).default("recent"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
// All ownership, visibility and searchable text are selected before the common
// filter/count/page CTE. No card fetches its history and no private opponent head joins.
const base = `WITH permitted AS (
 SELECT c.*,w.translations AS world_text,w.source_locale AS world_source,
 (parent.published_publication_id IS NOT NULL AND ($2='reviews' OR cp.id IS NOT NULL)) AS context_available,
 parent.kind AS entry_kind,parent.id AS entry_id,parent.published_publication_id AS entry_publication,
 pb.persona_id AS provider_id,provider.owner_id AS provider_owner,provider.disabled AS provider_disabled,
 CASE WHEN provider.owner_id=$1 OR provider.approved THEN provider.profiles END AS provider_profiles,
 person.disabled AS reviewer_disabled,cp.revision_id AS public_revision,cp.published_at AS review_public_at,
 q.id AS reply_id,q.head_revision_id AS reply_head,
 CASE WHEN ${effectiveReplySubmission('q','c')} THEN q.submitted_revision_id END AS reply_submission,
 q.submitted_revision_id IS NOT NULL AND NOT coalesce(${effectiveReplySubmission('q','c')},false) AS reply_submission_expired,q.hidden,
 CASE WHEN NOT q.hidden THEN rp.revision_id END AS reply_public_revision,
 CASE WHEN NOT q.hidden THEN rp.published_at END AS reply_public_at,
 own.id AS own_reply_id,own.persona_id AS own_reply_persona,own.created_at AS own_reply_at,
 ARRAY(SELECT DISTINCT persona_id FROM reply_revisions WHERE reply_id=q.id AND created_by=$1) AS my_reply_persona_ids,
 own.body AS own_reply_body,own.profiles AS own_reply_profiles,own.source_locale AS own_reply_source,
 current_reply.created_by AS reply_head_author,current_reply.persona_id AS reply_head_persona,
 pending_reply.created_by AS reply_pending_author,
 pr.body AS public_reply_body,pr.profiles AS public_reply_profiles,pr.source_locale AS public_reply_source
 FROM contents c JOIN contents parent ON parent.id=c.parent_content_id JOIN worlds w ON w.id=c.world_id
 LEFT JOIN personas person ON person.id=c.persona_id
 LEFT JOIN review_signatures origin ON origin.revision_id=c.head_revision_id
 LEFT JOIN publications cp ON cp.id=c.published_publication_id
 LEFT JOIN provider_bindings pb ON pb.content_id=parent.id LEFT JOIN personas provider ON provider.id=pb.persona_id
 LEFT JOIN review_replies q ON q.review_id=c.id LEFT JOIN reply_publications rp ON rp.id=q.published_id AND NOT q.hidden
 LEFT JOIN reply_revisions pr ON pr.id=rp.revision_id
 LEFT JOIN reply_revisions current_reply ON current_reply.id=q.head_revision_id
 LEFT JOIN reply_revisions pending_reply ON pending_reply.id=q.submitted_revision_id
 LEFT JOIN LATERAL(SELECT id,persona_id,created_at,body,profiles,source_locale FROM reply_revisions
  WHERE reply_id=q.id AND created_by=$1 ORDER BY created_at DESC,id DESC LIMIT 1) own ON true
 WHERE c.kind='review' AND w.visible AND NOT w.site_blocked AND NOT c.site_blocked
 AND NOT parent.site_blocked
 AND (($2='reviews' AND c.author_id=$1 AND origin.managed)
  OR ($2='replies' AND (own.id IS NOT NULL OR cp.id IS NOT NULL AND parent.published_publication_id IS NOT NULL AND provider.owner_id=$1)))
), facts AS (
 SELECT p.id,p.world_id,p.persona_id,p.provider_id,p.entry_id,CASE WHEN p.context_available THEN p.entry_kind END AS entry_kind,p.context_available,
 CASE WHEN p.context_available THEN coalesce(p.world_text->$3->>'name',p.world_text->p.world_source->>'name') END AS world_name,
 et.body->>'title' AS entry_name,et.locale AS entry_locale,
 r.id AS review_revision_id,rt.body->>'title' AS title,left(rt.body->>'description',400) AS review_excerpt,
 rt.locale AS review_locale,s.profiles AS reviewer_profiles,CASE WHEN p.context_available THEN p.provider_profiles END AS provider_profiles,
 concat_ws(' ',rt.body::text,CASE WHEN $2='replies' THEN p.own_reply_body::text WHEN p.context_available THEN p.public_reply_body::text END) AS search_text,
 CASE WHEN p.context_available THEN p.public_revision END AS public_revision,CASE WHEN p.context_available THEN p.reply_public_revision END AS reply_public_revision,p.own_reply_id,p.my_reply_persona_ids,
 CASE WHEN $2='reviews' THEN p.submitted_revision_id WHEN p.reply_pending_author=$1 THEN p.reply_submission END AS submitted_revision_id,
 CASE WHEN $2='reviews' AND r.status IN ('draft','rejected') THEN r.id
  WHEN $2='replies' AND (own_status.action IN ('draft','reject') OR own_status.action='submit' AND p.reply_submission_expired) THEN p.own_reply_id END AS draft_revision_id,
 CASE WHEN $2='reviews' THEN r.status='rejected' ELSE own_status.action='reject' END AS rejected,
 p.context_available AND CASE WHEN $2='reviews' THEN NOT p.reviewer_disabled ELSE p.provider_owner=$1 AND NOT p.provider_disabled AND NOT EXISTS(SELECT 1 FROM work_eligibilities e WHERE e.world_id=p.world_id AND e.user_id=$1 AND e.status='revoked') END AS can_edit,
 CASE WHEN $2='reviews' THEN p.persona_id ELSE coalesce(CASE WHEN p.provider_owner=$1 THEN p.provider_id END,p.own_reply_persona) END AS focus_persona_id,
 CASE WHEN $2='replies' AND p.own_reply_id IS NOT NULL THEN left(coalesce(p.own_reply_body->$3,p.own_reply_body->p.own_reply_source)#>>'{}',400)
 WHEN p.context_available THEN left(coalesce(p.public_reply_body->$3,p.public_reply_body->p.public_reply_source)#>>'{}',400) END AS reply_excerpt,
 CASE WHEN $2='replies' AND p.own_reply_id IS NOT NULL THEN p.own_reply_profiles WHEN p.context_available THEN p.public_reply_profiles END AS reply_profiles,
 activity.created_at AS activity_at,activity.action AS activity_action,activity.revision_id AS activity_revision_id
 FROM permitted p LEFT JOIN content_revisions r ON r.id=CASE WHEN $2='reviews' THEN p.head_revision_id WHEN p.context_available THEN p.public_revision END
 LEFT JOIN review_signatures s ON s.revision_id=r.id
 LEFT JOIN LATERAL(SELECT tx.body,tx.locale FROM publication_locales l JOIN translations tx ON tx.id=l.translation_id
  WHERE p.context_available AND l.publication_id=p.entry_publication ORDER BY (l.locale=$3) DESC,l.locale LIMIT 1) et ON true
 LEFT JOIN LATERAL(SELECT tx.body,tx.locale FROM translations tx WHERE tx.id IN (
  SELECT translation_id FROM revision_locales WHERE revision_id=r.id AND $2='reviews'
  UNION ALL SELECT translation_id FROM publication_locales WHERE publication_id=p.published_publication_id AND $2='replies' AND p.context_available)
  ORDER BY (tx.locale=$3) DESC,(tx.locale=r.source_locale) DESC LIMIT 1) rt ON true
 LEFT JOIN LATERAL(SELECT action FROM reply_events WHERE revision_id=p.own_reply_id AND action IN ('draft','submit','publish','reject') ORDER BY created_at DESC,(action='draft') ASC,id DESC LIMIT 1) own_status ON true
 LEFT JOIN LATERAL(SELECT * FROM (
  SELECT e.created_at,e.action,e.revision_id FROM moderation_events e WHERE e.content_id=p.id AND $2='reviews'
   AND e.action IN ('draft_saved','submitted','published','rejected','restored','unpublished')
  UNION ALL SELECT p.review_public_at,'published',p.public_revision WHERE $2='replies' AND p.context_available
  UNION ALL SELECT e.created_at,e.action,e.revision_id FROM reply_events e JOIN reply_revisions rr ON rr.id=e.revision_id
   WHERE e.reply_id=p.reply_id AND $2='replies' AND rr.created_by=$1
  UNION ALL SELECT p.reply_public_at,'reply_published',p.reply_public_revision WHERE p.context_available AND p.reply_public_revision IS NOT NULL
 ) events WHERE created_at IS NOT NULL ORDER BY created_at DESC,action,revision_id LIMIT 1) activity ON true
), states AS (
 SELECT *,CASE WHEN NOT can_edit THEN 'readonly' WHEN rejected THEN 'rejected'
 WHEN draft_revision_id IS NOT NULL THEN 'draft' WHEN submitted_revision_id IS NOT NULL THEN 'submitted'
 WHEN $2='replies' AND reply_public_revision IS NULL THEN 'unanswered' ELSE 'published' END AS state,
 CASE WHEN can_edit AND (rejected OR draft_revision_id IS NOT NULL OR ($2='replies' AND reply_public_revision IS NULL AND submitted_revision_id IS NULL)) THEN 0 ELSE 1 END AS priority
 FROM facts
), filtered AS (SELECT * FROM states WHERE ($4::uuid IS NULL OR focus_persona_id=$4 OR $2='replies' AND $4=ANY(my_reply_persona_ids))
 AND ($5::uuid IS NULL OR world_id=$5) AND ($6::text IS NULL OR entry_kind=$6)
 AND ($7::text IS NULL OR state=$7 OR ($7='submitted' AND submitted_revision_id IS NOT NULL)
  OR ($7='published' AND CASE WHEN $2='reviews' THEN public_revision ELSE reply_public_revision END IS NOT NULL))
 AND ($8='' OR strpos(lower(concat_ws(' ',world_name,entry_name,title,review_excerpt,reply_excerpt,
 search_text,reviewer_profiles->$3->>'name',reply_profiles->$3->>'name')),lower($8))>0))`;

export async function reviewWorkspaceList(
  db: Connection,
  actor: Actor,
  raw: unknown,
) {
  const q = reviewListSchema.parse(raw);
  const row = (
    await db.query(
      base +
        ` SELECT (SELECT count(*)::int FROM filtered) AS total,
 coalesce((SELECT jsonb_agg(to_jsonb(item)-'search_text' ORDER BY CASE WHEN $9='action' THEN priority ELSE 0 END,activity_at DESC,id)
 FROM(SELECT * FROM filtered ORDER BY CASE WHEN $9='action' THEN priority ELSE 0 END,activity_at DESC,id LIMIT 20 OFFSET $10)item),'[]') AS items,
 coalesce((SELECT jsonb_agg(w ORDER BY name) FROM(SELECT DISTINCT world_id AS id,world_name AS name FROM states)w),'[]') AS worlds`,
      [
        actor.id,
        q.view,
        q.locale,
        q.persona ?? null,
        q.world ?? null,
        q.kind ?? null,
        q.status ?? null,
        q.q,
        q.sort,
        (q.page - 1) * 20,
      ],
    )
  ).rows[0];
  return {
    ...row,
    page: q.page,
    pages: Math.max(1, Math.ceil(row.total / 20)),
  };
}

export async function reviewWorkspaceDetail(
  db: Connection,
  actor: Actor,
  id: string,
  view: "reviews" | "replies",
  locale: string,
  history = { page: 1 } as { page: number; revision?: string },
) {
  // Reuse domain permission paths, including historical reply authors.
  const own =
    view === "reviews"
      ? await reviewDetail(db, actor, id, false, history)
      : null;
  const received =
    view === "replies"
      ? await replyDetail(db, actor, id, false, history)
      : null;
  if (own)
    assert(
      own.revisions.some((r: any) => r.managed),
      403,
      "LEGACY_REVIEW",
      "This is a legacy note.",
    );
  const content =
    own?.content ??
    (await db.query("SELECT * FROM contents WHERE id=$1", [id])).rows[0];
  const entry = await getPublished(db, locale, {
    id: content.parent_content_id,
  });
  const contextAvailable = Boolean(
    entry && (view === "reviews" || received?.contextAvailable),
  );
  const publicReview = await getPublished(db, locale, { id });
  const binding =
    (
      await db.query(
        `SELECT p.id,p.owner_id,p.disabled,s.head_revision_id,
 CASE WHEN p.owner_id=$2 OR p.approved THEN p.profiles END AS profiles
 FROM provider_bindings b JOIN personas p ON p.id=b.persona_id LEFT JOIN detail_settings s ON s.kind='persona' AND s.entity_id=p.id WHERE b.content_id=$1`,
        [content.parent_content_id, actor.id],
      )
    ).rows[0] ?? null;
  const identityId = view === "reviews" ? content.persona_id : binding?.id;
  const identity = identityId
    ? ((
        await db.query(
          `SELECT p.id,p.disabled,r.id AS revision_id,r.body AS profiles
 FROM personas p JOIN detail_settings s ON s.entity_id=p.id AND s.kind='persona'
 JOIN detail_setting_revisions r ON r.id=s.head_revision_id WHERE p.id=$1 AND p.owner_id=$2`,
          [identityId, actor.id],
        )
      ).rows[0] ?? null)
    : null;
  const publicReply =
    (
      await db.query(
        `SELECT r.id,r.profiles,r.body,r.source_locale,p.published_at FROM review_replies q
 JOIN reply_publications p ON p.id=q.published_id JOIN reply_revisions r ON r.id=p.revision_id WHERE q.review_id=$1 AND NOT q.hidden`,
        [id],
      )
    ).rows[0] ?? null;
  const world = (
    await db.query(
      "SELECT coalesce(translations->$2,translations->source_locale) AS text FROM worlds WHERE id=$1",
      [content.world_id, locale],
    )
  ).rows[0];
  return {
    id,
    view,
    historyPage: history.page,
    historyPages: Math.max(
      1,
      Math.ceil((own?.historyTotal ?? received?.historyTotal ?? 0) / 20),
    ),
    entry: contextAvailable ? entry : null,
    world: contextAvailable ? world.text : null,
    contextAvailable,
    publicReview: contextAvailable ? publicReview : null,
    publicReply: contextAvailable && publicReview ? publicReply : null,
    review: own,
    reply: received,
    identity: identity
      ? { ...identity, profiles: signatureProfiles(identity.profiles) }
      : null,
    provider:
      contextAvailable && binding
        ? {
            id: binding.id,
            profiles: signatureProfiles(binding.profiles ?? {}),
          }
        : null,
    canEdit: Boolean(
      contextAvailable &&
      identity &&
      !identity.disabled &&
      (view === "reviews" || received?.canEdit),
    ),
    submissionGuard:
      view === "reviews"
        ? content.submitted_revision_id
        : (received?.submissionGuard ?? null),
    baseRevisionId:
      view === "reviews"
        ? content.head_revision_id
        : (received?.baseRevisionId ?? null),
    submittedRevisionId:
      view === "reviews"
        ? content.submitted_revision_id
        : (received?.reply?.submitted_revision_id ?? null),
  };
}

export const reviewEntrySchema = z
  .object({
    locale: z.enum(["en", "zh-CN"]).default("en"),
    q: z.string().trim().max(200).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
export async function reviewEntries(db: Connection, raw: unknown) {
  const q = reviewEntrySchema.parse(raw);
  const row = (
    await db.query(
      `WITH eligible AS(SELECT c.id,c.kind,w.id AS world_id,
 coalesce(w.translations->$1->>'name',w.translations->w.source_locale->>'name') AS world_name,t.body->>'title' AS title,t.locale
 ${publicFrom} JOIN LATERAL(SELECT tx.body,tx.locale FROM publication_locales l JOIN translations tx ON tx.id=l.translation_id WHERE l.publication_id=p.id ORDER BY (l.locale=$1) DESC,l.locale LIMIT 1)t ON true
 WHERE ${publicVisibility} AND c.kind IN ('stay','experience','service')),
 filtered AS(SELECT * FROM eligible WHERE $2='' OR strpos(lower(title||' '||world_name),lower($2))>0)
 SELECT (SELECT count(*)::int FROM filtered) AS total,coalesce((SELECT jsonb_agg(x) FROM(SELECT * FROM filtered ORDER BY world_name,title,id LIMIT 20 OFFSET $3)x),'[]') AS items`,
      [q.locale, q.q, (q.page - 1) * 20],
    )
  ).rows[0];
  return {
    ...row,
    page: q.page,
    pages: Math.max(1, Math.ceil(row.total / 20)),
  };
}
