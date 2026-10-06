import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
export async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
export async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}
export async function waitFor(url: string, child: ChildProcess, logs: () => string) {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`Service exited: ${logs()}`);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
    await delay(100);
  }
  throw new Error(`Service did not become ready: ${logs()}`);
}
export async function artifactHash() {
  const files = (await readdir('apps/web/dist', { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => `${entry.parentPath}/${entry.name}`).sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(await readFile(file));
  return hash.digest('hex');
}
