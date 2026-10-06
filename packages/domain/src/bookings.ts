import { transaction, type Database } from '@plotstay/database';
import { bookingSchema, type BookingReceipt } from '@plotstay/contracts';
import { assert } from './errors.ts';
import { digest } from './auth.ts';
import { getPublished, listWorlds } from './read.ts';
export interface BookingOwner { guestId?: string; userId?: string }
const receipt = (row: any): BookingReceipt => ({ id: row.id, createdAt: row.created_at.toISOString(), locale: row.locale, snapshot: row.snapshot });
export function createBooking(db: Database, owner: BookingOwner, raw: unknown) {
  const input = bookingSchema.parse(raw);
  assert(Boolean(owner.guestId) !== Boolean(owner.userId), 401, 'SESSION_REQUIRED', 'Start a visitor session before booking.');
  return transaction(db, async client => {
    // Serialize requests from one identity, including simultaneous retries of the same request.
    if (owner.guestId) await client.query('SELECT id FROM guests WHERE id=$1 FOR UPDATE', [owner.guestId]);
    else await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [owner.userId]);
    const hash = digest(JSON.stringify({ contentId: input.contentId, locale: input.locale, personaId: input.personaId ?? null }));
    const { rows: [existing] } = await client.query(`SELECT * FROM bookings WHERE idempotency_key=$1
      AND (($2::uuid IS NOT NULL AND guest_id=$2) OR ($3::uuid IS NOT NULL AND user_id=$3))`, [input.idempotencyKey, owner.guestId ?? null, owner.userId ?? null]);
    if (existing) {
      assert(existing.request_hash === hash, 409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different booking.');
      return { receipt: receipt(existing), created: false };
    }
    await client.query('SELECT c.id FROM contents c JOIN worlds w ON w.id=c.world_id WHERE c.id=$1 FOR SHARE OF c,w', [input.contentId]);
    const content = await getPublished(client, input.locale, { id: input.contentId });
    assert(content && content.kind !== 'review' && content.attributes.price, 404, 'NOT_BOOKABLE', 'This stay or experience is not available.');
    const world = (await listWorlds(client, input.locale)).find(w => w.id === content.worldId)!;
    let personaName: string | null = null;
    if (input.personaId) {
      assert(owner.userId, 403, 'PERSONA_FORBIDDEN', 'An account is required to use an owned persona.');
      const { rows: [persona] } = await client.query('SELECT profiles FROM personas WHERE id=$1 AND owner_id=$2 AND approved', [input.personaId, owner.userId]);
      assert(persona, 403, 'PERSONA_FORBIDDEN', 'This persona is not available to you.');
      personaName = (persona.profiles[input.locale] ?? persona.profiles[world.sourceLocale])?.name ?? null;
    }
    const snapshot: BookingReceipt['snapshot'] = { contentId: content.id, publicationId: content.publicationId,
      kind: content.kind, title: content.text.title, worldName: world.name, worldSlug: world.slug,
      currencyName: world.currencyName, amount: content.attributes.price.amount, unit: content.attributes.price.unit, personaName };
    const { rows: [row] } = await client.query(`INSERT INTO bookings(guest_id,user_id,persona_id,content_id,publication_id,locale,idempotency_key,request_hash,snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [owner.guestId ?? null, owner.userId ?? null, input.personaId ?? null,
      content.id, content.publicationId, input.locale, input.idempotencyKey, hash, snapshot]);
    return { receipt: receipt(row), created: true };
  });
}
export async function getReceipt(db: Database, owner: BookingOwner, id: string) {
  const { rows: [row] } = await db.query(`SELECT * FROM bookings WHERE id=$1 AND
    (($2::uuid IS NOT NULL AND guest_id=$2) OR ($3::uuid IS NOT NULL AND user_id=$3))`, [id, owner.guestId ?? null, owner.userId ?? null]);
  assert(row, 404, 'NOT_FOUND', 'Receipt not found.');
  return receipt(row);
}
