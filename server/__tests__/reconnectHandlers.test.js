/**
 * Handler-level tests for the disconnect / reconnect race that left the
 * opponent's forfeit countdown running after a refresh.
 */
const { fakeIo, fakeSocket, stubGameState, seed, HOST_TOKEN } = require('./testUtils');
const { getForfeitDeadline, FORFEIT_MS, clearAllForfeitTimers } = require('../socket/gameOver');
const { findRoom, saveRoom } = require('../socket/roomHandlers');

describe('disconnect / reconnect', () => {
  beforeEach(() => { jest.useFakeTimers(); clearAllForfeitTimers(); });
  afterEach(() => { clearAllForfeitTimers(); jest.useRealTimers(); });

  test('a stale disconnect after refresh does not re-arm the clock', async () => {
    const code = 'race-stale';
    await seed(code);
    const io = fakeIo();
    io.activeGames = new Map([[code, stubGameState()]]);

    // The refreshed page already rebound the slot to a new socket.
    const room = await findRoom(code);
    room.host.socketId = 'new-socket';
    await saveRoom(room);

    const stale = fakeSocket(io, 'old-socket');
    stale.roomCode = code;
    stale.playerRole = 'host';
    stale.username = 'Alice';
    await stale.handlers.disconnect();

    expect(stale.emitted.filter(e => e.event === 'opponent_disconnected')).toHaveLength(0);
    expect(getForfeitDeadline(code, 'host')).toBeNull();
    expect((await findRoom(code)).host.connected).toBe(true);
  });

  test('reconnecting cancels the clock and tells the opponent', async () => {
    const code = 'race-reconnect';
    await seed(code);
    const io = fakeIo();
    io.activeGames = new Map([[code, stubGameState()]]);

    const gone = fakeSocket(io, 'host-socket');
    gone.roomCode = code;
    gone.playerRole = 'host';
    gone.username = 'Alice';
    await gone.handlers.disconnect();

    // The opponent got the countdown with server remainingMs.
    const notice = gone.emitted.find(e => e.event === 'opponent_disconnected');
    expect(typeof notice.payload.remainingMs).toBe('number');
    expect(notice.payload.remainingMs).toBe(FORFEIT_MS);
    expect(getForfeitDeadline(code, 'host')).toBeDefined();

    // Same player comes back on a brand new socket (matched by rejoin token).
    const back = fakeSocket(io, 'new-socket');
    await back.handlers.rejoin_game({ roomCode: code, rejoinToken: HOST_TOKEN, username: 'Alice' });

    expect(getForfeitDeadline(code, 'host')).toBeNull();
    expect(back.emitted.some(e => e.event === 'game_start')).toBe(true);
    expect(back.emitted.some(e => e.event === 'opponent_reconnected')).toBe(true);

    // The forfeit clock must never fire after a successful reconnect.
    jest.advanceTimersByTime(FORFEIT_MS);
    expect(io.events.filter(e => e.event === 'game_over')).toHaveLength(0);
  });

  test('no reconnect: the connected player wins once, the loser gets the same result', async () => {
    const code = 'race-forfeit';
    await seed(code);
    const io = fakeIo();
    io.activeGames = new Map([[code, stubGameState()]]);

    const gone = fakeSocket(io, 'host-socket');
    gone.roomCode = code;
    gone.playerRole = 'host';
    gone.username = 'Alice';
    await gone.handlers.disconnect();

    // Guest is still online in the socket room.
    io.sockets.adapter.rooms.set(code, new Set(['guest-live']));
    io.sockets.sockets.set('guest-live', { playerRole: 'guest' });

    await jest.advanceTimersByTimeAsync(FORFEIT_MS);

    const results = io.events.filter(e => e.event === 'game_over');
    expect(results).toHaveLength(1);
    expect(results[0].payload.winnerId).toBe('id-bob');
    expect(results[0].payload.loserId).toBe('id-alice');
    expect((await findRoom(code)).gameState.status).toBe('finished');
    expect((await findRoom(code)).gameState.winnerRole).toBe('guest');
  });

  test('both players gone: the game is abandoned, nobody is declared winner', async () => {
    const code = 'race-both-gone';
    await seed(code);
    const io = fakeIo();
    io.activeGames = new Map([[code, stubGameState()]]);

    const gone = fakeSocket(io, 'host-socket');
    gone.roomCode = code;
    gone.playerRole = 'host';
    gone.username = 'Alice';
    await gone.handlers.disconnect();

    await jest.advanceTimersByTimeAsync(FORFEIT_MS);

    expect(io.events.filter(e => e.event === 'game_over')).toHaveLength(0);
    expect(io.events.filter(e => e.event === 'game_abandoned')).toHaveLength(1);
  });
});
