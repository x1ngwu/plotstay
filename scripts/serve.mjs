import { spawn } from 'node:child_process';

export function runServices(scripts, environment = {}) {
  const children = [];
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
    const timer = setTimeout(() => {
      for (const child of children) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    }, 5000);
    timer.unref();
  }
  for (const script of scripts) {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit', detached: true, env: { ...process.env, ...environment },
    });
    children.push(child);
    child.on('error', error => { console.error(error.message); stop(1); });
    child.on('exit', code => stop(code || 1));
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
}
