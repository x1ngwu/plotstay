import { transaction, type Database, type Connection } from '@plotstay/database';
import { bookingSchema, quoteSchema, publishedSessions, type BookingQuote, type BookingReceipt, type BookingSnapshot, type QuoteInput } from '@plotstay/contracts';
import { assert } from './errors.ts';
import { digest } from './auth.ts';
import { getPublished, listWorlds } from './read.ts';
export interface BookingOwner { guestId?: string; userId?: string }
const receipt = (row: any): BookingReceipt => ({ id: row.id, createdAt: row.created_at.toISOString(), locale: row.locale, snapshot: row.snapshot });
const day = 86400000;

async function calculate(client: Connection, input: QuoteInput, now = new Date()): Promise<BookingQuote> {
  // Lock the visibility/publication pointers through insertion. Published bodies are immutable.
  await client.query('SELECT c.id FROM contents c JOIN worlds w ON w.id=c.world_id WHERE c.id=$1 FOR SHARE OF c,w', [input.contentId]);
  const content = await getPublished(client, input.locale, { id: input.contentId });
  assert(content && content.kind !== 'review' && content.attributes.price, 404, 'NOT_BOOKABLE', 'This content is no longer available for booking.');
  assert(content.kind === input.trip.kind, 400, 'INVALID_TRIP', 'The trip does not match this content.');
  const world = (await listWorlds(client, input.locale)).find(w => w.id === content.worldId)!;
  const trip = input.trip, price = content.attributes.price;
  const unit = content.kind === 'stay' ? 'night' : content.kind === 'experience' ? 'person' : 'session';
  assert(price.unit === unit, 409, 'PRICE_UNAVAILABLE', 'The published price unit is not supported for this content.');
  const today = now.toISOString().slice(0, 10);
  let multiplier: number, nights: number | null = null, endsAt: string | null = null;
  let sessionSource: BookingSnapshot['sessionSource'] = null;
  if (trip.kind === 'stay') {
    nights = (Date.parse(trip.end) - Date.parse(trip.start)) / day;
    assert(trip.start >= today && Date.parse(trip.start) <= Date.parse(today) + 365 * day && nights >= 1 && nights <= 30,
      422, 'INVALID_DATES', 'Choose a future stay of 1–30 nights within the next year.');
    assert(!content.attributes.stay?.guests || trip.guests <= content.attributes.stay.guests * trip.rooms,
      422, 'CAPACITY_EXCEEDED', 'Choose enough rooms for your travellers.');
    multiplier = nights * trip.rooms;
  } else {
    const starts = Date.parse(trip.startsAt);
    assert(starts > now.getTime() && new Date(starts).toISOString().slice(0, 10) <= new Date(Date.parse(today) + 365 * day).toISOString().slice(0, 10),
      422, 'INVALID_DATES', 'Choose a future session within the next year.');
    const sessions = publishedSessions(content);
    if (sessions.length) {
      const session = sessions.find(s => Date.parse(s.startsAt) === starts);
      assert(session, 422, 'SESSION_UNAVAILABLE', 'Choose one of the published sessions.');
      endsAt = new Date(session.endsAt).toISOString(); sessionSource = 'published';
    } else {
      const date = new Date(starts);
      assert(content.attributes.durationMinutes, 409, 'SESSION_UNAVAILABLE', 'Session duration has not been published.');
      assert([10, 14].includes(date.getUTCHours()) && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0,
        422, 'SESSION_UNAVAILABLE', 'Choose a 10:00 or 14:00 UTC simulation session.');
      endsAt = new Date(starts + content.attributes.durationMinutes * 60000).toISOString(); sessionSource = 'daily';
    }
    multiplier = trip.kind === 'experience' ? trip.guests : trip.quantity;
  }
  const snapshot: BookingSnapshot = {
    version: 1, contentId: content.id, publicationId: content.publicationId, contentSlug: content.slug,
    kind: content.kind, title: content.text.title, summary: content.text.summary,
    worldId: world.id, worldName: world.name, worldSlug: world.slug, placeId: content.placeId, placeName: content.placeName,
    location: content.kind === 'experience' ? content.text.experience?.meetingAddress || content.placeName || world.name :
      content.kind === 'service' ? content.text.service?.venueAddress || content.placeName || world.name : content.placeName || world.name,
    currencyName: world.currencyName, amount: price.amount, unit, multiplier, total: price.amount * multiplier, fees: 0,
    nights, trip, endsAt, timeZone: 'UTC', sessionSource, locale: input.locale, contentLocale: content.locale, languageTag: content.languageTag,
    personaName: input.locale === 'zh-CN' ? '星际旅客' : 'Star traveller',
    cancellation: content.kind === 'stay' ? content.text.stay?.cancellation || '' : content.kind === 'experience' ? content.text.experience?.cancellation || '' : content.text.service?.cancellation || '',
  };
  return { snapshot, quoteHash: digest(JSON.stringify(snapshot)) };
}
export async function quoteBooking(db: Database, raw: unknown) {
  const input = quoteSchema.parse(raw);
  return transaction(db, client => calculate(client, input));
}
export async function createBooking(db: Database, owner: BookingOwner, raw: unknown) {
  const input = bookingSchema.parse(raw);
  assert(Boolean(owner.guestId) !== Boolean(owner.userId), 401, 'SESSION_REQUIRED', 'Start a visitor session before booking.');
  return transaction(db, async client => {
    const identity = owner.guestId
      ? await client.query('SELECT id FROM guests WHERE id=$1 AND claimed_by IS NULL FOR UPDATE', [owner.guestId])
      : await client.query('SELECT id FROM users WHERE id=$1 AND active FOR UPDATE', [owner.userId]);
    assert(identity.rowCount, 401, 'SESSION_REQUIRED', 'Visitor session is no longer available.');
    const hash = digest(JSON.stringify(input));
    const { rows: [existing] } = await client.query(`SELECT * FROM bookings WHERE idempotency_key=$1
      AND (($2::uuid IS NOT NULL AND guest_id=$2) OR ($3::uuid IS NOT NULL AND user_id=$3))`, [input.idempotencyKey, owner.guestId ?? null, owner.userId ?? null]);
    if (existing) {
      assert(existing.request_hash === hash, 409, 'IDEMPOTENCY_CONFLICT', 'This request key was already used for a different booking.');
      return { receipt: receipt(existing), created: false };
    }
    const quote = await calculate(client, input);
    assert(quote.quoteHash === input.quoteHash, 409, 'QUOTE_CHANGED', 'Content or pricing changed. Review a fresh quote.');
    const issuedAt = new Date().toISOString();
    const snapshot = { ...quote.snapshot, issuedAt };
    const { rows: [row] } = await client.query(`INSERT INTO bookings(guest_id,user_id,content_id,publication_id,locale,idempotency_key,request_hash,snapshot,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [owner.guestId ?? null, owner.userId ?? null,
      input.contentId, snapshot.publicationId, input.locale, input.idempotencyKey, hash, snapshot, issuedAt]);
    return { receipt: receipt(row), created: true };
  });
}
export async function getReceipt(db: Database, owner: BookingOwner, id: string) {
  const { rows: [row] } = await db.query(`SELECT * FROM bookings WHERE id=$1 AND
    (($2::uuid IS NOT NULL AND guest_id=$2) OR ($3::uuid IS NOT NULL AND user_id=$3))`, [id, owner.guestId ?? null, owner.userId ?? null]);
  assert(row, 404, 'NOT_FOUND', 'Receipt not found.');
  return receipt(row);
}
export async function findBooking(db: Database, guestId: string, key: string) {
  const { rows: [row] } = await db.query('SELECT * FROM bookings WHERE guest_id=$1 AND idempotency_key=$2', [guestId, key]);
  return row ? receipt(row) : null;
}
export async function latestBooking(db: Database, guestId: string, contentId: string) {
  const { rows: [row] } = await db.query('SELECT id FROM bookings WHERE guest_id=$1 AND content_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1', [guestId, contentId]);
  return row?.id as string | undefined;
}
