import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { transaction, type Database, type Connection } from '@plotstay/database';
import { assert } from './errors.ts';
const scrypt = promisify(scryptCallback);
export interface Actor { id: string; email: string; siteRole: 'user' | 'admin' }
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64) as Buffer).toString('hex')}`;
}
async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64) as Buffer;
  const buffer = Buffer.from(expected, 'hex');
  return actual.length === buffer.length && timingSafeEqual(actual, buffer);
}
export async function login(db: Database, email: string, password: string) {
  const { rows: [user] } = await db.query('SELECT * FROM users WHERE email=$1 AND active', [email.toLowerCase()]);
  const valid = await verifyPassword(password, user?.password_hash ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`);
  assert(user && valid, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const token = randomBytes(32).toString('base64url');
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '12 hours')", [digest(token), user.id]);
  return { token, actor: { id: user.id, email: user.email, siteRole: user.site_role } as Actor };
}
export async function getActor(db: Connection, token?: string): Promise<Actor | null> {
  if (!token || token.length > 128) return null;
  const { rows: [user] } = await db.query(`SELECT u.id,u.email,u.site_role FROM sessions s
    JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [digest(token)]);
  return user ? { id: user.id, email: user.email, siteRole: user.site_role } : null;
}
export async function getGuest(db: Connection, token?: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const { rows: [row] } = await db.query(`SELECT s.guest_id FROM sessions s JOIN guests g ON g.id=s.guest_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND g.claimed_by IS NULL`, [digest(token)]);
  return row?.guest_id ?? null;
}
export async function createGuest(db: Database) {
  return transaction(db, async client => {
    const { rows: [guest] } = await client.query('INSERT INTO guests DEFAULT VALUES RETURNING id');
    const token = randomBytes(32).toString('base64url');
    await client.query("INSERT INTO sessions(token_hash,guest_id,expires_at) VALUES ($1,$2,now()+interval '180 days')", [digest(token), guest.id]);
    return { id: guest.id as string, token };
  });
}
export async function requireWorld(db: Connection, actor: Actor, worldId: string, manage = false) {
  const { rows: [world] } = await db.query(`SELECT w.*,m.role FROM worlds w LEFT JOIN world_members m
    ON m.world_id=w.id AND m.user_id=$2 WHERE w.id=$1`, [worldId, actor.id]);
  if (world?.owner_id === actor.id) world.role = 'owner';
  assert(world && (actor.siteRole === 'admin' || world.role), 403, 'WORLD_FORBIDDEN', 'You do not have access to this world.');
  assert(!manage || actor.siteRole === 'admin' || ['owner','admin'].includes(world.role), 403, 'REVIEW_FORBIDDEN', 'A world administrator must review this content.');
  return world;
}
