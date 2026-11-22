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

function makeSocket(io, id) {
  const handlers = {};
  const emitted = [];
  const socket = {
    id,
    handlers,
    emitted,
    rooms: new Set(),
    on: (event, fn) => { handlers[event] = fn },
    emit: (event, payload) => emitted.push({ event, payload }),
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
