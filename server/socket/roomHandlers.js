/**
 * roomHandlers.js — Socket handlers for room creation, joining, and deck confirmation
 */

const mongoose = require('mongoose');
const Room = require('../models/Room');
const GameState = require('../game/GameState');

// In-memory room store — used as fallback when MongoDB is not connected
const inMemoryRooms = new Map();

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// Abstraction layer: find a room by code from either MongoDB or memory
async function findRoom(roomCode) {
  if (isMongoConnected()) {
    return await Room.findOne({ roomCode });
  }
  return inMemoryRooms.get(roomCode) || null;
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
 * Generate a random 6-character alphanumeric room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function registerRoomHandlers(io, socket, activeGames) {
  // ─── CREATE ROOM ───
  socket.on('create_room', async ({ username }) => {
    try {
      if (!username || username.trim().length === 0) {
        socket.emit('error_message', { message: 'Username is required' });
        return;
      }

      // Generate unique room code
      let roomCode;
      let exists = true;
      while (exists) {
        roomCode = generateRoomCode();
        exists = await findRoom(roomCode);
      }

      // Create room object
      let room;
      if (isMongoConnected()) {
        room = new Room({
          roomCode,
          host: {
            username: username.trim(),
            socketId: socket.id,
            connected: true,
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
            connected: true,
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

      socket.emit('room_created', { roomCode });
      console.log(`Room ${roomCode} created by ${username} (${isMongoConnected() ? 'MongoDB' : 'in-memory'})`);
    } catch (err) {
      console.error('create_room error:', err);
      socket.emit('error_message', { message: 'Failed to create room: ' + err.message });
    }
  });

  // ─── JOIN ROOM ───
  socket.on('join_room', async ({ username, roomCode }) => {
    try {
      if (!username || username.trim().length === 0) {
        socket.emit('error_message', { message: 'Username is required' });
        return;
      }
      if (!roomCode || roomCode.trim().length === 0) {
        socket.emit('error_message', { message: 'Room code is required' });
        return;
      }

      const code = roomCode.trim().toUpperCase();
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
      room.guest = {
        username: username.trim(),
        socketId: socket.id,
        connected: true,
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

      // Notify host that opponent joined
      socket.to(code).emit('opponent_joined', {
        opponentUsername: username.trim(),
      });

      // Notify guest of success
      socket.emit('room_joined', {
        roomCode: code,
        opponentUsername: room.host.username,
      });

      console.log(`${username} joined room ${code}`);
    } catch (err) {
      console.error('join_room error:', err);
      socket.emit('error_message', { message: 'Failed to join room: ' + err.message });
    }
  });

  // ─── DECK CONFIRMED ───
  socket.on('deck_confirmed', async ({ deck }) => {
    try {
      const { roomCode, playerRole } = socket;
      if (!roomCode || !playerRole) {
        socket.emit('error_message', { message: 'Not in a room' });
        return;
      }

      // Validate deck: exactly 15 minions
      if (!Array.isArray(deck) || deck.length !== 15) {
        socket.emit('error_message', { message: 'Deck must contain exactly 15 minions' });
        return;
      }

      const room = await findRoom(roomCode);
      if (!room) {
        socket.emit('error_message', { message: 'Room not found' });
        return;
      }

      // Save deck for this player
      if (playerRole === 'host') {
        room.host.deck = deck;
      } else {
        room.guest.deck = deck;
      }
      await saveRoom(room);

      // Check if both players have confirmed
      const hostReady = room.host.deck && room.host.deck.length === 15;
      const guestReady = room.guest && room.guest.deck && room.guest.deck.length === 15;

      if (playerRole === 'host' && !guestReady) {
        socket.emit('waiting_for_opponent', { message: 'Waiting for opponent to confirm deck...' });
      } else if (playerRole === 'guest' && !hostReady) {
        socket.emit('waiting_for_opponent', { message: 'Waiting for opponent to confirm deck...' });
      }

      if (hostReady && guestReady) {
        // Both ready — initialize game
        const gameState = new GameState();
        gameState.initializeGame(room.host.deck, room.guest.deck);

        // Store in active games map
        activeGames.set(roomCode, gameState);

        // Update room status
        room.gameState.status = 'playing';
        await saveRoom(room);

        // Send game_start to each player with their private data
        const hostSocket = io.sockets.sockets.get(room.host.socketId);
        const guestSocket = io.sockets.sockets.get(room.guest.socketId);

        const boardState = gameState.getBoardState();

        if (hostSocket) {
          hostSocket.emit('game_start', {
            boardState,
            yourHand: gameState.getPlayerHand('host'),
            opponentCardCount: gameState.getPlayerHandCount('guest'),
            currentTurn: gameState.currentTurn,
            mana: gameState.getMana('host'),
            maxMana: Math.min(gameState.turnNumber, 6),
            turnNumber: gameState.turnNumber,
            yourRole: 'host',
            hostUsername: room.host.username,
            guestUsername: room.guest.username,
            yourDeckCount: gameState.getPlayerDeckCount('host'),
            opponentDeckCount: gameState.getPlayerDeckCount('guest'),
          });
        }

        if (guestSocket) {
          guestSocket.emit('game_start', {
            boardState,
            yourHand: gameState.getPlayerHand('guest'),
            opponentCardCount: gameState.getPlayerHandCount('host'),
            currentTurn: gameState.currentTurn,
            mana: gameState.getMana('guest'),
            maxMana: Math.min(gameState.turnNumber, 6),
            turnNumber: gameState.turnNumber,
            yourRole: 'guest',
            hostUsername: room.host.username,
            guestUsername: room.guest.username,
            yourDeckCount: gameState.getPlayerDeckCount('guest'),
            opponentDeckCount: gameState.getPlayerDeckCount('host'),
          });
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

