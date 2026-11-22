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
