/** Stops the E2E stack started by global-setup (children run detached). */
const fs = require('fs');
const path = require('path');

const STATE = path.join(__dirname, '.tmp', 'stack.json');

module.exports = async () => {
  try {
    const { server, client } = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    for (const pid of [client, server]) {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  } catch {
    // nothing to stop
  }
};
