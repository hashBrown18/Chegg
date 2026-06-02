/**
 * reconnectHandlers.js — Handles player disconnection, reconnection, and abandon timeout
 */

const mongoose = require('mongoose');
const Room = require('../models/Room');

// Helper: detect if Mongo is connected
const isMongoConnected = () => mongoose.connection.readyState === 1;

// 5-minute cleanup timers, keyed by roomCode. Each timer deletes the room
// from both memory and MongoDB if BOTH players are still disconnected.
const fullDisconnectTimers = new Map();

function registerReconnectHandlers(io, socket, activeGames, disconnectTimers) {
  // ─── DISCONNECT ───
  socket.on('disconnect', async () => {
    const { roomCode, playerRole, username } = socket;
    if (!roomCode || !playerRole) return;

    console.log(`Player ${username} (${playerRole}) disconnected from room ${roomCode}`);

    try {
      // Mark player as disconnected in MongoDB
      let room = null;
      if (isMongoConnected()) {
        room = await Room.findOne({ roomCode });
        if (room) {
          if (playerRole === 'host') {
            room.host.connected = false;
            room.host.socketId = '';
          } else {
            room.guest.connected = false;
            room.guest.socketId = '';
          }
          await room.save();
        }
      } else {
        // In-memory fallback: look up via roomHandlers' helper.
        // We can't import its private Map, so we search the local disconnectTimers'
        // sibling state via activeGames (which is keyed by roomCode).
        // Note: the in-memory fallback is dev-only and doesn't persist disconnect
        // status, so we skip the bookkeeping there.
        room = null;
      }

      // Notify opponent
      socket.to(roomCode).emit('opponent_disconnected', {
        message: `${username} disconnected. Waiting for reconnection...`,
        timeoutSeconds: 60,
      });

      // Start 60-second abandon timer (existing behavior — gives opponent a win)
      const timerKey = `${roomCode}_${playerRole}`;

      // Clear any existing timer
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
      }

      const timer = setTimeout(async () => {
        console.log(`Abandon timeout for ${username} in room ${roomCode}`);

        // Grant win to opponent
        socket.to(roomCode).emit('abandon_win', {
          message: `${username} abandoned the game. You win!`,
        });

        // Mark game as finished
        const gameState = activeGames.get(roomCode);
        if (gameState) {
          gameState.status = 'finished';
        }

        try {
          if (isMongoConnected()) {
            const r = await Room.findOne({ roomCode });
            if (r) {
              r.gameState.status = 'finished';
              await r.save();
            }
          }
        } catch (e) {
          console.error('Error updating room on abandon:', e);
        }

        // Game is over — cancel any pending full-disconnect cleanup.
        if (fullDisconnectTimers.has(roomCode)) {
          clearTimeout(fullDisconnectTimers.get(roomCode));
          fullDisconnectTimers.delete(roomCode);
        }

        disconnectTimers.delete(timerKey);
      }, 60000); // 60 seconds

      disconnectTimers.set(timerKey, timer);

      // Start a 5-minute full-disconnect cleanup timer if the other player
      // is also gone. This removes the room entirely from memory + MongoDB
      // once BOTH players have been disconnected for over 5 minutes.
      await scheduleFullDisconnectCleanup(io, roomCode, activeGames);
    } catch (err) {
      console.error('disconnect handler error:', err);
    }
  });

  // ─── REJOIN GAME ───
  // Accepts either { roomCode, playerId } (preferred) or { roomCode, username }
  // (legacy fallback). The room is found by roomCode (lowercased). The player
  // slot is matched first by playerId, then by username.
  socket.on('rejoin_game', async ({ roomCode, playerId, username }) => {
    try {
      if (!roomCode) {
        socket.emit('error_message', { message: 'Room code is required to rejoin' });
        return;
      }

      const code = roomCode.trim().toLowerCase();
      const pid = (playerId || '').trim();
      const uname = (username || '').trim();

      let room = null;
      if (isMongoConnected()) {
        room = await Room.findOne({ roomCode: code });
      } else {
        // In-memory fallback: use activeGames as a proxy for "does this room exist"
        room = activeGames.has(code)
          ? { _inMemory: true, code }
          : null;
      }

      if (!room) {
        // Room no longer exists — tell the client to bail.
        socket.emit('room_expired', { roomCode: code });
        return;
      }

      // Match player slot. Prefer playerId, fall back to username.
      let playerRole = null;
      if (pid) {
        if (room.host && room.host.playerId === pid) {
          playerRole = 'host';
        } else if (room.guest && room.guest.playerId === pid) {
          playerRole = 'guest';
        }
      }
      if (!playerRole && uname) {
        if (room.host && room.host.username === uname) {
          playerRole = 'host';
        } else if (room.guest && room.guest.username === uname) {
          playerRole = 'guest';
        }
      }
      if (!playerRole) {
        socket.emit('error_message', { message: 'Player not found in this room' });
        return;
      }

      // Two rejoin paths:
      //   A) Game is in progress → restore full state via game_start
      //   B) Game is still in deckbuilding / waiting → just rejoin the lobby
      const gameState = activeGames.get(code);
      const isPlaying = gameState && gameState.status === 'playing';

      if (!isPlaying) {
        // Pre-game rejoin: cancel the 60s abandon timer (if any), update
        // socket/room bookkeeping, and tell the client to navigate back
        // to the deck builder.
        const timerKey = `${code}_${playerRole}`;
        if (disconnectTimers.has(timerKey)) {
          clearTimeout(disconnectTimers.get(timerKey));
          disconnectTimers.delete(timerKey);
        }
        if (fullDisconnectTimers.has(code)) {
          clearTimeout(fullDisconnectTimers.get(code));
          fullDisconnectTimers.delete(code);
        }

        socket.join(code);
        socket.roomCode = code;
        socket.playerRole = playerRole;
        socket.username = uname || (playerRole === 'host' ? room.host.username : room.guest.username);
        socket.playerId = pid;

        if (isMongoConnected()) {
          if (playerRole === 'host') {
            room.host.socketId = socket.id;
            room.host.connected = true;
          } else {
            room.guest.socketId = socket.id;
            room.guest.connected = true;
          }
          await room.save();
        }

        // Tell the reconnecting client to head back to deck builder
        socket.emit('rejoined_lobby', { roomCode: code, yourRole: playerRole });
        socket.to(code).emit('opponent_reconnected', {
          message: `${socket.username} reconnected!`,
        });
        console.log(`${socket.username} re-joined lobby of room ${code}`);
        return;
      }

      // ── Playing-state rejoin ──
      // Cancel abandon timer
      const timerKey = `${code}_${playerRole}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
        console.log(`Cancelled abandon timer for ${socket.username || uname} in room ${code}`);
      }
      if (fullDisconnectTimers.has(code)) {
        clearTimeout(fullDisconnectTimers.get(code));
        fullDisconnectTimers.delete(code);
      }

      // Update socket info
      socket.join(code);
      socket.roomCode = code;
      socket.playerRole = playerRole;
      socket.username = uname || (playerRole === 'host' ? room.host.username : room.guest.username);
      socket.playerId = pid;

      // Update MongoDB
      if (isMongoConnected()) {
        if (playerRole === 'host') {
          room.host.socketId = socket.id;
          room.host.connected = true;
        } else {
          room.guest.socketId = socket.id;
          room.guest.connected = true;
        }
        await room.save();
      }

      // Send full game state to reconnecting player
      const opponentRole = playerRole === 'host' ? 'guest' : 'host';

      socket.emit('game_start', {
        boardState: gameState.getBoardState(),
        yourHand: gameState.getPlayerHand(playerRole),
        opponentCardCount: gameState.getPlayerHandCount(opponentRole),
        currentTurn: gameState.currentTurn,
        mana: gameState.getMana(playerRole),
        maxMana: Math.min(gameState.turnNumber, 6),
        turnNumber: gameState.turnNumber,
        yourRole: playerRole,
        hostUsername: (room.host && room.host.username) || 'Host',
        guestUsername: (room.guest && room.guest.username) || 'Guest',
        yourDeckCount: gameState.getPlayerDeckCount(playerRole),
        opponentDeckCount: gameState.getPlayerDeckCount(opponentRole),
        isReconnection: true,
      });

      // Notify opponent
      socket.to(code).emit('opponent_reconnected', {
        message: `${socket.username} reconnected!`,
      });

      console.log(`${socket.username} reconnected to room ${code}`);
    } catch (err) {
      console.error('rejoin_game error:', err);
      socket.emit('error_message', { message: 'Reconnection failed' });
    }
  });
}

/**
 * Schedule a 5-minute cleanup if BOTH players are disconnected.
 * If only one is gone, the existing 60s abandon timer handles the win.
 * If the game finishes (status='finished') before the timer fires, it is
 * cancelled from the abandon-timeout callback.
 */
async function scheduleFullDisconnectCleanup(io, roomCode, activeGames) {
  if (fullDisconnectTimers.has(roomCode)) return; // already scheduled

  let bothGone = false;
  if (isMongoConnected()) {
    const room = await Room.findOne({ roomCode });
    if (!room) return;
    const hostGone = !room.host || !room.host.connected;
    const guestGone = !room.guest || !room.guest.username || !room.guest.connected;
    bothGone = hostGone && guestGone;
  } else {
    // Without persistence we can't tell; skip cleanup in this mode.
    return;
  }

  if (!bothGone) return;

  const timer = setTimeout(async () => {
    console.log(`Full-disconnect cleanup for room ${roomCode} — deleting`);
    try {
      // Remove from active games
      activeGames.delete(roomCode);

      // Remove from MongoDB
      if (isMongoConnected()) {
        await Room.deleteOne({ roomCode });
      }

      // Tell any straggler sockets (e.g. someone reconnecting at the same
      // moment) that the room is gone.
      io.to(roomCode).emit('room_expired', { roomCode });
    } catch (e) {
      console.error('full-disconnect cleanup error:', e);
    } finally {
      fullDisconnectTimers.delete(roomCode);
    }
  }, 5 * 60 * 1000); // 5 minutes

  fullDisconnectTimers.set(roomCode, timer);
}

module.exports = registerReconnectHandlers;
