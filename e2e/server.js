/**
 * Standalone server for the browser E2E run: memory MongoDB + the real CHEGG
 * server on a fixed port. Kept in its own process so Playwright can kill it
 * without killing the test runner's own process tree.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = process.env.E2E_PORT || '5679';

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('chegg');
  process.env.PORT = PORT;
  console.log(`[e2e] memory mongo up, starting CHEGG server on ${PORT}`);
  require('../server/index.js');

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
