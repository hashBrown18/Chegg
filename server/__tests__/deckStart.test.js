/**
 * End-to-end (handler-level) deck flow: two sockets create/join a room, both
 * confirm a legal 15-card deck, and both must receive game_start.
 *
 * Runs against mongodb-memory-server so the real Mongo queries are exercised.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const registerRoomHandlers = require('../socket/roomHandlers');
const registerGameHandlers = require('../socket/gameHandlers');
const registerReconnectHandlers = require('../socket/reconnectHandlers');
const Room = require('../models/Room');
const { finishGame } = require('../socket/gameOver');

jest.setTimeout(30000);

const DECK = [
  'zombie', 'zombie', 'zombie', 'creeper', 'creeper',
  'puffer_fish', 'iron_golem', 'skeleton', 'blaze', 'phantom',
  'enderman', 'shulker_box', 'wither', 'zombie', 'creeper',
];

function makeIo() {
  const io = {
    events: [],
    activeGames: new Map(),
    sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
  };
  io.on = () => {};
  io.to = (room) => ({
    emit: (event, payload) => {
      io.events.push({ room, event, payload });
      for (const sid of io.sockets.adapter.rooms.get(room) || []) {
        const s = io.sockets.sockets.get(sid);
        if (s) s.emit(event, payload);
      }
    },
  });
  return io;
}

function makeSocket(io, id, { responds = true } = {}) {
  const handlers = {};
  const emitted = [];
  const socket = {
    id,
    handlers,
    emitted,
    rooms: new Set(),
    connected: true,
    on: (event, fn) => { handlers[event] = fn },
    // A live client answers the server's liveness probe; `responds: false`
    // simulates the leftover socket of a refreshed tab.
    emit: (event, payload, ack) => {
      emitted.push({ event, payload });
      if (event === '__alive' && responds && typeof ack === 'function') ack();
    },
    disconnect: () => {
      socket.evicted = true;
      io.sockets.sockets.delete(id);
    },
    join: (room) => {
      socket.rooms.add(room);
      if (!io.sockets.adapter.rooms.has(room)) io.sockets.adapter.rooms.set(room, new Set());
      io.sockets.adapter.rooms.get(room).add(id);
    },
    to: (room) => ({
      emit: (event, payload) => {
        for (const sid of io.sockets.adapter.rooms.get(room) || []) {
          if (sid !== id) io.sockets.sockets.get(sid)?.emit(event, payload);
        }
      },
    }),
  };
  io.sockets.sockets.set(id, socket);
  registerRoomHandlers(io, socket, io.activeGames);
  registerGameHandlers(io, socket, io.activeGames);
  registerReconnectHandlers(io, socket, io.activeGames);
  return socket;
}

let mongod;

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
});

test('both players confirming a deck starts the game for both', async () => {
  const io = makeIo();

  const host = makeSocket(io, 'host-sock');
  await host.handlers.create_room({ username: 'Alice', playerId: 'id-alice' });
  const created = host.emitted.find((e) => e.event === 'room_created');
  expect(created).toBeDefined();
  const roomCode = created.payload.roomCode;

  const guest = makeSocket(io, 'guest-sock');
  await guest.handlers.join_room({ username: 'Bob', roomCode, playerId: 'id-bob' });
  expect(guest.emitted.some((e) => e.event === 'room_joined')).toBe(true);

  // The real client navigates to /deck, which immediately emits rejoin_game.
  const hostToken = created.payload.rejoinToken;
  const guestToken = guest.emitted.find((e) => e.event === 'room_joined').payload.rejoinToken;
  await host.handlers.rejoin_game({ roomCode, rejoinToken: hostToken, playerId: 'id-alice' });
  await guest.handlers.rejoin_game({ roomCode, rejoinToken: guestToken, playerId: 'id-bob' });

  await Promise.all([
    host.handlers.deck_confirmed({ deck: DECK }),
    guest.handlers.deck_confirmed({ deck: DECK }),
  ]);

  const hostStart = host.emitted.find((e) => e.event === 'game_start');
  const guestStart = guest.emitted.find((e) => e.event === 'game_start');
  expect(hostStart).toBeDefined();
  expect(guestStart).toBeDefined();
  expect(hostStart.payload.yourRole).toBe('host');
  expect(guestStart.payload.yourRole).toBe('guest');
  expect(hostStart.payload.boardState).toBeTruthy();
  expect(Object.keys(hostStart.payload.boardState).length).toBeGreaterThan(0);

  const room = await Room.findOne({ roomCode });
  expect(room.gameState.status).toBe('playing');
});

/**
 * Regression: two players in two tabs of ONE browser share localStorage, so the
 * second tab's rejoin token overwrites the first tab's and BOTH sockets rejoin
 * as the same player. Both decks then land on one seat, hostReady stays false,
 * and both clients sit on "Waiting for opponent..." forever.
 */
