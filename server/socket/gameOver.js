/**
 * gameOver.js — the single authoritative path for ending a game and the only
 * owner of the server-side forfeit timers.
 *
 * SINGLE-INSTANCE REQUIREMENT: Game state and forfeit timers live in this
 * process's memory. The server MUST run exactly 1 instance. Running multiple
 * instances (e.g. Railway replicas > 1, Kubernetes replicas > 1) will cause:
 *   - Forfeit timers to fire on only one instance, leaving others stale
 *   - Rejoin on another instance to fail (no in-memory gameState)
 *   - Race conditions on finishGame()
 * Do NOT add Redis or other coordination — configure your host for 1 replica.
 *
 * Every result (villager killed, forfeit timeout, abandoned game) goes through
 * finishGame(), so a game can only ever finish once and every timer for that
 * room is cleared when it does.
 */
const mongoose = require('mongoose');
const Room = require('../models/Room');
const { findRoom, saveRoom } = require('./roomHandlers');

const FORFEIT_MS = 60000;

// `${roomCode}:${playerRole}` -> { timer, deadline, remainingMs }
// Role is the stable slot identity; socket ids change on every refresh, so they
// can never key a timer.
const forfeitTimers = new Map();

// Sweep interval for stale rooms (30 min inactivity or expired deadline)
const SWEEP_INTERVAL_MS = 60 * 1000;
const STALE_ROOM_MS = 30 * 60 * 1000;
let sweepTimer = null;

const timerKey = (roomCode, playerRole) => `${roomCode}:${playerRole}`;

function clearForfeitTimer(roomCode, playerRole) {
  const key = timerKey(roomCode, playerRole);
  const entry = forfeitTimers.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  forfeitTimers.delete(key);
}

function clearRoomForfeitTimers(roomCode) {
  for (const key of [...forfeitTimers.keys()]) {
    if (key.startsWith(`${roomCode}:`)) {
      clearTimeout(forfeitTimers.get(key).timer);
      forfeitTimers.delete(key);
    }
  }
}

/**
 * Start (or restart) the forfeit timer. Persists deadline + disconnectedAt to
 * the Room document so a server restart can re-arm it.
 * Returns an object with { remainingMs, deadline }.
 */
async function startForfeitTimer(roomCode, playerRole, onExpire) {
  clearForfeitTimer(roomCode, playerRole);
  const deadline = Date.now() + FORFEIT_MS;
  const timer = setTimeout(onExpire, FORFEIT_MS);
  forfeitTimers.set(timerKey(roomCode, playerRole), { timer, deadline, remainingMs: FORFEIT_MS });

  // Persist to MongoDB so restart re-arms it
  try {
    const room = await findRoom(roomCode);
    if (room) {
      const player = playerRole === 'host' ? room.host : room.guest;
      if (player) {
        player.disconnectedAt = Date.now();
        player.forfeitDeadline = deadline;
        await saveRoom(room);
      }
    }
  } catch (e) {
    console.error('startForfeitTimer persist error:', e);
  }

  return { remainingMs: FORFEIT_MS, deadline };
}

function getForfeitDeadline(roomCode, playerRole) {
  const entry = forfeitTimers.get(timerKey(roomCode, playerRole));
  return entry ? entry.deadline : null;
}

function getForfeitRemaining(roomCode, playerRole) {
  const entry = forfeitTimers.get(timerKey(roomCode, playerRole));
  return entry ? entry.remainingMs : null;
}

// Liveness comes from the socket room, not the DB flag, so a reconnect that is
// saving right now still counts as online.
function isPlayerOnline(io, roomCode, playerRole) {
  const members = io.sockets.adapter.rooms.get(roomCode);
  if (!members) return false;
  for (const sid of members) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.playerRole === playerRole) return true;
  }
  return false;
}

function buildGameOverPayload(room, winnerRole) {
  const loserRole = winnerRole === 'host' ? 'guest' : 'host';
  const side = (role) => (role === 'host' ? room && room.host : room && room.guest) || {};
  const winner = side(winnerRole);
  const loser = side(loserRole);
  return {
    winnerRole,
    loserRole,
    winnerId: winner.playerId || '',
    loserId: loser.playerId || '',
    winnerUsername: winner.username || (winnerRole === 'host' ? 'Host' : 'Guest'),
    loserUsername: loser.username || (loserRole === 'host' ? 'Host' : 'Guest'),
  };
}

