/**
 * Shared harness for handler-level socket tests: a fake io, a fake socket that
 * records everything it emits, a stub GameState and a room seeder.
 *
 * Not a test file — Jest only picks up *.test.js.
 */
const registerReconnectHandlers = require('../socket/reconnectHandlers');
const { saveRoom } = require('../socket/roomHandlers');

// Every rejoin in these tests uses these secrets (hostToken/guestToken are gone).
const HOST_TOKEN = 'host-rejoin-secret-000000000000000000000000';
const GUEST_TOKEN = 'guest-rejoin-secret-00000000000000000000000';

function fakeIo() {
  const events = [];
  return {
    events,
    to: () => ({ emit: (event, payload) => events.push({ event, payload }) }),
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
  };
}

function fakeSocket(io, id) {
  const handlers = {};
  const emitted = [];
  const socket = {
    id,
    handlers,
    emitted,
    on: (event, fn) => { handlers[event] = fn },
    emit: (event, payload) => emitted.push({ event, payload }),
    to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }),
    join: () => {},
  };
  registerReconnectHandlers(io, socket, io.activeGames);
  return socket;
}

function stubGameState() {
  return {
    status: 'playing',
    currentTurn: 'host',
    turnNumber: 1,
    getBoardState: () => ({}),
    getPlayerHand: () => [],
    getPlayerHandCount: () => 0,
    getMana: () => 1,
    getPlayerDeckCount: () => 15,
  };
}

function seed(code) {
  return saveRoom({
    roomCode: code,
    host: {
      username: 'Alice',
      playerId: 'id-alice',
      socketId: 'host-socket',
      connected: true,
      rejoinToken: HOST_TOKEN,
    },
    guest: {
      username: 'Bob',
      playerId: 'id-bob',
      socketId: 'guest-socket',
      connected: true,
      rejoinToken: GUEST_TOKEN,
    },
    gameState: { status: 'playing', winnerRole: '' },
  });
}

module.exports = { fakeIo, fakeSocket, stubGameState, seed, HOST_TOKEN, GUEST_TOKEN };