test('a socket that already holds a seat cannot rejoin as the other player', async () => {
  const io = makeIo();

  const host = makeSocket(io, 'host-sock');
  await host.handlers.create_room({ username: 'Alice', playerId: 'id-alice' });
  const created = host.emitted.find((e) => e.event === 'room_created');
  const roomCode = created.payload.roomCode;

  const guest = makeSocket(io, 'guest-sock');
  await guest.handlers.join_room({ username: 'Bob', roomCode, playerId: 'id-bob' });
  const joined = guest.emitted.find((e) => e.event === 'room_joined');

  // Both tabs read the same localStorage entry, so both send the guest token.
  await guest.handlers.rejoin_game({ roomCode, rejoinToken: joined.payload.rejoinToken });
  await host.handlers.rejoin_game({ roomCode, rejoinToken: joined.payload.rejoinToken });

  expect(host.playerRole).toBe('host');
  expect(guest.playerRole).toBe('guest');
  const rejected = host.emitted.find((e) => e.event === 'error_message');
  expect(rejected.payload.message).toMatch(/already holds the other seat/);

  await Promise.all([
    host.handlers.deck_confirmed({ deck: DECK }),
    guest.handlers.deck_confirmed({ deck: DECK }),
  ]);

  const hostStart = host.emitted.find((e) => e.event === 'game_start');
  const guestStart = guest.emitted.find((e) => e.event === 'game_start');
  expect(hostStart).toBeDefined();
  expect(guestStart).toBeDefined();
  expect(hostStart.payload.yourRole).toBe('host');
  expect(guestStart.payload.yourRole).toBe('guest');
  expect((await Room.findOne({ roomCode })).gameState.status).toBe('playing');
});

/**
 * Regression: a duplicated tab copies sessionStorage, so it presents the same
 * rejoin token as the live tab. Taking the seat would silently move the game
 * out from under the tab the player is actually using, so the duplicate is
 * rejected with an explicit event instead of freezing.
 */
test('a second live socket cannot take a seat that is already held', async () => {
  const io = makeIo();

  const host = makeSocket(io, 'host-sock');
  await host.handlers.create_room({ username: 'Alice', playerId: 'id-alice' });
  const created = host.emitted.find((e) => e.event === 'room_created');
  const roomCode = created.payload.roomCode;

  const duplicate = makeSocket(io, 'duplicate-sock');
  await duplicate.handlers.rejoin_game({ roomCode, rejoinToken: created.payload.rejoinToken });

  const rejected = duplicate.emitted.find((e) => e.event === 'seat_in_use');
  expect(rejected).toBeDefined();
  expect(rejected.payload.message).toMatch(/another tab/);
  expect(duplicate.playerRole).toBeUndefined();

  const room = await Room.findOne({ roomCode });
  expect(room.host.socketId).toBe('host-sock');
  expect(host.emitted.some((e) => e.event === 'seat_in_use')).toBe(false);
});

/**
 * Rematch: a player's rejoin token must keep working across the rematch.
 *
 * The token is the only thing that can claim a seat, and the client learns it
 * once (at create/join). If the server rotated it on rematch, the new secret
 * would exist only in that one best-effort `rematch_start` event; a tab that
 * missed it — or a deployed client that predates the store-the-new-token code —
 * sends the old token and is rejected with "Invalid rejoin token" after the
 * rematch deck confirm. So the seat token is stable for the room's lifetime.
 */