/**
 * Finish the game exactly once, atomically in the database.
 *
 * The winner is claimed with a single findOneAndUpdate guarded on
 * gameState.status === 'playing', so even if two processes (or the boot re-arm
 * and the sweep) race for the same room, exactly one of them flips the status
 * and emits the result. Every other caller returns false without emitting.
 *
 * winnerRole === null abandons the game with no winner (both players gone).
 *
 * SINGLE-INSTANCE: The in-memory `activeGames` Map and the `forfeitTimers` Map
 * exist only on this server process. Running multiple replicas (Railway
 * replicas > 1, K8s replicas > 1) breaks this because:
 *   - A forfeit timer may fire on one replica but the gameState lives on another
 *   - A rejoin may hit a replica that has no in-memory gameState for the room
 *   - finishGame() races across replicas: the atomic Mongo claim prevents double
 *     emission, but the winner replica clears only its local timers; the other
 *     replica's timers leak and may fire later on a finished room.
 * Configure your host for exactly 1 replica/process.
 */
async function finishGame(io, roomCode, activeGames, winnerRole) {
  const gameState = activeGames.get(roomCode);
  if (gameState && gameState.status === 'finished') return false;

  let room;
  if (mongoose.connection.readyState === 1) {
    room = await Room.findOneAndUpdate(
      { roomCode, 'gameState.status': 'playing' },
      {
        $set: {
          'gameState.status': 'finished',
          'gameState.winnerRole': winnerRole || '',
          'host.disconnectedAt': 0,
          'host.forfeitDeadline': 0,
          'guest.disconnectedAt': 0,
          'guest.forfeitDeadline': 0,
        },
      },
      { new: true }
    );

    if (!room) {
      // Did not win the claim: either another caller already finished the game,
      // or the room document is gone (TTL expiry) — the in-memory guard still applies.
      const doc = await Room.findOne({ roomCode }).select('_id').lean();
      if (doc) {
        if (gameState) gameState.status = 'finished';
        clearRoomForfeitTimers(roomCode);
        return false;
      }
      room = await findRoom(roomCode);
    }
  } else {
    room = await findRoom(roomCode);
    if (room && room.gameState && room.gameState.status === 'finished') {
      if (gameState) gameState.status = 'finished';
      clearRoomForfeitTimers(roomCode);
      return false;
    }
    if (room) {
      room.gameState = room.gameState || {};
      room.gameState.status = 'finished';
      room.gameState.winnerRole = winnerRole || '';
      if (room.host) {
        room.host.disconnectedAt = 0;
        room.host.forfeitDeadline = 0;
      }
      if (room.guest) {
        room.guest.disconnectedAt = 0;
        room.guest.forfeitDeadline = 0;
      }
      await saveRoom(room);
    }
  }

  if (gameState) gameState.status = 'finished';
  clearRoomForfeitTimers(roomCode);

  if (winnerRole) {
    io.to(roomCode).emit('game_over', buildGameOverPayload(room, winnerRole));
  } else {
    io.to(roomCode).emit('game_abandoned', { roomCode });
  }
  return true;
}

/**
 * Clear forfeit state from room (on reconnect or normal game finish without forfeit).
 */
async function clearForfeitState(roomCode) {
  try {
    const room = await findRoom(roomCode);
    if (room) {
      if (room.host) {
        room.host.disconnectedAt = 0;
        room.host.forfeitDeadline = 0;
      }
      if (room.guest) {
        room.guest.disconnectedAt = 0;
        room.guest.forfeitDeadline = 0;
      }
      await saveRoom(room);
    }
  } catch (e) {
    console.error('clearForfeitState error:', e);
  }
}

/**
 * Re-arm forfeit timers on server boot for rooms that were mid-forfeit.
 * Called once at startup after MongoDB connects.
 *
 * SINGLE-INSTANCE: This reads `forfeitDeadline` from MongoDB and reconstructs
 * in-process `forfeitTimers`. If the server runs multiple replicas, every
 * replica will re-arm its own copy of the timers — the forfeit clock runs in
 * parallel on each, and the first to fire calls finishGame(). The atomic
 * Mongo claim in finishGame() prevents double emission, but the other
 * replicas' timers will fire later and try to finish an already-finished game.
 * Run exactly 1 replica.
 */
