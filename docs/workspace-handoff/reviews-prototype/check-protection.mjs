import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const base = 'https://plotstay.xingwu.dev';
const paths = [
  '/_design/reviews/', '/_design/reviews/?lang=en&view=replies',
  '/_design/reviews/app.js', '/_design/reviews/data.js',
  '/_design/reviews/style.css', '/_design/reviews/workspace-shell.css',
  '/_design/reviews/comparison.html', '/_design/reviews/comparison.css', '/_design/reviews/reference/01-my-reviews-desktop.png',
  '/_design/reviews/gallery.html', '/_design/reviews/screenshots/reviews-list-zh-1440.png',
  '/_design/reviews/missing-file', '/_design/personas/', '/_design/overview/',
  '/zh/workspace?view=reviews', '/en/workspace?view=replies', '/api/me/reviews', '/robots.txt',
];
const results = [];
for (const path of paths) {
  const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const entry = { path, status: response.status, robots: response.headers.get('x-robots-tag'), cache: response.headers.get('cache-control'), challenge: response.headers.get('www-authenticate') };
  assert.equal(entry.status, path === '/robots.txt' ? 200 : 401, path);
  assert.match(entry.robots, /noindex.*nofollow.*noarchive/, path);
  assert.match(entry.cache, /no-store/, path);
  if (entry.status === 401) assert.match(entry.challenge, /Basic/, path);
  else assert.match(await response.text(), /Disallow: \//);
  results.push(entry);
}
await writeFile(new URL('./protection.json', import.meta.url), JSON.stringify({ time: new Date().toISOString(), results, authenticatedBrowser: 'Not verified: no Basic Auth credential read or supplied. Interaction evidence was captured from the same static files locally.' }, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.length, authenticatedBrowser: 'not verified' }));
