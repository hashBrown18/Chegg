/**
 * gameHandlers.js — Socket handlers for gameplay: highlights, movement, attacks,
 * abilities, spawning, and end turn
 */

const { calculateValidSquares, cellKey, calcEndermanTeleportTargets, buildOccupancyMap,
  getIronGolemSweepTargets, getWitherSplashTargets } = require('../game/MovementCalculator');
const { getAttackManaCost, MINION_BY_ID } = require('../game/MinionLogic');
const TurnManager = require('../game/TurnManager');

function registerGameHandlers(io, socket, activeGames) {
  // ─── REQUEST HIGHLIGHTS ───
  socket.on('request_highlights', ({ minionInstanceId }) => {
    const { roomCode, playerRole } = socket;
    if (!roomCode || !playerRole) return;

    const gameState = activeGames.get(roomCode);
    if (!gameState || gameState.status !== 'playing') return;

    // Must be your turn
    if (gameState.currentTurn !== playerRole) return;

    const minion = gameState.getMinionInstance(minionInstanceId);
    if (!minion) return;

    // Must be your own minion
    if (minion.owner !== playerRole) return;

    // Minion spawned this turn cannot act
    if (minion.spawnedThisTurn) {
      socket.emit('valid_moves', { movementSquares: [], attackSquares: [], abilitySquares: [] });
      return;
    }

    // Calculate valid squares
    const { movementSquares, attackSquares } = calculateValidSquares(minion, gameState.board);

    // Filter movement: if minion has attacked this turn, no movement allowed
    let filteredMovement = movementSquares;
    if (minion.hasAttackedThisTurn || minion.hasMovedThisTurn) {
      filteredMovement = [];
    }

    // Movement costs 1 mana for ALL minions — filter out if no mana
    if (gameState.getMana(playerRole) < 1) {
      filteredMovement = [];
    }

    // Filter attacks: check mana and if already attacked
    let filteredAttack = attackSquares;
    const attackCost = getAttackManaCost(minion.type);
    if (minion.hasAttackedThisTurn || gameState.getMana(playerRole) < attackCost) {
      filteredAttack = [];
    }
    // Cannot attack if moved this turn
    if (minion.hasMovedThisTurn) {
      filteredAttack = [];
    }

    // Enderman: calculate teleport targets too
    let abilitySquares = [];
    if (minion.type === 'enderman' && !minion.hasUsedAbilityThisTurn && !minion.hasAttackedThisTurn) {
      if (gameState.getMana(playerRole) >= 1) {
        const occupancy = buildOccupancyMap(gameState.board);
        abilitySquares = calcEndermanTeleportTargets(
          minion.position.col, minion.position.row, occupancy
        );
      }
    }

    // Emit only to requesting player's socket
    socket.emit('valid_moves', {
      minionInstanceId,
      movementSquares: filteredMovement,
      attackSquares: filteredAttack,
      abilitySquares,
    });
  });

  // ─── SPAWN MINION ───
  socket.on('spawn_minion', ({ minionId, targetCell }) => {
    const { roomCode, playerRole } = socket;
    if (!roomCode || !playerRole) return;

    const gameState = activeGames.get(roomCode);
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.currentTurn !== playerRole) return;

    const { col, row } = targetCell;
    const result = gameState.spawnMinion(playerRole, minionId, col, row);

    if (!result.success) {
      socket.emit('error_message', { message: result.error });
      return;
    }

    // Check win condition (Wither spawn explosion can kill Villager)
    const winner = gameState.checkWinCondition();

    // Broadcast board update to both players
    io.to(roomCode).emit('board_update', { boardState: gameState.getBoardState() });

    // Send mana update to spawner
    socket.emit('mana_update', {
      yourMana: gameState.getMana(playerRole),
      maxMana: Math.min(gameState.turnNumber, 6),
    });

    // Send updated hand to spawner
    socket.emit('your_hand', { hand: gameState.getPlayerHand(playerRole) });

    // Send updated card counts to opponent
    const opponentRole = playerRole === 'host' ? 'guest' : 'host';
    emitToPlayer(io, gameState, roomCode, opponentRole, 'opponent_card_count', {
      count: gameState.getPlayerHandCount(playerRole),
    });

    // Send deck counts
    socket.emit('deck_update', {
      yourDeckCount: gameState.getPlayerDeckCount(playerRole),
      opponentDeckCount: gameState.getPlayerDeckCount(opponentRole),
    });

    if (winner) {
      endGame(io, roomCode, gameState, activeGames, winner);
    }
  });

  // ─── MOVE MINION ───
  socket.on('move_minion', ({ minionInstanceId, targetCell }) => {
    const { roomCode, playerRole } = socket;
    if (!roomCode || !playerRole) return;

    const gameState = activeGames.get(roomCode);
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.currentTurn !== playerRole) return;

    const minion = gameState.getMinionInstance(minionInstanceId);
    if (!minion || minion.owner !== playerRole) return;

    // Validate: not spawned this turn, hasn't moved, hasn't attacked
    if (minion.spawnedThisTurn || minion.hasMovedThisTurn || minion.hasAttackedThisTurn) {
      socket.emit('error_message', { message: 'This minion cannot move right now' });
      return;
    }

    // Movement costs 1 mana for ALL minions
    if (gameState.getMana(playerRole) < 1) {
      socket.emit('error_message', { message: 'Not enough mana to move' });
      return;
    }

    // Validate target is in valid movement squares
    const { movementSquares } = calculateValidSquares(minion, gameState.board);
    const { col, row } = targetCell;
    const isValid = movementSquares.some(sq => sq.col === col && sq.row === row);

    if (!isValid) {
      socket.emit('error_message', { message: 'Invalid move target' });
      return;
    }

    // Execute move
    gameState.moveMinion(minionInstanceId, col, row);
    minion.hasMovedThisTurn = true;

    // Deduct 1 mana for movement (ALL minions)
    gameState.deductMana(playerRole, 1);
    socket.emit('mana_update', {
      yourMana: gameState.getMana(playerRole),
      maxMana: Math.min(gameState.turnNumber, 6),
    });

    // Broadcast board update
    io.to(roomCode).emit('board_update', { boardState: gameState.getBoardState() });
  });

  // ─── ATTACK ───
  socket.on('attack', ({ minionInstanceId, targetCell, direction }) => {
    const { roomCode, playerRole } = socket;
    if (!roomCode || !playerRole) return;

    const gameState = activeGames.get(roomCode);
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.currentTurn !== playerRole) return;

    const minion = gameState.getMinionInstance(minionInstanceId);
    if (!minion || minion.owner !== playerRole) return;

    // Validate: not spawned this turn, hasn't attacked, hasn't moved
    if (minion.spawnedThisTurn || minion.hasAttackedThisTurn || minion.hasMovedThisTurn) {
      socket.emit('error_message', { message: 'This minion cannot attack right now' });
      return;
    }

    // Check mana
    const attackCost = getAttackManaCost(minion.type);
    if (gameState.getMana(playerRole) < attackCost) {
      socket.emit('error_message', { message: 'Not enough mana to attack' });
      return;
    }

    const { col, row } = targetCell;

    // Handle each minion type's attack differently
    const destroyedMinions = [];

    switch (minion.type) {
      case 'creeper': {
        // Explosion: destroy ALL 8 surrounding + self
        const occupancy = buildOccupancyMap(gameState.board);
        const directions = [
          { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
          { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
          { dc: -1, dr: 1 }, { dc: 0, dr: 1 }, { dc: 1, dr: 1 },
        ];
        const { rowToIndex, indexToRow, isValidCell, ROWS } = require('../game/MinionLogic');
        const cri = rowToIndex(minion.position.row);

        for (const dir of directions) {
          const nc = minion.position.col + dir.dc;
          const nri = cri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = indexToRow(nri);
          if (!isValidCell(nc, nr)) continue;
          const destroyed = gameState.removeMinionAt(nc, nr);
          if (destroyed) destroyedMinions.push(destroyed);
        }

        // Self destruct
        const selfDestroyed = gameState.removeMinion(minion.instanceId);
        if (selfDestroyed) destroyedMinions.push(selfDestroyed);
        break;
      }

      case 'puffer_fish': {
        // Hit all 4 diagonals simultaneously (friendly fire ON)
        const { rowToIndex, indexToRow, isValidCell, ROWS } = require('../game/MinionLogic');
        const pri = rowToIndex(minion.position.row);
        const diagDirs = [
          { dc: -1, dr: -1 }, { dc: 1, dr: -1 },
          { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
        ];

        for (const dir of diagDirs) {
          const nc = minion.position.col + dir.dc;
          const nri = pri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = indexToRow(nri);
          if (!isValidCell(nc, nr)) continue;
          const destroyed = gameState.removeMinionAt(nc, nr);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        break;
      }

      case 'iron_golem': {
        // Sweeping attack — needs direction
        if (!direction) {
          socket.emit('error_message', { message: 'Iron Golem attack requires a direction' });
          return;
        }
        const sweepTargets = getIronGolemSweepTargets(minion.position.col, minion.position.row, direction);
        for (const target of sweepTargets) {
          const occupant = gameState.getMinionAt(target.col, target.row);
          if (occupant && occupant.owner !== playerRole) {
            const destroyed = gameState.removeMinionAt(target.col, target.row);
            if (destroyed) destroyedMinions.push(destroyed);
          }
        }
        break;
      }

      case 'wither': {
        // Ranged attack: hit target + splash 4 surrounding
        const target = gameState.getMinionAt(col, row);
        if (target) {
          const destroyed = gameState.removeMinionAt(col, row);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        // Splash damage to 4 lateral surrounding tiles
        const splashTargets = getWitherSplashTargets(col, row);
        for (const st of splashTargets) {
          const splashOccupant = gameState.getMinionAt(st.col, st.row);
          if (splashOccupant) {
            // Don't destroy the wither that's attacking
            if (splashOccupant.instanceId !== minion.instanceId) {
              const destroyed = gameState.removeMinionAt(st.col, st.row);
              if (destroyed) destroyedMinions.push(destroyed);
            }
          }
        }
        break;
      }

      case 'villager': {
        // Attack + move to attacked square
        const target = gameState.getMinionAt(col, row);
        if (target && target.owner !== playerRole) {
          const destroyed = gameState.removeMinionAt(col, row);
          if (destroyed) destroyedMinions.push(destroyed);
          // Move villager to the attacked square
          gameState.moveMinion(minion.instanceId, col, row);
        } else {
          socket.emit('error_message', { message: 'Invalid attack target' });
          return;
        }
        break;
      }

      case 'shulker_box': {
        // Long range lateral attack, move to target position on kill
        const target = gameState.getMinionAt(col, row);
        if (target && target.owner !== playerRole) {
          const destroyed = gameState.removeMinionAt(col, row);
          if (destroyed) {
            destroyedMinions.push(destroyed);
            // Shulker-Box moves to the position of the eliminated minion
            gameState.moveMinion(minion.instanceId, col, row);
          }
        } else {
          socket.emit('error_message', { message: 'Invalid attack target' });
          return;
        }
        break;
      }

      default: {
        // Standard attack: zombie, skeleton, blaze, phantom, enderman
        const target = gameState.getMinionAt(col, row);
        if (!target) {
          socket.emit('error_message', { message: 'No target at that position' });
          return;
        }
        // For standard attacks, validate target is enemy
        if (target.owner === playerRole) {
          socket.emit('error_message', { message: 'Cannot attack your own minion' });
          return;
        }
        const destroyed = gameState.removeMinionAt(col, row);
        if (destroyed) destroyedMinions.push(destroyed);
        break;
      }
    }

    // Deduct mana
    gameState.deductMana(playerRole, attackCost);
    minion.hasAttackedThisTurn = true;

    // Check win condition
    const winner = gameState.checkWinCondition();

    // Broadcast updates
    io.to(roomCode).emit('board_update', { boardState: gameState.getBoardState() });
    socket.emit('mana_update', {
      yourMana: gameState.getMana(playerRole),
      maxMana: Math.min(gameState.turnNumber, 6),
    });

    if (winner) {
      endGame(io, roomCode, gameState, activeGames, winner);
    }
  });

  // ─── USE ABILITY (Enderman Teleport) ───
  socket.on('use_ability', ({ minionInstanceId, targetCell }) => {
    const { roomCode, playerRole } = socket;
    if (!roomCode || !playerRole) return;

    const gameState = activeGames.get(roomCode);
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.currentTurn !== playerRole) return;

    const minion = gameState.getMinionInstance(minionInstanceId);
    if (!minion || minion.owner !== playerRole) return;

    if (minion.spawnedThisTurn || minion.hasUsedAbilityThisTurn) {
      socket.emit('error_message', { message: 'Cannot use ability right now' });
      return;
    }

    if (minion.type === 'enderman') {
      // Teleport: swap positions, costs 1 mana, can't target Villager
      if (minion.hasAttackedThisTurn) {
        socket.emit('error_message', { message: 'Enderman cannot teleport after attacking' });
        return;
      }

      if (gameState.getMana(playerRole) < 1) {
        socket.emit('error_message', { message: 'Not enough mana for teleport' });
        return;
      }

      const { col, row } = targetCell;
      const target = gameState.getMinionAt(col, row);

      if (!target) {
        socket.emit('error_message', { message: 'No minion at target position' });
        return;
      }

      if (target.type === 'villager') {
        socket.emit('error_message', { message: 'Cannot teleport to Villager' });
        return;
      }

      // Validate target is in a lateral line from Enderman
      const occupancy = buildOccupancyMap(gameState.board);
      const validTargets = calcEndermanTeleportTargets(
        minion.position.col, minion.position.row, occupancy
      );
      const isValid = validTargets.some(sq => sq.col === col && sq.row === row);

      if (!isValid) {
        socket.emit('error_message', { message: 'Invalid teleport target' });
        return;
      }

      // Swap positions
      const endermanPos = { ...minion.position };
      const targetPos = { ...target.position };

      // Remove both from board
      const oldEndermanKey = cellKey(endermanPos.col, endermanPos.row);
      const oldTargetKey = cellKey(targetPos.col, targetPos.row);
      gameState.board.delete(oldEndermanKey);
      gameState.board.delete(oldTargetKey);

      // Swap
      minion.position = targetPos;
      target.position = endermanPos;

      // Re-add to board
      gameState.board.set(cellKey(targetPos.col, targetPos.row), minion);
      gameState.board.set(cellKey(endermanPos.col, endermanPos.row), target);

      minion.hasUsedAbilityThisTurn = true;
      gameState.deductMana(playerRole, 1);

      // Enderman cannot attack the same turn as teleport
      minion.hasAttackedThisTurn = true;

      io.to(roomCode).emit('board_update', { boardState: gameState.getBoardState() });
      socket.emit('mana_update', {
        yourMana: gameState.getMana(playerRole),
        maxMana: Math.min(gameState.turnNumber, 6),
      });
    }
  });

  // ─── END TURN ───
  socket.on('end_turn', () => {
    const { roomCode, playerRole } = socket;
    if (!roomCode || !playerRole) return;

    const gameState = activeGames.get(roomCode);
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.currentTurn !== playerRole) return;

    const result = TurnManager.endTurn(gameState);
    const { newTurn, turnNumber } = result;

    // Emit turn change to both players
    io.to(roomCode).emit('turn_change', {
      currentTurn: newTurn,
      turnNumber,
    });

    // Send private data to each player
    const hostSocketId = getPlayerSocketId(io, roomCode, 'host');
    const guestSocketId = getPlayerSocketId(io, roomCode, 'guest');

    // New active player gets their mana update and hand
    const activeSocket = newTurn === 'host'
      ? io.sockets.sockets.get(hostSocketId)
      : io.sockets.sockets.get(guestSocketId);

    const inactiveSocket = newTurn === 'host'
      ? io.sockets.sockets.get(guestSocketId)
      : io.sockets.sockets.get(hostSocketId);

    if (activeSocket) {
      activeSocket.emit('mana_update', {
        yourMana: gameState.getMana(newTurn),
        maxMana: Math.min(turnNumber, 6),
      });
      activeSocket.emit('your_hand', {
        hand: gameState.getPlayerHand(newTurn),
      });
      activeSocket.emit('deck_update', {
        yourDeckCount: gameState.getPlayerDeckCount(newTurn),
        opponentDeckCount: gameState.getPlayerDeckCount(newTurn === 'host' ? 'guest' : 'host'),
      });
    }

    // Inactive player gets opponent card count
    if (inactiveSocket) {
      inactiveSocket.emit('opponent_card_count', {
        count: gameState.getPlayerHandCount(newTurn),
      });
      inactiveSocket.emit('mana_update', {
        yourMana: gameState.getMana(newTurn === 'host' ? 'guest' : 'host'),
        maxMana: Math.min(turnNumber, 6),
      });
    }
  });
}

/**
 * End the game and notify players
 */
function endGame(io, roomCode, gameState, activeGames, winnerRole) {
  gameState.status = 'finished';

  // Get usernames from connected sockets
  let winnerUsername = winnerRole;
  let loserUsername = winnerRole === 'host' ? 'guest' : 'host';

  // Try to find usernames from sockets in the room
  const roomSockets = io.sockets.adapter.rooms.get(roomCode);
  if (roomSockets) {
    for (const sid of roomSockets) {
      const s = io.sockets.sockets.get(sid);
      if (s && s.playerRole === winnerRole) winnerUsername = s.username || winnerRole;
      if (s && s.playerRole !== winnerRole) loserUsername = s.username || loserUsername;
    }
  }

  io.to(roomCode).emit('game_over', {
    winner: winnerUsername,
    loser: loserUsername,
    winnerRole,
  });
}

/**
 * Helper: emit to a specific player role in a room
 */
function emitToPlayer(io, gameState, roomCode, targetRole, event, data) {
  const roomSockets = io.sockets.adapter.rooms.get(roomCode);
  if (!roomSockets) return;

  for (const sid of roomSockets) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.playerRole === targetRole) {
      s.emit(event, data);
      break;
    }
  }
}

/**
 * Helper: get socket ID for a player role
 */
function getPlayerSocketId(io, roomCode, targetRole) {
  const roomSockets = io.sockets.adapter.rooms.get(roomCode);
  if (!roomSockets) return null;

  for (const sid of roomSockets) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.playerRole === targetRole) {
      return sid;
    }
  }
  return null;
}

module.exports = registerGameHandlers;