async function rearmForfeitTimers(io, activeGames, onExpire) {
  if (mongoose.connection.readyState !== 1) return;

  try {
    const rooms = await Room.find({
      'gameState.status': 'playing',
      $or: [
        { 'host.forfeitDeadline': { $gt: 0 } },
        { 'guest.forfeitDeadline': { $gt: 0 } },
      ],
    });

    for (const room of rooms) {
      const code = room.roomCode;
      const gameState = activeGames.get(code);
      if (!gameState) {
        // No in-memory game state — cannot re-arm properly.
        console.warn(`[REARM] Room ${code} has forfeit deadline but no active game — skipping`);
        continue;
      }

      const now = Date.now();
      const pending = [];
      for (const role of ['host', 'guest']) {
        const player = role === 'host' ? room.host : room.guest;
        if (player && player.forfeitDeadline && player.forfeitDeadline > 0) {
          pending.push({ role, deadline: player.forfeitDeadline, username: player.username });
        }
      }
      if (!pending.length) continue;

      const expired = pending.filter((p) => p.deadline <= now);

      // Clocks ran out while the server was down. Both gone → abandoned,
      // otherwise the player whose clock ran out forfeits to the opponent.
      if (expired.length) {
        if (expired.length === pending.length && expired.length === 2) {
          console.log(`[REARM] Room ${code} — both deadlines expired, abandoning`);
          await finishGame(io, code, activeGames, null);
        } else {
          const loser = expired[0].role;
          const winner = loser === 'host' ? 'guest' : 'host';
          console.log(`[REARM] Room ${code} ${loser} deadline expired — finishing`);
          await finishGame(io, code, activeGames, winner);
        }
        continue;
      }

      // Not expired yet: re-arm for exactly the time that is left.
      for (const { role, deadline, username } of pending) {
        const remainingMs = deadline - now;
        clearForfeitTimer(code, role);
        const timer = setTimeout(
          () => onExpire(io, code, role, username || role, activeGames),
          remainingMs
        );
        forfeitTimers.set(timerKey(code, role), { timer, deadline, remainingMs });
        console.log(`[REARM] Room ${code} ${role} timer rearmed for ${Math.ceil(remainingMs / 1000)}s`);
      }
    }
  } catch (e) {
    console.error('rearmForfeitTimers error:', e);
  }
}

/**
 * One sweep pass: finish any room whose persisted deadline has passed, then
 * delete rooms that have been idle for 30+ minutes.
 *
 * Exported separately from startSweep so it can be tested directly. Expiry goes
 * through finishGame(), whose atomic claim means a sweep pass and the boot
 * re-arm can never both finish (and both broadcast) the same game.
 *
 * SINGLE-INSTANCE: The sweep runs only on this process. With multiple replicas
 * the sweep would run concurrently on each, all racing finishGame() on the
 * same rooms. The Mongo atomic claim prevents double emission, but all replicas
 * clear only their local `forfeitTimers`; stale timers on the other replicas
 * leak and may fire on already-finished rooms.
 * Run exactly 1 replica.
 */
async function sweepOnce(io, activeGames) {
  const rooms = await Room.find({ 'gameState.status': 'playing' });
  for (const room of rooms) {
    const code = room.roomCode;
    const gameState = activeGames.get(code);
    const now = Date.now();

    // Expired forfeit deadline (safety net if timer didn't fire)
    let expired = false;
    for (const role of ['host', 'guest']) {
      const player = role === 'host' ? room.host : room.guest;
      if (player && player.forfeitDeadline && player.forfeitDeadline > 0 && player.forfeitDeadline <= now) {
        console.log(`[SWEEP] Room ${code} ${role} deadline expired — finishing`);
        await finishGame(io, code, activeGames, role === 'host' ? 'guest' : 'host');
        expired = true;
        break;
      }
    }
    if (expired) continue;

    // Stale room: no active game in memory AND no forfeit deadline AND no activity
    if (!gameState && now - room.createdAt.getTime() > STALE_ROOM_MS) {
      console.log(`[SWEEP] Room ${code} stale — cleaning up`);
      activeGames.delete(code);
      await Room.deleteOne({ roomCode: code });
      io.to(code).emit('room_expired', { roomCode: code });
    }
  }
}

/**
 * Periodic sweep for stale rooms (expired deadline or no activity for 30+ min).
 * Runs every 60s.
 */
function startSweep(io, activeGames) {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = setInterval(() => {
    sweepOnce(io, activeGames).catch((e) => console.error('sweep error:', e));
  }, SWEEP_INTERVAL_MS);
}

function stopSweep() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

/**
 * Drop every forfeit timer (used on SIGTERM/SIGINT so the process exits with
 * no live timers, and by tests between cases).
 */
function clearAllForfeitTimers() {
  for (const entry of forfeitTimers.values()) clearTimeout(entry.timer);
  forfeitTimers.clear();
}

module.exports = {
  FORFEIT_MS,
  clearForfeitTimer,
  clearRoomForfeitTimers,
  clearAllForfeitTimers,
  clearForfeitState,
  startForfeitTimer,
  getForfeitDeadline,
  getForfeitRemaining,
  isPlayerOnline,
  buildGameOverPayload,
  finishGame,
  rearmForfeitTimers,
  startSweep,
  stopSweep,
  sweepOnce,
};