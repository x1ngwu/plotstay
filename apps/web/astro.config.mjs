import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { config } from 'dotenv';

config({ path: new URL('../../.env', import.meta.url), quiet: true });
export default defineConfig({
  output: 'server',
  // Middleware combines legacy prefixes and slash cleanup into a single 308.
  trailingSlash: 'ignore',
  adapter: node({ mode: 'standalone' }),
  session: false,
  server: { host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 4321) },
  // dev is supervised by scripts/dev.mjs; do not silently select another port.
  vite: { server: { strictPort: true }, build: { assetsInlineLimit: 0 } },
});
