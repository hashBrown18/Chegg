/**
 * Standalone server for the browser E2E run: memory MongoDB + the real CHEGG
 * server on a fixed port. Kept in its own process so Playwright can kill it
 * without killing the test runner's own process tree.
 *
 * Also exposes a harness-only admin port (never part of the app) so a test can
 * end a game without replaying dozens of turns; rematch is only reachable from
 * a finished game.
 */
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = process.env.E2E_PORT || '5679';
const ADMIN_PORT = process.env.E2E_ADMIN_PORT || '5680';

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('chegg');
  process.env.PORT = PORT;
  console.log(`[e2e] memory mongo up, starting CHEGG server on ${PORT}`);
  require('../server/index.js');

  // index.js exports before the DB connection resolves; the handlers hold live
  // references, so requiring again is safe and gives us the same objects.
  const { io, activeGames } = require('../server/index.js');
  const { finishGame } = require('../server/socket/gameOver');

  http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/end-game') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { roomCode, winnerRole } = JSON.parse(body || '{}');
        const finished = await finishGame(io, roomCode, activeGames, winnerRole);
        res.writeHead(finished ? 200 : 409).end(JSON.stringify({ finished }));
      } catch (err) {
        res.writeHead(500).end(JSON.stringify({ error: err.message }));
      }
    });
  }).listen(ADMIN_PORT, '127.0.0.1', () => {
    console.log(`[e2e] admin harness on ${ADMIN_PORT}`);
  });

  const stop = async () => {
    try { await mongod.stop(); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch((err) => {
  console.error('[e2e] server bootstrap failed:', err);
  process.exit(1);
});
