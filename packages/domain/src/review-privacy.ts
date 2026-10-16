// A personal review is identified by immutable signatures, not by its newest status.
// Legacy editorial notes (managed=false) retain world-editor collaboration.
export const personalReview = (c='c') => `(${c}.kind='review' AND EXISTS(SELECT 1 FROM content_revisions private_r JOIN review_signatures private_s ON private_s.revision_id=private_r.id WHERE private_r.content_id=${c}.id AND private_s.managed))`;
export const readablePublication = (c='c',w='w') => `(${c}.published_publication_id IS NOT NULL AND NOT ${c}.site_blocked AND ${w}.visible AND NOT ${w}.site_blocked AND EXISTS(SELECT 1 FROM contents private_parent WHERE private_parent.id=${c}.parent_content_id AND private_parent.published_publication_id IS NOT NULL AND NOT private_parent.site_blocked))`;
