/**
 * Starts the E2E stack: memory-mongo server, a client build pointed at it, and
 * a static preview of that build. Builds into client/dist-e2e so the committed
 * client/dist is left untouched.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(__dirname, '.tmp');
const STATE = path.join(TMP, 'stack.json');
const SERVER_PORT = 5679;
const CLIENT_PORT = 5173;
const SOCKET_URL = `http://localhost:${SERVER_PORT}`;

function waitForPort(port, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${port}`));
          return;
        }
        setTimeout(attempt, 250);
      });
      req.on('timeout', () => req.destroy());
    };
    attempt();
  });
}

function freePort(port) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
    if (pids) {
      for (const pid of pids.split('\n')) process.kill(Number(pid), 'SIGKILL');
    }
  } catch {
    // nothing listening
  }
}

function spawnLogged(name, command, args, options) {
  const log = fs.openSync(path.join(TMP, `${name}.log`), 'w');
  const child = spawn(command, args, { ...options, detached: true, stdio: ['ignore', log, log] });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[e2e] ${name} exited with ${code}`);
  });
  return child;
}

module.exports = async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  freePort(SERVER_PORT);
  freePort(CLIENT_PORT);

  const server = spawnLogged('server', process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, E2E_PORT: String(SERVER_PORT) },
  });
  await waitForPort(SERVER_PORT);

  execSync('npx vite build --outDir dist-e2e --emptyOutDir', {
    cwd: path.join(ROOT, 'client'),
    env: { ...process.env, VITE_SOCKET_URL: SOCKET_URL },
    stdio: 'inherit',
  });

  const client = spawnLogged('client', 'npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--host', '127.0.0.1', '--port', String(CLIENT_PORT), '--strictPort'], {
    cwd: path.join(ROOT, 'client'),
    env: { ...process.env, VITE_SOCKET_URL: SOCKET_URL },
  });
  await waitForPort(CLIENT_PORT);

  fs.writeFileSync(STATE, JSON.stringify({ server: server.pid, client: client.pid }));
};
