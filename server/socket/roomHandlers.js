/**
 * roomHandlers.js — Socket handlers for room creation, joining, and deck confirmation
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const GameState = require('../game/GameState');

// In-memory room store — used as fallback when MongoDB is not connected
const inMemoryRooms = new Map();

const VALID_MINION_IDS = new Set([
  'villager', 'zombie', 'creeper', 'puffer_fish', 'iron_golem',
  'skeleton', 'blaze', 'phantom', 'enderman', 'shulker_box', 'wither',
]);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// Abstraction layer: find a room by code from either MongoDB or memory
async function findRoom(roomCode) {
  if (isMongoConnected()) {
    return await Room.findOne({ roomCode });
  }
  // For in-memory fallback, ensure lowercase lookup for consistency
  return inMemoryRooms.get(roomCode.toLowerCase()) || null;
}

// Abstraction layer: save/create a room to either MongoDB or memory
async function saveRoom(room) {
  if (isMongoConnected()) {
    await room.save();
    return room;
  }
  // In-memory: store as plain object
  inMemoryRooms.set(room.roomCode, room);
  return room;
}

/**
 * Generate a random 8-character lowercase alphanumeric room code
 * (e.g. "jhgf7345") using crypto.randomBytes for cryptographic safety.
 * Output is URL-safe lowercase a-z0-9 only.
 */
function generateRoomCode() {
  // 6 random bytes → base36 → take 8 chars. base36 alphabet is [0-9a-z], so the
  // result is always lowercase alphanumeric and URL-safe.
  return crypto.randomBytes(6).toString('hex').slice(0, 8);
}

/**
 * Generate a random 48-character hex token for secure rejoin verification.
 * This is NOT the URL token — it's a secret kept only by the player and the server.
 * Sent only to the owning player via private socket emit.
 */
function generateRejoinToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Deck-flow tracing is opt-in: these lines carry player/socket ids and used to
// dump whole room documents (including rejoin tokens) into production logs.
const DEBUG_DECK = process.env.DEBUG_DECK === '1';
function dlog(...args) { if (DEBUG_DECK) console.log('[DECK]', ...args); }
function derr(...args) { if (DEBUG_DECK) console.error('[DECK]', ...args); }



