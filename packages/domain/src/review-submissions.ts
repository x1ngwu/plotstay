import type { Connection } from "@plotstay/database";
import { assert } from "./errors.ts";
import type { Actor } from "./auth.ts";

// Caller holds the content lock. The immutable submission freezes translation IDs,
// independently of the editable head/draft token and translation worker progress.
export async function recordReviewSubmission(
  c: Connection,
  actor: Actor,
  entry: any,
  revisionId: string,
) {
  if (entry.submitted_revision_id === revisionId)
    return { revisionId, submissionToken: entry.submission_token };
  const s = (
    await c.query(
      "INSERT INTO review_submissions(content_id,revision_id,draft_token,submitted_by)VALUES($1,$2,$3,$4) RETURNING id",
      [entry.id, revisionId, entry.draft_token, actor.id],
    )
  ).rows[0];
  await c.query(
    "INSERT INTO review_submission_locales SELECT $1,revision_id,locale,translation_id FROM revision_locales WHERE revision_id=$2",
    [s.id, revisionId],
  );
  await c.query(
    "UPDATE contents SET submitted_revision_id=$2,submission_token=$3 WHERE id=$1",
    [entry.id, revisionId, s.id],
  );
  return { revisionId, submissionToken: s.id };
}
export async function checkReviewSubmission(
  c: Connection,
  entry: any,
  revisionId: string,
  token?: string,
) {
  assert(
    entry.submitted_revision_id === revisionId,
    409,
    "SUBMISSION_SUPERSEDED",
    "This is no longer the effective submission. Reload the submitted version.",
  );
  const s = (
    await c.query("SELECT * FROM review_submissions WHERE id=$1", [
      entry.submission_token,
    ])
  ).rows[0];
  assert(
    s && (!token || token === s.id || token === s.draft_token),
    409,
    "REVISION_CONFLICT",
    "The fixed submission changed. Reload before reviewing.",
  );
  return s;
}
