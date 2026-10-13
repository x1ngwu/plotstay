import { createHash } from "node:crypto";
import { z } from "zod";
import { transaction, type Database } from "@plotstay/database";
import { idSchema } from "@plotstay/contracts";
import type { Actor } from "./auth.ts";
import { assert } from "./errors.ts";
import {
  saveReviewInTransaction,
  submitReviewInTransaction,
  saveReplyInTransaction,
  replyActionInTransaction,
} from "./persona-reviews.ts";

export const reviewCommandSchema = z
  .object({
    requestId: idSchema,
    kind: z.enum(["review", "reply"]),
    reviewId: idSchema,
    baseRevisionId: idSchema.nullable(),
    expectedSubmittedRevisionId: idSchema.nullable(),
    expectedPersonaId: idSchema,
    expectedPersonaRevisionId: idSchema,
    action: z.enum(["draft", "submit"]),
    body: z.unknown(),
  })
  .strict();
const canonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
export function saveReviewCommand(db: Database, actor: Actor, raw: unknown) {
  const input = reviewCommandSchema.parse(raw);
  const hash = createHash("sha256")
    .update(JSON.stringify(canonical(input)))
    .digest("hex");
  return transaction(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      actor.id + ":review:" + input.requestId,
    ]);
    const cached = (
      await c.query(
        "SELECT request_hash,result FROM review_save_commands WHERE actor_id=$1 AND request_id=$2",
        [actor.id, input.requestId],
      )
    ).rows[0];
    if (cached) {
      assert(
        cached.request_hash === hash,
        409,
        "REQUEST_CONFLICT",
        "This request ID belongs to different input.",
      );
      return cached.result;
    }
    const review = (
      await c.query(
        "SELECT * FROM contents WHERE id=$1 AND kind='review'" +
          (input.kind === "review" ? " FOR UPDATE" : ""),
        [input.reviewId],
      )
    ).rows[0];
    assert(review, 404, "NOT_FOUND", "Review not found.");
    let personaId = review.persona_id,
      pending = review.submitted_revision_id;
    if (input.kind === "review")
      assert(
        review.author_id === actor.id,
        403,
        "REVIEW_FORBIDDEN",
        "Only the review author can save.",
      );
    else {
      await c.query("SELECT id FROM contents WHERE id=$1 FOR UPDATE", [
        review.parent_content_id,
      ]);
      personaId = (
        await c.query(
          "SELECT persona_id FROM provider_bindings WHERE content_id=$1",
          [review.parent_content_id],
        )
      ).rows[0]?.persona_id;
      pending =
        (
          await c.query(
            "SELECT submitted_revision_id FROM review_replies WHERE review_id=$1 FOR UPDATE",
            [review.id],
          )
        ).rows[0]?.submitted_revision_id ?? null;
    }
    assert(
      personaId === input.expectedPersonaId,
      409,
      "PROVIDER_CHANGED",
      "The speaking identity changed. Review the current identity.",
    );
    const persona = (
      await c.query(
        "SELECT owner_id,disabled FROM personas WHERE id=$1 FOR UPDATE",
        [personaId],
      )
    ).rows[0];
    assert(
      persona?.owner_id === actor.id,
      403,
      "PERSONA_FORBIDDEN",
      "This identity belongs to another account.",
    );
    assert(
      !persona.disabled,
      403,
      "PERSONA_DISABLED",
      "This identity is disabled.",
    );
    const profile = (
      await c.query(
        "SELECT head_revision_id FROM detail_settings WHERE kind='persona' AND entity_id=$1",
        [personaId],
      )
    ).rows[0];
    assert(
      profile?.head_revision_id === input.expectedPersonaRevisionId,
      409,
      "PROFILE_SIGNATURE_STALE",
      "The profile changed. Review the new signature before saving.",
    );
    if (input.action === "submit")
      assert(
        (pending ?? null) === input.expectedSubmittedRevisionId,
        409,
        "SUBMISSION_CONFLICT",
        "The pending submission changed. Review it before replacing.",
      );
    const saved =
      input.kind === "review"
        ? await saveReviewInTransaction(
            c,
            actor,
            review.id,
            input.baseRevisionId!,
            input.body,
          )
        : await saveReplyInTransaction(
            c,
            actor,
            review.id,
            input.body,
            input.baseRevisionId,
            input.expectedPersonaId,
          );
    let submissionToken: string | null = null;
    if (input.action === "submit") {
      if (input.kind === "review")
        submissionToken = (
          await submitReviewInTransaction(c, actor, review.id, saved.revisionId)
        ).submissionToken;
      else
        await replyActionInTransaction(
          c,
          actor,
          review.id,
          "submit",
          saved.revisionId,
        );
    }
    const savedAt = (
      await c.query(
        input.kind === "review"
          ? "SELECT created_at FROM content_revisions WHERE id=$1"
          : "SELECT created_at FROM reply_revisions WHERE id=$1",
        [saved.revisionId],
      )
    ).rows[0].created_at.toISOString();
    const result = {
      savedAt,
      reviewId: review.id,
      id: saved.id,
      revisionId: saved.revisionId,
      kind: input.kind,
      outcome: input.action === "submit" ? "submitted" : "draft",
      submissionToken,
      submittedRevisionId:
        input.action === "submit" ? saved.revisionId : (pending ?? null),
      replacedRevisionId: input.action === "submit" ? (pending ?? null) : null,
    };
    await c.query(
      "INSERT INTO review_save_commands(actor_id,request_id,request_hash,result)VALUES($1,$2,$3,$4)",
      [actor.id, input.requestId, hash, result],
    );
    return result;
  });
}