function registerRoomHandlers(io, socket, activeGames) {
  // ─── CREATE ROOM ───
  socket.on('create_room', async ({ username, playerId }) => {
    try {
      if (!username || username.trim().length === 0) {
        socket.emit('error_message', { message: 'Username is required' });
        return;
      }

      // Generate unique room code (8-char lowercase alphanumeric, crypto-based)
      let roomCode;
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 10) {
        roomCode = generateRoomCode();
        exists = await findRoom(roomCode);
        attempts++;
      }
      if (exists) {
        socket.emit('error_message', { message: 'Failed to generate a unique room code, please try again' });
        return;
      }

      // Each player gets a private rejoin secret. It is sent only to its owner
      // and is the ONLY thing that can claim a seat — never in URLs, never broadcast.
      const hostRejoinToken = generateRejoinToken();

      // Create room object
      let room;
      if (isMongoConnected()) {
        room = new Room({
          roomCode,
          host: {
            username: username.trim(),
            socketId: socket.id,
            playerId: (playerId || '').trim(),
            connected: true,
            rejoinToken: hostRejoinToken,
          },
          gameState: {
            status: 'waiting',
          },
        });
      } else {
        // In-memory plain object fallback
        room = {
          roomCode,
          host: {
            username: username.trim(),
            socketId: socket.id,
            playerId: (playerId || '').trim(),
            connected: true,
            rejoinToken: hostRejoinToken,
            deck: null,
          },
          guest: null,
          gameState: {
            status: 'waiting',
          },
        };
      }
      await saveRoom(room);

      // Join socket room
      socket.join(roomCode);

      // Store player info on socket for easy lookup
      socket.roomCode = roomCode;
      socket.playerRole = 'host';
      socket.username = username.trim();
      socket.playerId = (playerId || '').trim();

      // Share link carries ONLY the room code — the guest claims their seat by
      // going through join_room, which mints their own private rejoin token.
      const clientUrl = process.env.CLIENT_URL || '';
      const guestLink = clientUrl ? `${clientUrl}/join/${roomCode}` : '';
      socket.emit('room_created', { roomCode, guestLink, rejoinToken: hostRejoinToken });
      console.log(`Room ${roomCode} created by ${username} (${isMongoConnected() ? 'MongoDB' : 'in-memory'}) — host.socketId=${socket.id}`);
    } catch (err) {
      console.error('create_room error:', err);
      socket.emit('error_message', { message: 'Failed to create room: ' + err.message });
    }
  });

  // ─── JOIN ROOM ───
  socket.on('join_room', async ({ username, roomCode, playerId }) => {
    try {
      if (!username || username.trim().length === 0) {
        socket.emit('error_message', { message: 'Username is required' });
        return;
      }
      if (!roomCode || roomCode.trim().length === 0) {
        socket.emit('error_message', { message: 'Room code is required' });
        return;
      }

      // New format is lowercase alphanumeric, so we lowercase for normalization.
      // (Preserves compatibility with old uppercase codes by lowering them too.)
      const code = roomCode.trim().toLowerCase();
      const room = await findRoom(code);

      if (!room) {
        socket.emit('error_message', { message: 'Room not found' });
        return;
      }

      if (room.guest && room.guest.username) {
        socket.emit('error_message', { message: 'Room is already full' });
        return;
      }

      if (room.gameState.status !== 'waiting') {
        socket.emit('error_message', { message: 'Game already in progress' });
        return;
      }

      // Add guest to room
      const guestRejoinToken = generateRejoinToken();
      room.guest = {
        username: username.trim(),
        socketId: socket.id,
        playerId: (playerId || '').trim(),
        connected: true,
        rejoinToken: guestRejoinToken,
        deck: null,
      };
      room.gameState.status = 'deckbuilding';
      await saveRoom(room);

      // Join socket room
      socket.join(code);

      // Store player info on socket
      socket.roomCode = code;
      socket.playerRole = 'guest';
      socket.username = username.trim();
      socket.playerId = (playerId || '').trim();

      // Notify host that opponent joined
      socket.to(code).emit('opponent_joined', {
        opponentUsername: username.trim(),
      });

      // Notify guest of success — only THEIR OWN rejoin token goes back to them.
      socket.emit('room_joined', {
        roomCode: code,
        opponentUsername: room.host.username,
        rejoinToken: guestRejoinToken,
      });

      console.log(`${username} joined room ${code} — guest.socketId=${socket.id}`);
    } catch (err) {
      console.error('join_room error:', err);
      socket.emit('error_message', { message: 'Failed to join room: ' + err.message });
    }
  });

  // ─── DECK CONFIRMED ───
  socket.on('deck_confirmed', async ({ deck }) => {
    try {
      const { roomCode, playerRole } = socket;
      dlog(`deck_confirmed received from ${socket.username || '?'} (${playerRole || '?'}) in room ${roomCode || '?'} — socket.id=${socket.id} playerId=${socket.playerId || '?'} deckSize=${Array.isArray(deck) ? deck.length : 'invalid'}`);

      if (!roomCode || !playerRole) {
        derr(`Rejected: roomCode=${roomCode}, playerRole=${playerRole}`);
        socket.emit('error_message', { message: 'Not in a room' });
        return;
      }

      // Validate deck: exactly 15 minions
      if (!Array.isArray(deck) || deck.length !== 15) {
        socket.emit('error_message', { message: 'Deck must contain exactly 15 minions' });
        return;
      }

      // Validate every card ID is a known minion. Duplicates are allowed with no cap —
      // the deck builder UI has no per-card limit, so any 15-card deck it can produce must
      // be accepted here (a stricter rule here silently froze the game at 2/2 ready).
      for (const cardId of deck) {
        if (!VALID_MINION_IDS.has(cardId)) {
          socket.emit('deck_error', { message: 'Invalid deck: unknown minion ID detected.' });
          return;
        }
      }

      // Validate room exists before attempting atomic update
      const existingRoom = await findRoom(roomCode);
      if (!existingRoom) {
        derr(`Room ${roomCode} not found`);
        socket.emit('error_message', { message: 'Room not found' });
        return;
      }

      // ATOMIC UPDATE: Use $set to only write this player's fields.
      // Previous bug: both handlers called findRoom() (fresh snapshot) before either
      // saved. Guest's save overwrote host's deck because its snapshot had host.deck=[]
      // (schema default). $set ensures each handler only touches its own subdocument.
      const setFields = {};
      if (playerRole === 'host') {
        setFields['host.socketId'] = socket.id;
        setFields['host.connected'] = true;
        setFields['host.deck'] = deck;
      } else {
        setFields['guest.socketId'] = socket.id;
        setFields['guest.connected'] = true;
        setFields['guest.deck'] = deck;
      }

      let room;
      if (isMongoConnected()) {
        // { new: true } returns the UPDATED document — without it, Mongoose 8
        // returns the pre-update doc and the identity map stays stale, so any
        // subsequent findOne() would serve cached old data.
        room = await Room.findOneAndUpdate({ roomCode }, { $set: setFields }, { new: true });
        // Never dump the room: it holds both players' rejoin tokens.
        dlog(`After ${playerRole} save — hostReady=${room.host.deck ? room.host.deck.length : 'null'}, guestReady=${room.guest && room.guest.deck ? room.guest.deck.length : 'null'}`);
      } else {
        // In-memory: same reference, direct mutation is safe
        if (playerRole === 'host') {
          existingRoom.host.socketId = socket.id;
          existingRoom.host.connected = true;
          existingRoom.host.deck = deck;
        } else {
          existingRoom.guest.socketId = socket.id;
          existingRoom.guest.connected = true;
          existingRoom.guest.deck = deck;
        }
        inMemoryRooms.set(roomCode, existingRoom);
        room = existingRoom;
        dlog(`After ${playerRole} save (in-memory) — hostReady=${room.host.deck ? room.host.deck.length : 'null'}, guestReady=${room.guest && room.guest.deck ? room.guest.deck.length : 'null'}`);
      }

      // Check if both players have confirmed
      const hostReady = room.host.deck && room.host.deck.length === 15;
      const guestReady = room.guest && room.guest.deck && room.guest.deck.length === 15;
      const roomSockets = io.sockets.adapter.rooms.get(roomCode);
      dlog(`Room ${roomCode} — role=${playerRole} socket=${socket.id} roomSockets=${roomSockets ? roomSockets.size : 0} — hostReady=${hostReady} (${room.host.deck ? room.host.deck.length : 'null'} cards), guestReady=${guestReady} (${room.guest && room.guest.deck ? room.guest.deck.length : 'null'} cards)`);

      if (playerRole === 'host' && !guestReady) {
        socket.emit('waiting_for_opponent', { message: 'Waiting for opponent to confirm deck...' });
      } else if (playerRole === 'guest' && !hostReady) {
        socket.emit('waiting_for_opponent', { message: 'Waiting for opponent to confirm deck...' });
      }

      if (hostReady && guestReady) {
        dlog(`Both ready in room ${roomCode} — initializing game`);

        // Both ready — initialize game
        const gameState = new GameState();
        gameState.initializeGame(room.host.deck, room.guest.deck);

        // Store in active games map
        activeGames.set(roomCode, gameState);

        // Update room status
        room.gameState.status = 'playing';
        await saveRoom(room);

        // FIX: Look up sockets — first try stored ID, then fall back to searching
        // the room's connected sockets by playerRole property.
        const hostSocketId = room.host.socketId;
        const guestSocketId = room.guest.socketId;
        dlog(`Looking up sockets — host.socketId=${hostSocketId}, guest.socketId=${guestSocketId}`);

        let hostSocket = io.sockets.sockets.get(hostSocketId);
        let guestSocket = io.sockets.sockets.get(guestSocketId);

        // Fallback: if lookup by stored ID fails, search connected sockets in this room
        if (!hostSocket || !guestSocket) {
          dlog(`Socket ID lookup failed (host=${!!hostSocket}, guest=${!!guestSocket}) — falling back to room scan`);
          for (const [, connectedSocket] of io.sockets.sockets) {
            if (connectedSocket.roomCode === roomCode) {
              if (connectedSocket.playerRole === 'host' && !hostSocket) {
                hostSocket = connectedSocket;
                dlog(`Found host via room scan: ${connectedSocket.id}`);
              } else if (connectedSocket.playerRole === 'guest' && !guestSocket) {
                guestSocket = connectedSocket;
                dlog(`Found guest via room scan: ${connectedSocket.id}`);
              }
            }
          }
        }

        const boardState = gameState.getBoardState();

        if (hostSocket) {
          hostSocket.emit('game_start', {
            boardState,
            yourHand: gameState.getPlayerHand('host'),
            opponentCardCount: gameState.getPlayerHandCount('guest'),
            currentTurn: gameState.currentTurn,
            mana: gameState.getMana('host'),
            opponentMana: gameState.getMana('guest'),
            maxMana: Math.min(gameState.turnNumber, 6),
            turnNumber: gameState.turnNumber,
            yourRole: 'host',
            hostUsername: room.host.username,
            guestUsername: room.guest.username,
            yourDeckCount: gameState.getPlayerDeckCount('host'),
            opponentDeckCount: gameState.getPlayerDeckCount('guest'),
          });
          dlog(`Emitted game_start to host (${hostSocket.id})`);
        } else {
          derr(`CRITICAL: Could not find host socket for room ${roomCode}. host.socketId=${hostSocketId}, room has ${io.sockets.sockets.size} total connections`);
        }

        if (guestSocket) {
          guestSocket.emit('game_start', {
            boardState,
            yourHand: gameState.getPlayerHand('guest'),
            opponentCardCount: gameState.getPlayerHandCount('host'),
            currentTurn: gameState.currentTurn,
            mana: gameState.getMana('guest'),
            opponentMana: gameState.getMana('host'),
            maxMana: Math.min(gameState.turnNumber, 6),
            turnNumber: gameState.turnNumber,
            yourRole: 'guest',
            hostUsername: room.host.username,
            guestUsername: room.guest.username,
            yourDeckCount: gameState.getPlayerDeckCount('guest'),
            opponentDeckCount: gameState.getPlayerDeckCount('host'),
          });
          dlog(`Emitted game_start to guest (${guestSocket.id})`);
        } else {
          derr(`CRITICAL: Could not find guest socket for room ${roomCode}. guest.socketId=${guestSocketId}, room has ${io.sockets.sockets.size} total connections`);
        }

        console.log(`Game started in room ${roomCode}`);
      }
    } catch (err) {
      console.error('deck_confirmed error:', err);
      socket.emit('error_message', { message: 'Failed to confirm deck: ' + err.message });
    }
  });
}

module.exports = registerRoomHandlers;
// Shared so reconnectHandlers can find a room in either MongoDB or the in-memory store.
module.exports.findRoom = findRoom;
// Shared so gameHandlers can persist the pending rematch on either store.
module.exports.saveRoom = saveRoom;
// Shared so a rematch can rotate both players' secrets.
module.exports.generateRejoinToken = generateRejoinToken;

