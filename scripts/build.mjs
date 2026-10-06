import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

// Bundle workspace TypeScript, leave ordinary Node dependencies external.
await build({ entryPoints: ['apps/api/src/server.ts'], outfile: 'apps/api/dist/server.mjs',
  bundle: true, platform: 'node', target: 'node22', format: 'esm', sourcemap: true,
  external: ['pg', 'dotenv', 'fastify', '@fastify/*', 'zod'] });
await build({ entryPoints: ['apps/worker/src/main.ts'], outfile: 'apps/worker/dist/main.mjs',
  bundle: true, platform: 'node', target: 'node22', format: 'esm', sourcemap: true,
  external: ['pg', 'dotenv', 'zod'] });
const web = spawnSync('npm', ['run', 'build', '--workspace', '@plotstay/web'], { stdio: 'inherit' });
if (web.error) throw web.error;
process.exitCode = web.status ?? 1;
