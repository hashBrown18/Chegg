const { test, expect } = require('@playwright/test');
const DECK_SIZE = 15;

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
async function fillDeck(page) {
  await expect(page).toHaveURL(/\/deck/, { timeout: 15_000 });
  for (let i = 0; i < DECK_SIZE; i++) {
    await page.locator('.minion-card:not(.minion-card-disabled)').first().click();
  }
  await expect(page.locator('.deck-counter')).toContainText(String(DECK_SIZE), { timeout: 10_000 });
}
async function expectGame(page, role) {
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
  await expect(page.locator('.gamepage')).toHaveAttribute('data-role', role, { timeout: 15_000 });
}
async function endGame(roomCode, winnerRole) {
  const res = await fetch('http://127.0.0.1:5680/end-game', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode, winnerRole }),
  });
  expect(res.status).toBe(200);
}

test('guest double-confirms during rematch', async ({ browser }) => {
  test.setTimeout(120_000);
  const hc = await browser.newContext();
  const gc = await browser.newContext();
  const host = await hc.newPage();
  const guest = await gc.newPage();
  const logs = [];
  host.on('console', (m) => logs.push(`host: ${m.text()}`));
  guest.on('console', (m) => logs.push(`guest: ${m.text()}`));
  try {
    const roomCode = await createRoom(host, 'Alice');
    await joinRoom(guest, 'Bob', roomCode);
    await fillDeck(host); await host.click('#btn-confirm-deck');
    await fillDeck(guest); await guest.click('#btn-confirm-deck');
    await expectGame(host, 'host'); await expectGame(guest, 'guest');

    await endGame(roomCode, 'host');
    await expect(host.locator('.win-screen')).toBeVisible({ timeout: 15_000 });
    await host.locator('.win-rematch-btn').click();
    await expect(guest.locator('.win-request-text')).toContainText('wants a rematch', { timeout: 15_000 });
    await guest.locator('.win-rematch-btn').click();
    await expect(host).toHaveURL(/\/deck/, { timeout: 15_000 });
    await expect(guest).toHaveURL(/\/deck/, { timeout: 15_000 });

    await fillDeck(host); await host.click('#btn-confirm-deck');
    await fillDeck(guest);
    // Emit deck_confirmed twice in quick succession (simulates double-click)
    await guest.evaluate(() => {
      const socket = window.socket || (window.io && window.io.socket);
      if (socket) {
        socket.emit('deck_confirmed', { deck: Array(15).fill('zombie') });
        socket.emit('deck_confirmed', { deck: Array(15).fill('zombie') });
      }
    });

    try {
      await expectGame(host, 'host');
      await expectGame(guest, 'guest');
    } catch (err) {
      err.message += `\n--- logs ---\n${logs.join('\n')}`;
      throw err;
    }
  } finally {
    await hc.close(); await gc.close();
  }
});
