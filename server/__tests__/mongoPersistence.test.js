/**
 * Persistence tests: forfeit deadlines survive in MongoDB, the boot re-arm
 * recomputes the remaining time (or finishes instantly if it already elapsed),
 * and finishGame's DB claim is atomic so the sweep and the re-arm can never
 * both broadcast a result.
 *
 * Uses mongodb-memory-server so the real query shapes are exercised.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const {
  FORFEIT_MS,
  finishGame,
  startForfeitTimer,
  clearForfeitState,
  clearAllForfeitTimers,
  getForfeitDeadline,
  getForfeitRemaining,
  rearmForfeitTimers,
  sweepOnce,
} = require('../socket/gameOver');
const { fakeIo } = require('./testUtils');

jest.setTimeout(30000);

let mongod;

function baseRoom(code, host = {}, guest = {}) {
  return {
    roomCode: code,
    host: { username: 'Alice', playerId: 'id-alice', connected: true, rejoinToken: 'host-secret', ...host },
    guest: { username: 'Bob', playerId: 'id-bob', connected: true, rejoinToken: 'guest-secret', ...guest },
    gameState: { status: 'playing', winnerRole: '' },
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Room.deleteMany({});
  clearAllForfeitTimers();
});

afterEach(() => clearAllForfeitTimers());

describe('forfeit persistence (MongoDB)', () => {
  test('a disconnect writes disconnectedAt and forfeitDeadline, clearForfeitState wipes them', async () => {
    const code = 'mongo-persist';
    await Room.create(baseRoom(code));

    const { deadline } = await startForfeitTimer(code, 'host', jest.fn());

    let doc = await Room.findOne({ roomCode: code });
    expect(doc.host.forfeitDeadline).toBe(deadline);
    expect(doc.host.disconnectedAt).toBeGreaterThan(0);

    await clearForfeitState(code);

    doc = await Room.findOne({ roomCode: code });
    expect(doc.host.forfeitDeadline).toBe(0);
    expect(doc.host.disconnectedAt).toBe(0);
  });

  test('boot re-arm uses the time that is left, not the full window', async () => {
    const code = 'mongo-rearm';
    const deadline = Date.now() + 700;
    await Room.create(baseRoom(code, { disconnectedAt: Date.now(), forfeitDeadline: deadline }));

    const io = fakeIo();
    const activeGames = new Map([[code, { status: 'playing' }]]);
    const onExpire = jest.fn();

    await rearmForfeitTimers(io, activeGames, onExpire);

    const remaining = getForfeitRemaining(code, 'host');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(700);
    expect(getForfeitRemaining(code, 'host')).not.toBe(FORFEIT_MS);
    expect(io.events).toHaveLength(0); // nothing finished yet

    await new Promise((resolve) => setTimeout(resolve, 900));

    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledWith(io, code, 'host', 'Alice', activeGames);
  });

  test('a deadline that already elapsed finishes the game immediately on boot', async () => {
    const code = 'mongo-expired';
    await Room.create(baseRoom(code, {
      disconnectedAt: Date.now() - 65000,
      forfeitDeadline: Date.now() - 5000,
    }));

    const io = fakeIo();
    const activeGames = new Map([[code, { status: 'playing' }]]);
    const onExpire = jest.fn();

    await rearmForfeitTimers(io, activeGames, onExpire);

    const results = io.events.filter((e) => e.event === 'game_over');
    expect(results).toHaveLength(1);
    expect(results[0].payload.winnerRole).toBe('guest'); // host's clock ran out
    expect(getForfeitDeadline(code, 'host')).toBeNull(); // no timer left armed
    expect(onExpire).not.toHaveBeenCalled();

    const doc = await Room.findOne({ roomCode: code });
    expect(doc.gameState.status).toBe('finished');
    expect(doc.gameState.winnerRole).toBe('guest');
    expect(doc.host.forfeitDeadline).toBe(0);
  });

  test('both deadlines elapsed while the server was down → abandoned, nobody wins', async () => {
    const code = 'mongo-both-expired';
    await Room.create(baseRoom(code,
      { disconnectedAt: Date.now() - 65000, forfeitDeadline: Date.now() - 5000 },
      { disconnectedAt: Date.now() - 65000, forfeitDeadline: Date.now() - 4000 },
    ));

    const io = fakeIo();
    const activeGames = new Map([[code, { status: 'playing' }]]);

    await rearmForfeitTimers(io, activeGames, jest.fn());

    expect(io.events.filter((e) => e.event === 'game_over')).toHaveLength(0);
    expect(io.events.filter((e) => e.event === 'game_abandoned')).toHaveLength(1);
    expect((await Room.findOne({ roomCode: code })).gameState.winnerRole).toBe('');
  });
});

describe('finishGame is atomic in the database', () => {
  test('two concurrent finishers race for the claim and exactly one emits', async () => {
    const code = 'mongo-race';
    await Room.create(baseRoom(code));
    const io = fakeIo();
    const activeGames = new Map([[code, { status: 'playing' }]]);

    const results = await Promise.all([
      finishGame(io, code, activeGames, 'host'),
      finishGame(io, code, activeGames, 'guest'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(io.events).toHaveLength(1);
    expect(io.events[0].event).toBe('game_over');

    const doc = await Room.findOne({ roomCode: code });
    expect(doc.gameState.status).toBe('finished');
    // The stored winner matches the one caller that won the claim.
    expect(doc.gameState.winnerRole).toBe(io.events[0].payload.winnerRole);
  });

  test('boot re-arm and the sweep racing on the same room cannot both finish it', async () => {
    const code = 'mongo-rearm-sweep';
    await Room.create(baseRoom(code, {
      disconnectedAt: Date.now() - 65000,
      forfeitDeadline: Date.now() - 1000,
    }));
    const io = fakeIo();
    const activeGames = new Map([[code, { status: 'playing' }]]);
    const onExpire = jest.fn();

    await Promise.all([
      rearmForfeitTimers(io, activeGames, onExpire),
      sweepOnce(io, activeGames),
    ]);

    expect(io.events.filter((e) => e.event === 'game_over')).toHaveLength(1);
    expect(io.events.filter((e) => e.event === 'game_abandoned')).toHaveLength(0);
    expect(onExpire).not.toHaveBeenCalled();
    expect(getForfeitDeadline(code, 'host')).toBeNull();
    expect((await Room.findOne({ roomCode: code })).gameState.status).toBe('finished');
  });

  test('a finished room is never finished again by a later sweep pass', async () => {
    const code = 'mongo-sweep-later';
    await Room.create(baseRoom(code, { forfeitDeadline: Date.now() - 1000 }));
    const io = fakeIo();
    const activeGames = new Map([[code, { status: 'playing' }]]);

    await sweepOnce(io, activeGames);
    await sweepOnce(io, activeGames);

    expect(io.events.filter((e) => e.event === 'game_over')).toHaveLength(1);
    // Room is finished, so it drops out of the sweep query entirely.
    expect((await Room.find({ 'gameState.status': 'playing' }))).toHaveLength(0);
  });
});

describe('timer shutdown', () => {
  test('clearAllForfeitTimers disarms every clock in the process', async () => {
    const code = 'mongo-shutdown';
    await Room.create(baseRoom(code));

    await startForfeitTimer(code, 'host', jest.fn());
    await startForfeitTimer(code, 'guest', jest.fn());
    expect(getForfeitDeadline(code, 'host')).not.toBeNull();
    expect(getForfeitDeadline(code, 'guest')).not.toBeNull();

    clearAllForfeitTimers();

    expect(getForfeitDeadline(code, 'host')).toBeNull();
    expect(getForfeitDeadline(code, 'guest')).toBeNull();
  });
});
