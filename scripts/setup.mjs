import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../.env', import.meta.url);
const password = randomBytes(24).toString('base64url');
const adminPassword = randomBytes(24).toString('base64url');
const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
try {
  await writeFile(path, template.replaceAll('replace-with-a-random-password', password)
    .replace('replace-with-at-least-16-random-characters', adminPassword), { flag: 'wx', mode: 0o600 });
  console.log('Created .env with independent local credentials. Admin credentials stay in .env.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; preserved existing settings.');
}
