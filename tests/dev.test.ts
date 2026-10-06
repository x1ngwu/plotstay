import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fixture } from './helpers.ts';

async function freePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}
async function available(url: string) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
}

test('development supervisor starts and stops both services, including in agent environments', { timeout: 60000 }, async t => {
  const f = await fixture();
  t.after(f.cleanup);
  const apiPort = await freePort(), webPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}/api/health`, webUrl = `http://127.0.0.1:${webPort}/zh`;
  const child = spawn(process.execPath, ['scripts/dev.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env, PGOPTIONS: f.options, API_HOST: '127.0.0.1', API_PORT: String(apiPort), HOST: '127.0.0.1',
    PORT: String(webPort), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, CI: '1',
  } });
  let logs = '';
  child.stdout.on('data', chunk => { logs += String(chunk); });
  child.stderr.on('data', chunk => { logs += String(chunk); });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exited; }
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, logs);
    if (await available(apiUrl) && await available(webUrl)) { ready = true; break; }
    await delay(200);
  }
  assert.ok(ready, logs);
  assert.ok((await (await fetch(webUrl)).text()).includes('观察室'));
  child.kill('SIGTERM');
  const [code] = await exited;
  assert.equal(code, 0, logs);
  for (let i = 0; i < 30 && (await available(apiUrl) || await available(webUrl)); i++) await delay(100);
  assert.equal(await available(apiUrl), false, 'API should stop with its supervisor');
  assert.equal(await available(webUrl), false, 'Web should stop with its supervisor');
});
