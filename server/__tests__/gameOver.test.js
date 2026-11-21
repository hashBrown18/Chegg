/**
 * Tests for the single game-finish path and the forfeit clock.
 * Runs against the in-memory room store (no MongoDB in unit tests).
 */
const {
  FORFEIT_MS,
  buildGameOverPayload,
  finishGame,
  startForfeitTimer,
  clearForfeitTimer,
  clearRoomForfeitTimers,
  getForfeitDeadline,
} = require('../socket/gameOver');
const { findRoom, saveRoom } = require('../socket/roomHandlers');

function fakeIo() {
  const events = [];
  return {
    events,
    to: () => ({ emit: (event, payload) => events.push({ event, payload }) }),
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
  };
}

function seedRoom(code) {
  return saveRoom({
    roomCode: code,
    host: { username: 'Alice', playerId: 'id-alice', socketId: 'host-socket', connected: true },
    guest: { username: 'Bob', playerId: 'id-bob', socketId: 'guest-socket', connected: true },
    gameState: { status: 'playing', winnerRole: '' },
  });
}

test('payload carries winner/loser ids and usernames for one shared broadcast', () => {
  const room = {
    host: { username: 'Alice', playerId: 'id-alice' },
    guest: { username: 'Bob', playerId: 'id-bob' },
  };

  expect(buildGameOverPayload(room, 'guest')).toEqual({
    winnerRole: 'guest',
    loserRole: 'host',
    winnerId: 'id-bob',
    loserId: 'id-alice',
    winnerUsername: 'Bob',
    loserUsername: 'Alice',
  });
});

test('finishGame emits game_over exactly once and persists status', async () => {
  const code = 'room-once';
  await seedRoom(code);
  const io = fakeIo();
  const activeGames = new Map([[code, { status: 'playing' }]]);

  expect(await finishGame(io, code, activeGames, 'host')).toBe(true);
  expect(await finishGame(io, code, activeGames, 'guest')).toBe(false);

  expect(io.events).toHaveLength(1);
  expect(io.events[0].event).toBe('game_over');
  expect(io.events[0].payload.winnerId).toBe('id-alice');
  expect(activeGames.get(code).status).toBe('finished');
  expect((await findRoom(code)).gameState.status).toBe('finished');
});

test('finishGame with no winner abandons the game instead of picking one', async () => {
  const code = 'room-both-gone';
  await seedRoom(code);
  const io = fakeIo();
  const activeGames = new Map([[code, { status: 'playing' }]]);

  expect(await finishGame(io, code, activeGames, null)).toBe(true);

  expect(io.events).toHaveLength(1);
  expect(io.events[0].event).toBe('game_abandoned');
  expect((await findRoom(code)).gameState.status).toBe('finished');
});

describe('forfeit clock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    clearRoomForfeitTimers('room-timer');
    jest.useRealTimers();
  });

  test('fires once after the timer and exposes a deadline', async () => {
    const cb = jest.fn();
    const { deadline } = await startForfeitTimer('room-timer', 'host', cb);

    expect(deadline).toBe(Date.now() + FORFEIT_MS);
    expect(getForfeitDeadline('room-timer', 'host')).toBe(deadline);

    jest.advanceTimersByTime(FORFEIT_MS);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('reconnect clears the clock before it can fire', async () => {
    const cb = jest.fn();
    await startForfeitTimer('room-timer', 'host', cb);
    clearForfeitTimer('room-timer', 'host');

    jest.advanceTimersByTime(FORFEIT_MS);
    expect(cb).not.toHaveBeenCalled();
  });

  test('a second disconnect replaces the first clock (one per player)', async () => {
    const first = jest.fn();
    const second = jest.fn();
    await startForfeitTimer('room-timer', 'host', first);
    await startForfeitTimer('room-timer', 'host', second);

    jest.advanceTimersByTime(FORFEIT_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('finishing the game clears every clock in the room', async () => {
    const code = 'room-timer';
    await seedRoom(code);
    const cb = jest.fn();
    await startForfeitTimer(code, 'host', cb);
    await startForfeitTimer(code, 'guest', cb);

    await finishGame(fakeIo(), code, new Map([[code, { status: 'playing' }]]), 'host');

    jest.advanceTimersByTime(FORFEIT_MS);
    expect(cb).not.toHaveBeenCalled();
  });
});
