/**
 * Rematch race: two players in SEPARATE browser contexts (separate
 * localStorage), no reloads anywhere. Finish a game, rematch, both confirm a
 * 15-card deck in either order, and both must reach /game.
 */
const { test, expect } = require('@playwright/test');

const DECK_SIZE = 15;
const ROUNDS = Number(process.env.REMATCH_ROUNDS || 10);

async function createRoom(page, username) {
  await page.goto('/create');
  await page.fill('#input-username', username);
  await page.click('#btn-create-room-submit');
  await expect(page.locator('.lobby-code-display')).toBeVisible({ timeout: 15_000 });
  return (await page.locator('.code-value').textContent()).trim().toLowerCase();
}

async function joinRoom(page, username, roomCode) {
  await page.goto('/join');
  await page.fill('#input-room-code', roomCode);
  await page.fill('#input-username', username);
  await page.click('#btn-join-room-submit');
}

async function confirmDeck(page) {
  await expect(page).toHaveURL(/\/deck/, { timeout: 15_000 });
  for (let i = 0; i < DECK_SIZE; i++) {
    await page.locator('.minion-card:not(.minion-card-disabled)').first().click();
  }
  await expect(page.locator('.deck-counter')).toContainText(String(DECK_SIZE), { timeout: 10_000 });
  await page.click('#btn-confirm-deck');
}

async function expectGame(page, role) {
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
  await expect(page.locator('.gamepage')).toHaveAttribute('data-role', role, { timeout: 15_000 });
}

async function endGame(roomCode, winnerRole) {
  const res = await fetch('http://127.0.0.1:5680/end-game', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode, winnerRole }),
  });
  expect(res.status).toBe(200);
}

function pairSeparate(browser) {
  const hostContext = browser.newContext();
  const guestContext = browser.newContext();
  return Promise.all([hostContext, guestContext]).then(async ([hc, gc]) => ({
    host: await hc.newPage(),
    guest: await gc.newPage(),
    close: async () => { await hc.close(); await gc.close(); },
  }));
}

function pairSameContext(browser) {
  return browser.newContext().then(async (c) => ({
    host: await c.newPage(),
    guest: await c.newPage(),
    close: async () => { await c.close(); },
  }));
}

async function firstMatch(p) {
  const roomCode = await createRoom(p.host, 'Alice');
  await joinRoom(p.guest, 'Bob', roomCode);
  await confirmDeck(p.host);
  await confirmDeck(p.guest);
  await expectGame(p.host, 'host');
  await expectGame(p.guest, 'guest');
  return roomCode;
}

async function rematchRound(p, roomCode, order) {
  await endGame(roomCode, 'host');
  await expect(p.host.locator('.win-screen')).toBeVisible({ timeout: 15_000 });
  await expect(p.guest.locator('.win-screen')).toBeVisible({ timeout: 15_000 });

  await p.host.locator('.win-rematch-btn').click();
  await expect(p.guest.locator('.win-request-text')).toContainText('wants a rematch', { timeout: 15_000 });
  await p.guest.locator('.win-rematch-btn').click();

  await expect(p.host).toHaveURL(/\/deck/, { timeout: 15_000 });
  await expect(p.guest).toHaveURL(/\/deck/, { timeout: 15_000 });

  if (order === 'guest-first') {
    await confirmDeck(p.guest);
    await confirmDeck(p.host);
  } else {
    await confirmDeck(p.host);
    await confirmDeck(p.guest);
  }

  await expectGame(p.host, 'host');
  await expectGame(p.guest, 'guest');
}

test('rematch in separate browsers, host confirms first, 10 rounds, no reloads', async ({ browser }) => {
  test.setTimeout(600_000);
  const p = await pairSeparate(browser);
  const logs = [];
  p.host.on('console', (m) => logs.push(`host: ${m.text()}`));
  p.guest.on('console', (m) => logs.push(`guest: ${m.text()}`));
  try {
    const roomCode = await firstMatch(p);
    for (let round = 1; round <= ROUNDS; round++) {
      try {
        await rematchRound(p, roomCode, 'host-first');
      } catch (err) {
        err.message += `\n--- round ${round} page logs ---\n${logs.slice(-40).join('\n')}`;
        throw err;
      }
    }
  } finally {
    await p.close();
  }
});

test('rematch in separate browsers, guest confirms first, 10 rounds, no reloads', async ({ browser }) => {
  test.setTimeout(600_000);
  const p = await pairSeparate(browser);
  const logs = [];
  p.host.on('console', (m) => logs.push(`host: ${m.text()}`));
  p.guest.on('console', (m) => logs.push(`guest: ${m.text()}`));
  try {
    const roomCode = await firstMatch(p);
    for (let round = 1; round <= ROUNDS; round++) {
      try {
        await rematchRound(p, roomCode, 'guest-first');
      } catch (err) {
        err.message += `\n--- round ${round} page logs ---\n${logs.slice(-40).join('\n')}`;
        throw err;
      }
    }
  } finally {
    await p.close();
  }
});


test('rematch in two tabs of one browser, 10 rounds, no reloads', async ({ browser }) => {
  test.setTimeout(900_000);
  const p = await pairSameContext(browser);
  const logs = [];
  p.host.on('console', (m) => logs.push(`host: ${m.text()}`));
  p.guest.on('console', (m) => logs.push(`guest: ${m.text()}`));
  try {
    const roomCode = await firstMatch(p);
    for (let round = 1; round <= ROUNDS; round++) {
      try {
        await rematchRound(p, roomCode, round % 2 ? 'host-first' : 'guest-first');
      } catch (err) {
        err.message += `\n--- round ${round} page logs ---\n${logs.slice(-60).join('\n')}`;
        throw err;
      }
    }
  } finally {
    await p.close();
  }
});
