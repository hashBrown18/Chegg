const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: { type: String, default: '' },
  socketId: { type: String, default: '' },
  playerId: { type: String, default: '' }, // stable client-side UUID for reconnection
  connected: { type: Boolean, default: false },
  deck: { type: [String], default: [] },
  hand: { type: [String], default: [] },
  deckRemaining: { type: [String], default: [] },
  // Secure rejoin token (random, sent only to this player)
  rejoinToken: { type: String, default: '' },
  // Forfeit timer persistence (survives server restarts)
  disconnectedAt: { type: Number, default: 0 },
  forfeitDeadline: { type: Number, default: 0 },
}, { _id: false });

const minionInstanceSchema = new mongoose.Schema({
  instanceId: { type: String, required: true },
  type: { type: String, required: true },
  owner: { type: String, enum: ['host', 'guest'], required: true },
  position: {
    col: { type: Number, required: true },
    row: { type: String, required: true },
  },
  spawnedThisTurn: { type: Boolean, default: true },
  hasMovedThisTurn: { type: Boolean, default: false },
  hasAttackedThisTurn: { type: Boolean, default: false },
  hasUsedAbilityThisTurn: { type: Boolean, default: false },
}, { _id: false });

const gameStateSchema = new mongoose.Schema({
  board: { type: Map, of: minionInstanceSchema, default: {} },
  currentTurn: { type: String, enum: ['host', 'guest'], default: 'host' },
  turnNumber: { type: Number, default: 1 },
  hostMana: { type: Number, default: 1 },
  guestMana: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['waiting', 'deckbuilding', 'playing', 'finished'],
    default: 'waiting',
  },
  // Set when the game finishes so a late reconnect can be shown the result.
  winnerRole: { type: String, default: '' },
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  host: { type: playerSchema, default: () => ({}) },
  guest: { type: playerSchema, default: () => ({}) },
  gameState: { type: gameStateSchema, default: () => ({}) },
  // Pending rematch request for the finished match: 'host' | 'guest' | ''
  rematch: {
    requestedBy: { type: String, default: '' },
  },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24 hours
});

module.exports = mongoose.model('Room', roomSchema);
