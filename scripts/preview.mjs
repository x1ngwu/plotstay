import { access } from 'node:fs/promises';
import { runServices } from './serve.mjs';

try {
  await Promise.all(['apps/api/dist/server.mjs', 'apps/web/dist/server/entry.mjs'].map(path => access(path)));
} catch {
  console.error('Build output is missing. Run npm run build before npm run preview.');
  process.exit(1);
}
runServices(['start:api', 'start:web'], { NODE_ENV: 'production' });
