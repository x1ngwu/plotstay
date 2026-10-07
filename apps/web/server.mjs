import { createServer } from 'node:http';
import { constants } from 'node:zlib';
import compression from 'compression';

// Keep Astro's static-file and SSR handler; add transport compression to both.
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./dist/server/entry.mjs');
const compress = compression({
  threshold: 1024,
  brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } },
  filter: (request, response) => !request.headers.range && compression.filter(request, response),
});
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4321);
const server = createServer((request, response) => compress(request, response, () => handler(request, response)));
server.on('error', error => { console.error(error); process.exit(1); });
server.listen(port, host, () => console.log(`PlotStay built preview listening on http://${host}:${port}`));
const stop = () => {
  server.close(() => process.exit(0));
  setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 4000).unref();
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
