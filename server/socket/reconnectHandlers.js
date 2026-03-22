/**
 * reconnectHandlers.js — Handles player disconnection, reconnection, and abandon timeout
 */

const Room = require('../models/Room');

function registerReconnectHandlers(io, socket, activeGames, disconnectTimers) {
  // ─── DISCONNECT ───
  socket.on('disconnect', async () => {
    const { roomCode, playerRole, username } = socket;
    if (!roomCode || !playerRole) return;

    console.log(`Player ${username} (${playerRole}) disconnected from room ${roomCode}`);

    try {
      // Mark player as disconnected in MongoDB
      const room = await Room.findOne({ roomCode });
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

      // Notify opponent
      socket.to(roomCode).emit('opponent_disconnected', {
        message: `${username} disconnected. Waiting for reconnection...`,
        timeoutSeconds: 60,
      });

      // Start 60-second abandon timer
      const timerKey = `${roomCode}_${playerRole}`;

      // Clear any existing timer
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
      }

      const timer = setTimeout(async () => {
        console.log(`Abandon timeout for ${username} in room ${roomCode}`);

        // Grant win to opponent
        const opponentRole = playerRole === 'host' ? 'guest' : 'host';

        socket.to(roomCode).emit('abandon_win', {
          message: `${username} abandoned the game. You win!`,
        });

        // Mark game as finished
        const gameState = activeGames.get(roomCode);
        if (gameState) {
          gameState.status = 'finished';
        }

        try {
          const r = await Room.findOne({ roomCode });
          if (r) {
            r.gameState.status = 'finished';
            await r.save();
          }
        } catch (e) {
          console.error('Error updating room on abandon:', e);
        }

        disconnectTimers.delete(timerKey);
      }, 60000); // 60 seconds

      disconnectTimers.set(timerKey, timer);
    } catch (err) {
      console.error('disconnect handler error:', err);
    }
  });

  // ─── RECONNECT ───
  socket.on('reconnect_attempt', async ({ username, roomCode }) => {
    try {
      if (!username || !roomCode) {
        socket.emit('error_message', { message: 'Username and room code required' });
        return;
      }

      const code = roomCode.trim().toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room) {
        socket.emit('error_message', { message: 'Room not found' });
        return;
      }

      // Match username to a player in the room
      let playerRole = null;
      if (room.host.username === username.trim()) {
        playerRole = 'host';
      } else if (room.guest.username === username.trim()) {
        playerRole = 'guest';
      } else {
        socket.emit('error_message', { message: 'Username not found in this room' });
        return;
      }

      // Check if game is still active
      const gameState = activeGames.get(code);
      if (!gameState || gameState.status !== 'playing') {
        socket.emit('error_message', { message: 'Game is no longer active' });
        return;
      }

      // Cancel abandon timer
      const timerKey = `${code}_${playerRole}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
        console.log(`Cancelled abandon timer for ${username} in room ${code}`);
      }

      // Update socket info
      socket.join(code);
      socket.roomCode = code;
      socket.playerRole = playerRole;
      socket.username = username.trim();

      // Update MongoDB
      if (playerRole === 'host') {
        room.host.socketId = socket.id;
        room.host.connected = true;
      } else {
        room.guest.socketId = socket.id;
        room.guest.connected = true;
      }
      await room.save();

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
        hostUsername: room.host.username,
        guestUsername: room.guest.username,
        yourDeckCount: gameState.getPlayerDeckCount(playerRole),
        opponentDeckCount: gameState.getPlayerDeckCount(opponentRole),
        isReconnection: true,
      });

      // Notify opponent
      socket.to(code).emit('opponent_reconnected', {
        message: `${username} reconnected!`,
      });

      console.log(`${username} reconnected to room ${code}`);
    } catch (err) {
      console.error('reconnect error:', err);
      socket.emit('error_message', { message: 'Reconnection failed' });
    }
  });
}

module.exports = registerReconnectHandlers;
