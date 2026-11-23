/**
 * Room identity is per tab. Two players in ONE browser share localStorage, so a
 * token stored there is overwritten by whoever joined last and both sockets end
 * up claiming the same seat. These tests cover both browser layouts:
 *   - two tabs of one context (shared localStorage)
 *   - two separate contexts (separate localStorage)
 * Both must reach /game with the right role.
 */
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

async function playThrough(hostPage, guestPage) {
  const roomCode = await createRoom(hostPage, 'Alice');
  await joinRoom(guestPage, 'Bob', roomCode);

  await confirmDeck(hostPage);
  await confirmDeck(guestPage);

  await expectGame(hostPage, 'host');
  await expectGame(guestPage, 'guest');
  return roomCode;
}

// Harness-only endpoint in e2e/server.js — ends the match without replaying it.
async function endGame(roomCode, winnerRole) {
  const res = await fetch('http://127.0.0.1:5680/end-game', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomCode, winnerRole }),
  });
  expect(res.status).toBe(200);
}

test('two tabs of one browser: both players confirm decks and reach the game', async ({ browser }) => {
  const context = await browser.newContext(); // shared localStorage
  const host = await context.newPage();
  const guest = await context.newPage();
  try {
    await playThrough(host, guest);
  } finally {
    await context.close();
  }
});

test('reopened host tab keeps the host seat while the guest is still playing', async ({ browser }) => {
  const context = await browser.newContext(); // shared localStorage
  const host = await context.newPage();
  const guest = await context.newPage();
  try {
    const roomCode = await createRoom(host, 'Alice');
    await joinRoom(guest, 'Bob', roomCode);
    await confirmDeck(host);
    await confirmDeck(guest);
    await expectGame(host, 'host');
    await expectGame(guest, 'guest');

    const hostUrl = host.url();
    await host.close(); // sessionStorage dies with the closed tab

    // The guest's join overwrote the plain shared localStorage entry, but the
    // per-room/per-role fallback still has the host token.
    const reopened = await context.newPage();
    await reopened.goto(hostUrl);
    await expectGame(reopened, 'host');
  } finally {
    await context.close();
  }
});

test('two separate browsers: both players confirm decks and reach the game', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await playThrough(host, guest);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('rematch: both tabs refresh mid-rematch and rejoin with their roles', async ({ browser }) => {
  const context = await browser.newContext(); // shared localStorage
  const host = await context.newPage();
  const guest = await context.newPage();
  try {
    const roomCode = await playThrough(host, guest);

    await endGame(roomCode, 'host');
    await expect(host.locator('.win-screen')).toBeVisible({ timeout: 15_000 });
    await expect(guest.locator('.win-screen')).toBeVisible({ timeout: 15_000 });

    // Host asks, guest accepts.
    await host.locator('.win-rematch-btn').click();
    await expect(guest.locator('.win-request-text')).toContainText('wants a rematch', { timeout: 15_000 });
    await guest.locator('.win-rematch-btn').click();

    await expect(host).toHaveURL(/\/deck/, { timeout: 15_000 });
    await expect(guest).toHaveURL(/\/deck/, { timeout: 15_000 });

    // Refresh both during the rematch deck phase — the rotated token must work.
    await Promise.all([host.reload(), guest.reload()]);
    await expect(host.locator('.deck-counter')).toBeVisible({ timeout: 15_000 });
    await expect(guest.locator('.deck-counter')).toBeVisible({ timeout: 15_000 });

    await confirmDeck(host);
    await confirmDeck(guest);
    await expectGame(host, 'host');
    await expectGame(guest, 'guest');
  } finally {
    await context.close();
  }
});

test('refreshing both players mid-game five times keeps both seated', async ({ browser }) => {
  const context = await browser.newContext(); // shared localStorage
  const host = await context.newPage();
  const guest = await context.newPage();
  try {
    await playThrough(host, guest);

    // A refresh leaves the old socket registered for a moment; the new socket
    // must still win the seat instead of being refused as "another tab".
    for (let i = 0; i < 5; i++) {
      await Promise.all([host.reload(), guest.reload()]);
      await expectGame(host, 'host');
      await expectGame(guest, 'guest');
    }
  } finally {
    await context.close();
  }
});
