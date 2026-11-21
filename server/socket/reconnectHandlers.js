/**
 * reconnectHandlers.js — Handles player disconnection, reconnection, and the
 * single server-side forfeit clock.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const Room = require('../models/Room');
const { findRoom, saveRoom } = require('./roomHandlers');
const {
  FORFEIT_MS,
  clearForfeitTimer,
  clearRoomForfeitTimers,
  clearForfeitState,
  startForfeitTimer,
  getForfeitDeadline,
  getForfeitRemaining,
  isPlayerOnline,
  buildGameOverPayload,
  finishGame,
} = require('./gameOver');

// Helper: detect if Mongo is connected
const isMongoConnected = () => mongoose.connection.readyState === 1;

// 5-minute cleanup timers, keyed by roomCode. Each timer deletes the room
// from both memory and MongoDB if BOTH players are still disconnected.
const fullDisconnectTimers = new Map();

function constantTimeEqual(a, b) {
  // Both must be buffers/strings of same length
  const bufA = typeof a === 'string' ? Buffer.from(a) : a;
  const bufB = typeof b === 'string' ? Buffer.from(b) : b;
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function registerReconnectHandlers(io, socket, activeGames) {
  // ─── DISCONNECT ───
  socket.on('disconnect', async () => {
    const { roomCode, playerRole, username } = socket;
    if (!roomCode || !playerRole) return;

    console.log(`Player ${username} (${playerRole}) disconnected from room ${roomCode}`);

    try {
      // Mark player as disconnected (MongoDB or the in-memory store)
      const room = await findRoom(roomCode);
      if (!room) return;

      const player = playerRole === 'host' ? room.host : room.guest;

      // Refresh race: reloading opens a new socket that rebinds this slot before
      // the old socket's disconnect lands. If the slot no longer points at this
      // socket, the event is stale — ignore it instead of re-arming the forfeit
      // clock and clobbering the new socket id.
      if (!player || player.socketId !== socket.id) return;

      // A finished game has nothing left to forfeit.
      const gameState = activeGames.get(roomCode);
      const status = gameState
        ? gameState.status
        : (room.gameState && room.gameState.status);
      if (status === 'finished') return;

      player.connected = false;
      player.socketId = '';

      // A pending rematch dies with the player who left.
      const pendingRematch = (room.rematch && room.rematch.requestedBy) || '';
      if (pendingRematch) {
        room.rematch = { requestedBy: '' };
      }

      await saveRoom(room);

      if (pendingRematch) {
        socket.to(roomCode).emit('opponent_left', {
          message: `${username} left the room.`,
        });
      }

      // Only a match in progress carries a forfeit clock; before the game or
      // after it ends there is nothing to win by waiting.
      if (status !== 'playing') {
        socket.to(roomCode).emit('opponent_disconnected', {
          message: `${username} disconnected. Waiting for reconnection...`,
        });
        await scheduleFullDisconnectCleanup(io, roomCode, activeGames);
        return;
      }

      // ONE countdown per game and player. Clients only render the deadline.
      const { remainingMs, deadline } = await startForfeitTimer(
        roomCode,
        playerRole,
        () => declareForfeit(io, roomCode, playerRole, username, activeGames)
      );

      // Send remainingMs instead of absolute deadline (clock-skew safe)
      socket.to(roomCode).emit('opponent_disconnected', {
        message: `${username} disconnected. Waiting for reconnection...`,
        remainingMs,
      });

      // Start a 5-minute full-disconnect cleanup timer if the other player
      // is also gone. This removes the room entirely from memory + MongoDB
      // once BOTH players have been disconnected for over 5 minutes.
      await scheduleFullDisconnectCleanup(io, roomCode, activeGames);
    } catch (err) {
      console.error('disconnect handler error:', err);
    }
  });

  // ─── REJOIN GAME ───
  // Accepts ONLY { roomCode, rejoinToken }. The rejoin token is a per-player
  // random secret, compared in constant time. A username, playerId or role alone
  // never grants a seat — anything else is rejected before any state is touched.
  socket.on('rejoin_game', async ({ roomCode, rejoinToken, playerId, username }) => {
    try {
      if (!roomCode) {
        socket.emit('error_message', { message: 'Room code is required to rejoin' });
        return;
      }

      const code = roomCode.trim().toLowerCase();
      const token = (rejoinToken || '').trim();
      const pid = (playerId || '').trim();
      const uname = (username || '').trim();

      if (!token) {
        socket.emit('error_message', { message: 'Rejoin token is required' });
        return;
      }

      // Works for both MongoDB and the in-memory fallback store, so a player can
      // rejoin a deck-building room even when no game has been created yet.
      const room = await findRoom(code);

      if (!room) {
        // Room no longer exists — tell the client to bail.
        socket.emit('room_expired', { roomCode: code });
        return;
      }

      let playerRole = null;
      if (room.host && room.host.rejoinToken && constantTimeEqual(token, room.host.rejoinToken)) {
        playerRole = 'host';
      } else if (room.guest && room.guest.rejoinToken && constantTimeEqual(token, room.guest.rejoinToken)) {
        playerRole = 'guest';
      }
      if (!playerRole) {
        socket.emit('error_message', { message: 'Invalid rejoin token' });
        return;
      }

      const roomStatus = (room.gameState && room.gameState.status) || 'waiting';

      // Finished games cannot be resumed — hand the stored result to the player
      // who reconnects late (e.g. after losing on the forfeit clock).
      if (roomStatus === 'finished') {
        clearForfeitTimer(code, playerRole);
        socket.join(code);
        socket.roomCode = code;
        socket.playerRole = playerRole;
        socket.username = uname || (playerRole === 'host' ? room.host.username : room.guest.username);
        socket.playerId = pid || socket.playerId;

        const winnerRole = (room.gameState && room.gameState.winnerRole) || '';
        if (winnerRole) {
          socket.emit('game_over', buildGameOverPayload(room, winnerRole));
        } else {
          socket.emit('room_expired', { roomCode: code });
        }
        return;
      }

      // Two rejoin paths:
      //   A) Game is in progress → restore full state via game_start
      //   B) Room exists but the game has not started (deck building / waiting) → rejoin lobby
      const gameState = activeGames.get(code);

      if (roomStatus !== 'playing') {
        // Pre-game rejoin: cancel the forfeit timer (if any), update
        // socket/room bookkeeping, and tell the client to navigate back
        // to the deck builder.
        clearForfeitTimer(code, playerRole);
        await clearForfeitState(code);
        if (fullDisconnectTimers.has(code)) {
          clearTimeout(fullDisconnectTimers.get(code));
          fullDisconnectTimers.delete(code);
        }

        socket.join(code);
        socket.roomCode = code;
        socket.playerRole = playerRole;
        socket.username = uname || (playerRole === 'host' ? room.host.username : room.guest.username);
        socket.playerId = pid || socket.playerId;

        if (playerRole === 'host') {
          room.host.socketId = socket.id;
          room.host.connected = true;
        } else {
          room.guest.socketId = socket.id;
          room.guest.connected = true;
        }
        await saveRoom(room);

        // If this player already confirmed their deck before refreshing, put the
        // client back into its waiting state instead of asking them to rebuild it.
        const myDeck = playerRole === 'host' ? room.host.deck : room.guest.deck;
        if (myDeck && myDeck.length === 15) {
          socket.emit('waiting_for_opponent', { message: 'Waiting for opponent to confirm deck...' });
        }

        // Tell the reconnecting client to head back to deck builder
        socket.emit('rejoined_lobby', { roomCode: code, yourRole: playerRole });
        socket.to(code).emit('opponent_reconnected', {
          message: `${socket.username} reconnected!`,
        });
        console.log(`${socket.username} re-joined lobby of room ${code}`);
        return;
      }

      if (!gameState) {
        socket.emit('game_error', { message: 'Game session expired. Please rejoin.' });
        return;
      }

      // ── Playing-state rejoin ──
      // Cancel the forfeit clock immediately — the player is back.
      clearForfeitTimer(code, playerRole);
      await clearForfeitState(code);
      if (fullDisconnectTimers.has(code)) {
        clearTimeout(fullDisconnectTimers.get(code));
        fullDisconnectTimers.delete(code);
      }

      // Update socket info
      socket.join(code);
      socket.roomCode = code;
      socket.playerRole = playerRole;
      socket.username = uname || (playerRole === 'host' ? room.host.username : room.guest.username);
      socket.playerId = pid || socket.playerId;

      // Update MongoDB
      if (playerRole === 'host') {
        room.host.socketId = socket.id;
        room.host.connected = true;
      } else {
        room.guest.socketId = socket.id;
        room.guest.connected = true;
      }
      await saveRoom(room);

      // Send full game state to reconnecting player
      const opponentRole = playerRole === 'host' ? 'guest' : 'host';

      socket.emit('game_start', {
        boardState: gameState.getBoardState(),
        yourHand: gameState.getPlayerHand(playerRole),
        opponentCardCount: gameState.getPlayerHandCount(opponentRole),
        currentTurn: gameState.currentTurn,
        mana: gameState.getMana(playerRole),
        opponentMana: gameState.getMana(opponentRole),
        maxMana: Math.min(gameState.turnNumber, 6),
        turnNumber: gameState.turnNumber,
        yourRole: playerRole,
        hostUsername: (room.host && room.host.username) || 'Host',
        guestUsername: (room.guest && room.guest.username) || 'Guest',
        yourDeckCount: gameState.getPlayerDeckCount(playerRole),
        opponentDeckCount: gameState.getPlayerDeckCount(opponentRole),
        isReconnection: true,
      });

      // Also emit explicit turn_change so reconnecting player knows whose turn it is
      // (in case the turn changed while they were disconnected)
      socket.emit('turn_change', {
        currentTurn: gameState.currentTurn,
        turnNumber: gameState.turnNumber,
      });

      // Send mana update to reconnecting player
      const opponentRoleReconnect = playerRole === 'host' ? 'guest' : 'host';
      socket.emit('mana_update', {
        yourMana: gameState.getMana(playerRole),
        opponentMana: gameState.getMana(opponentRoleReconnect),
        maxMana: Math.min(gameState.turnNumber, 6),
      });

      // If the opponent is STILL gone, show this player their remaining clock
      // (both players may have refreshed at once).
      const opponentRemainingMs = getForfeitRemaining(code, opponentRole);
      if (opponentRemainingMs && !isPlayerOnline(io, code, opponentRole)) {
        socket.emit('opponent_disconnected', {
          message: `${opponentRole === 'host' ? room.host.username : room.guest.username} disconnected. Waiting for reconnection...`,
          remainingMs: opponentRemainingMs,
        });
      }

      // Notify opponent — this is what clears their banner and timer state.
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
 * The forfeit clock expired for one player.
 * Winner = the player still connected. If BOTH are gone, the game is abandoned
 * with no winner (nobody is awarded a bogus victory).
 */
async function declareForfeit(io, roomCode, goneRole, goneUsername, activeGames) {
  try {
    const opponentRole = goneRole === 'host' ? 'guest' : 'host';
    if (isPlayerOnline(io, roomCode, opponentRole)) {
      console.log(`Abandon timeout: ${goneUsername} in room ${roomCode} forfeits`);
      await finishGame(io, roomCode, activeGames, opponentRole);
    } else {
      console.log(`Abandon timeout: both players gone in room ${roomCode} — abandoning`);
      await finishGame(io, roomCode, activeGames, null);
    }
  } catch (err) {
    console.error('forfeit handler error:', err);
  }
}

/**
 * Schedule a 5-minute cleanup if BOTH players are disconnected.
 * If only one is gone, the forfeit timer handles the result.
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

/**
 * Drop every pending 5-minute cleanup timer (used on SIGTERM/SIGINT so the
 * process leaves no live timers behind).
 */
function clearAllDisconnectTimers() {
  for (const t of fullDisconnectTimers.values()) clearTimeout(t);
  fullDisconnectTimers.clear();
}

module.exports = registerReconnectHandlers;
module.exports.declareForfeit = declareForfeit;
module.exports.clearAllDisconnectTimers = clearAllDisconnectTimers;