test('a rematch keeps both rejoin tokens valid and both players reach the new game', async () => {
  const io = makeIo();

  const host = makeSocket(io, 'host-sock');
  await host.handlers.create_room({ username: 'Alice', playerId: 'id-alice' });
  const created = host.emitted.find((e) => e.event === 'room_created');
  const roomCode = created.payload.roomCode;
  const hostToken = created.payload.rejoinToken;

  const guest = makeSocket(io, 'guest-sock');
  await guest.handlers.join_room({ username: 'Bob', roomCode, playerId: 'id-bob' });
  const guestToken = guest.emitted.find((e) => e.event === 'room_joined').payload.rejoinToken;

  await Promise.all([
    host.handlers.deck_confirmed({ deck: DECK }),
    guest.handlers.deck_confirmed({ deck: DECK }),
  ]);
  expect(host.emitted.some((e) => e.event === 'game_start')).toBe(true);

  await finishGame(io, roomCode, io.activeGames, 'host');
  expect(host.emitted.some((e) => e.event === 'game_over')).toBe(true);
  expect(guest.emitted.some((e) => e.event === 'game_over')).toBe(true);

  await host.handlers.rematch_request();
  await guest.handlers.rematch_accept();

  const hostStart = host.emitted.find((e) => e.event === 'rematch_start');
  const guestStart = guest.emitted.find((e) => e.event === 'rematch_start');
  expect(hostStart).toBeDefined();
  expect(guestStart).toBeDefined();
  expect(hostStart.payload.yourRole).toBe('host');
  expect(guestStart.payload.yourRole).toBe('guest');
  expect(hostStart.payload.rejoinToken).toBe(hostToken);
  expect(guestStart.payload.rejoinToken).toBe(guestToken);

  const room = await Room.findOne({ roomCode });
  expect(room.host.rejoinToken).toBe(hostToken);
  expect(room.guest.rejoinToken).toBe(guestToken);
  expect(room.gameState.status).toBe('deckbuilding');

  // The tokens the clients already hold still claim their seats after the page
  // for the finished match goes away (navigation/refresh). Nothing rotates them.
  await host.handlers.disconnect();
  await guest.handlers.disconnect();

  const hostRejoin = makeSocket(io, 'host-from-old-token');
  await hostRejoin.handlers.rejoin_game({ roomCode, rejoinToken: hostToken });
  expect(hostRejoin.playerRole).toBe('host');
  expect(hostRejoin.emitted.find((e) => e.event === 'rejoined_lobby').payload.yourRole).toBe('host');

  const guestRejoin = makeSocket(io, 'guest-from-old-token');
  await guestRejoin.handlers.rejoin_game({ roomCode, rejoinToken: guestToken });
  expect(guestRejoin.playerRole).toBe('guest');
  expect(guestRejoin.emitted.find((e) => e.event === 'rejoined_lobby').payload.yourRole).toBe('guest');
});

/**
 * The reported rematch flow, driven exactly as the pages drive it: the two
 * sockets that already hold the seats confirm a new 15-card deck and must both
 * receive game_start, with no manual rejoin_game in between.
 */
test('both players confirm a rematch deck and reach the new game with no manual rejoin', async () => {
  const io = makeIo();

  const host = makeSocket(io, 'host-sock');
  await host.handlers.create_room({ username: 'Alice', playerId: 'id-alice' });
  const roomCode = host.emitted.find((e) => e.event === 'room_created').payload.roomCode;

  const guest = makeSocket(io, 'guest-sock');
  await guest.handlers.join_room({ username: 'Bob', roomCode, playerId: 'id-bob' });

  await Promise.all([
    host.handlers.deck_confirmed({ deck: DECK }),
    guest.handlers.deck_confirmed({ deck: DECK }),
  ]);
  expect(host.emitted.some((e) => e.event === 'game_start')).toBe(true);

  await finishGame(io, roomCode, io.activeGames, 'host');
  await host.handlers.rematch_request();
  await guest.handlers.rematch_accept();
  expect(host.emitted.some((e) => e.event === 'rematch_start')).toBe(true);
  expect(guest.emitted.some((e) => e.event === 'rematch_start')).toBe(true);

  const hostStartsBefore = host.emitted.filter((e) => e.event === 'game_start').length;
  const guestStartsBefore = guest.emitted.filter((e) => e.event === 'game_start').length;

  await Promise.all([
    host.handlers.deck_confirmed({ deck: DECK }),
    guest.handlers.deck_confirmed({ deck: DECK }),
  ]);

  expect(host.emitted.filter((e) => e.event === 'game_start').length).toBe(hostStartsBefore + 1);
  expect(guest.emitted.filter((e) => e.event === 'game_start').length).toBe(guestStartsBefore + 1);
  expect(host.emitted.some((e) => e.event === 'error_message')).toBe(false);
  expect(guest.emitted.some((e) => e.event === 'error_message')).toBe(false);
  expect((await Room.findOne({ roomCode })).gameState.status).toBe('playing');
});

/**
 * A refresh closes the old socket, but the new one's rejoin can arrive before
 * the server has processed that close. The seat holder must only be trusted if
 * it answers a liveness probe; otherwise the refresh has to win.
 */
test('a rejoin from a refreshed tab evicts its stale socket', async () => {
  const io = makeIo();

  // The old tab is already gone: still registered, but nobody answers the probe.
  const stale = makeSocket(io, 'stale-host-sock', { responds: false });
  await stale.handlers.create_room({ username: 'Alice', playerId: 'id-alice' });
  const created = stale.emitted.find((e) => e.event === 'room_created');
  const roomCode = created.payload.roomCode;

  const reloaded = makeSocket(io, 'reloaded-host-sock');
  await reloaded.handlers.rejoin_game({ roomCode, rejoinToken: created.payload.rejoinToken });

  expect(reloaded.emitted.some((e) => e.event === 'seat_in_use')).toBe(false);
  expect(stale.evicted).toBe(true);
  expect(reloaded.playerRole).toBe('host');
  expect(reloaded.emitted.find((e) => e.event === 'rejoined_lobby').payload.yourRole).toBe('host');
  expect((await Room.findOne({ roomCode })).host.socketId).toBe('reloaded-host-sock');
});
