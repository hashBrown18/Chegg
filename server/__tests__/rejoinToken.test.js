/**
 * Rejoin authorization: the private per-player rejoin token is the ONLY
 * credential that can claim a seat, and the disconnect notice carries a
 * relative remainingMs (never an absolute server timestamp).
 */
const { fakeIo, fakeSocket, stubGameState, seed, HOST_TOKEN, GUEST_TOKEN } = require('./testUtils');
const { getForfeitDeadline, FORFEIT_MS, clearAllForfeitTimers } = require('../socket/gameOver');

async function setup(code) {
  await seed(code);
  const io = fakeIo();
  io.activeGames = new Map([[code, stubGameState()]]);
  return io;
}

describe('rejoin authorization', () => {
  beforeEach(() => { jest.useFakeTimers(); clearAllForfeitTimers(); });
  afterEach(() => { clearAllForfeitTimers(); jest.useRealTimers(); });

  test('the correct rejoin token is accepted and restores game state', async () => {
    const code = 'tok-accept';
    const io = await setup(code);

    const back = fakeSocket(io, 'new-socket');
    await back.handlers.rejoin_game({
      roomCode: code,
      rejoinToken: HOST_TOKEN,
      playerId: 'id-alice',
      username: 'Alice',
    });

    expect(back.emitted.some(e => e.event === 'game_start')).toBe(true);
    const start = back.emitted.find(e => e.event === 'game_start');
    expect(start.payload.yourRole).toBe('host');
    expect(start.payload.isReconnection).toBe(true);
    expect(back.emitted.some(e => e.event === 'opponent_reconnected')).toBe(true);
    expect(back.emitted.some(e => e.event === 'error_message')).toBe(false);
  });

  test('a wrong token is rejected before any state is touched', async () => {
    const code = 'tok-wrong';
    const io = await setup(code);

    const intruder = fakeSocket(io, 'intruder');
    await intruder.handlers.rejoin_game({
      roomCode: code,
      rejoinToken: 'not-the-right-token-aaaaaaaaaaaaaaaaaaaaaaaa',
      playerId: 'id-alice', // even with the right identity fields
      username: 'Alice',
    });

    const err = intruder.emitted.find(e => e.event === 'error_message');
    expect(err.payload.message).toBe('Invalid rejoin token');
    expect(intruder.emitted.some(e => e.event === 'game_start')).toBe(false);
    expect(intruder.roomCode).toBeUndefined();
  });

  test('a missing token is rejected', async () => {
    const code = 'tok-missing';
    const io = await setup(code);

    const bare = fakeSocket(io, 'bare');
    await bare.handlers.rejoin_game({ roomCode: code, playerId: 'id-bob', username: 'Bob' });

    const err = bare.emitted.find(e => e.event === 'error_message');
    expect(err.payload.message).toBe('Rejoin token is required');
    expect(bare.emitted.some(e => e.event === 'game_start')).toBe(false);
  });

  test('username alone, playerId alone, and an opponent token never grant a seat', async () => {
    const code = 'tok-identity';
    const io = await setup(code);

    // Username alone
    const byName = fakeSocket(io, 'by-name');
    await byName.handlers.rejoin_game({ roomCode: code, username: 'Alice' });
    expect(byName.emitted.some(e => e.event === 'error_message')).toBe(true);
    expect(byName.emitted.some(e => e.event === 'game_start')).toBe(false);

    // playerId alone
    const byId = fakeSocket(io, 'by-id');
    await byId.handlers.rejoin_game({ roomCode: code, playerId: 'id-alice' });
    expect(byId.emitted.some(e => e.event === 'game_start')).toBe(false);

    // The GUEST's token must not seat someone as the host
    const swapped = fakeSocket(io, 'swapped');
    await swapped.handlers.rejoin_game({ roomCode: code, rejoinToken: GUEST_TOKEN, username: 'Alice' });
    const start = swapped.emitted.find(e => e.event === 'game_start');
    expect(start.payload.yourRole).toBe('guest'); // seat follows the token, never the name
  });

  test('the opponent disconnect notice carries remainingMs and no absolute deadline', async () => {
    const code = 'tok-notice';
    const io = await setup(code);

    const gone = fakeSocket(io, 'host-socket');
    gone.roomCode = code;
    gone.playerRole = 'host';
    gone.username = 'Alice';
    await gone.handlers.disconnect();

    const notice = gone.emitted.find(e => e.event === 'opponent_disconnected');
    expect(notice.payload.remainingMs).toBe(FORFEIT_MS);
    expect(notice.payload.deadline).toBeUndefined();
    expect(Object.keys(notice.payload)).not.toContain('endsAt');
    expect(typeof notice.payload.message).toBe('string');
    // The absolute deadline stays server-side only.
    expect(getForfeitDeadline(code, 'host')).toBeGreaterThan(Date.now());
  });
});
