/**
 * mediumBot.js — Medium difficulty bot AI for CHEGG singleplayer
 *
 * Logic:
 *  - Wait 800ms per turn
 *  - Card playing: highest mana cost affordable card (maximise efficiency)
 *  - Placement: spawn tile furthest forward toward enemy Villager
 *  - Movement: move the friendly minion closest to an enemy toward that enemy
 *  - Attacks: always attack if in range, prioritise enemy Villager
 *  - Mana lookahead: if mana is 1-2 and a 3+ cost card exists in hand, save mana
 */
import {
  calculateValidSquares,
  getSpawnRows,
  MINION_TYPES,
  getAttackManaCost,
  cellKey,
  isDarkTile,
  rowToIndex,
  ROWS,
  COLS,
} from './gameEngine.js';

function randomPick(arr) {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function manhattanDist(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(rowToIndex(a.row) - rowToIndex(b.row));
}

function findEnemyVillager(gameEngine, botRole) {
  const enemyRole = botRole === 'guest' ? 'host' : 'guest';
  for (const [, minion] of gameEngine.minionInstances) {
    if (minion.type === 'villager' && minion.owner === enemyRole) {
      return minion.position;
    }
  }
  return null;
}

function canMoveMinion(minion) {
  if (minion.spawnedThisTurn) return false;
  if (minion.hasMovedThisTurn) return false;
  if (minion.hasAttackedThisTurn) return false;
  return true;
}

function canAttackMinion(minion) {
  if (minion.spawnedThisTurn) return false;
  if (minion.hasAttackedThisTurn) return false;
  if (minion.hasMovedThisTurn) return false;
  return true;
}

/**
 * Run the Medium bot's turn.
 * Returns a promise that resolves with an array of action descriptions.
 */
export function runMediumBotTurn(gameEngine) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const actions = [];
      const botRole = 'guest';
      const mana = gameEngine.getMana(botRole);
      const hand = gameEngine.getPlayerHand(botRole);
      const enemyVillager = findEnemyVillager(gameEngine, botRole);

      // ── Mana Lookahead ──
      // If mana is 1 or 2 and a card costing 3+ exists in hand, skip spending
      const hasExpensiveCard = hand.some(id => {
        const def = MINION_TYPES[id];
        return def && def.cost >= 3;
      });
      const shouldSaveMana = (mana === 1 || mana === 2) && hasExpensiveCard;

      // ── Phase 1: Spawn (skip if saving mana) ──
      if (!shouldSaveMana) {
        const affordableCards = hand
          .filter(id => {
            const def = MINION_TYPES[id];
            return def && def.cost <= mana;
          })
          .sort((a, b) => (MINION_TYPES[b]?.cost || 0) - (MINION_TYPES[a]?.cost || 0));

        if (affordableCards.length > 0) {
          const cardToSpawn = affordableCards[0]; // highest cost
          const def = MINION_TYPES[cardToSpawn];
          const spawnRows = getSpawnRows(botRole);
          const emptySpawnTiles = [];

          for (let col = 1; col <= 8; col++) {
            for (const row of spawnRows) {
              const key = cellKey(col, row);
              if (!gameEngine.board.has(key)) {
                if (cardToSpawn === 'phantom' && !isDarkTile(col, row)) continue;
                emptySpawnTiles.push({ col, row });
              }
            }
          }

          if (emptySpawnTiles.length > 0 && enemyVillager) {
            const enemyRowIdx = rowToIndex(enemyVillager.row);
            emptySpawnTiles.sort((a, b) => {
              const aRowIdx = rowToIndex(a.row);
              const bRowIdx = rowToIndex(b.row);
              if (aRowIdx !== bRowIdx) return bRowIdx - aRowIdx;
              return Math.abs(a.col - enemyVillager.col) - Math.abs(b.col - enemyVillager.col);
            });
            const target = emptySpawnTiles[0];
            const result = gameEngine.spawnMinion(botRole, cardToSpawn, target.col, target.row);
            if (result.success) {
              actions.push({
                type: 'spawn',
                description: `Spawned ${def.name} at ${target.col}${target.row}`,
              });
            }
          } else if (emptySpawnTiles.length > 0) {
            const target = randomPick(emptySpawnTiles);
            const result = gameEngine.spawnMinion(botRole, cardToSpawn, target.col, target.row);
            if (result.success) {
              actions.push({
                type: 'spawn',
                description: `Spawned ${def.name} at ${target.col}${target.row}`,
              });
            }
          }
        }
      }

      // ── Phase 2: Move (always allowed, movement is free for most minions) ──
      // Shulker-Box and Enderman return no movement squares so they are excluded.
      // Villager movement costs 1 mana always (no free movement).
      const movableMinions = [];
      let friendlyVillager = null;
      for (const [, minion] of gameEngine.minionInstances) {
        if (minion.owner !== botRole) continue;
        if (!canMoveMinion(minion)) continue;

        if (minion.type === 'villager') {
          friendlyVillager = minion;
          continue;
        }

        const squares = calculateValidSquares(minion, gameEngine.board);
        if (squares.movementSquares.length > 0) {
          let nearestEnemy = null;
          let nearestDist = Infinity;
          for (const [, other] of gameEngine.minionInstances) {
            if (other.owner === botRole) continue;
            const dist = manhattanDist(minion.position, other.position);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestEnemy = other;
            }
          }
          movableMinions.push({ minion, movementSquares: squares.movementSquares, nearestEnemy, nearestDist });
        }
      }

      let moved = false;

      // Villager defensive movement: only move if an enemy is within 3 tiles, costs 1 mana
      if (friendlyVillager && !friendlyVillager.hasMovedThisTurn && !friendlyVillager.hasAttackedThisTurn) {
        let closestEnemy = null;
        let closestDist = Infinity;
        for (const [, other] of gameEngine.minionInstances) {
          if (other.owner === botRole) continue;
          const dist = manhattanDist(friendlyVillager.position, other.position);
          if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = other;
          }
        }

        if (closestEnemy && closestDist <= 3) {
          // Check if we have 1 mana to move Villager
          if (gameEngine.getMana(botRole) >= 1) {
            const squares = calculateValidSquares(friendlyVillager, gameEngine.board);
            if (squares.movementSquares.length > 0) {
              let bestSquare = null;
              let bestDist = -1;
              for (const sq of squares.movementSquares) {
                const dist = manhattanDist(sq, closestEnemy.position);
                if (dist > bestDist) {
                  bestDist = dist;
                  bestSquare = sq;
                }
              }
              if (bestSquare) {
                gameEngine.deductMana(botRole, 1);
                gameEngine.moveMinion(friendlyVillager.instanceId, bestSquare.col, bestSquare.row);
                friendlyVillager.hasMovedThisTurn = true;
                moved = true;
                actions.push({
                  type: 'move',
                  description: `Moved villager to ${bestSquare.col}${bestSquare.row}`,
                });
              }
            }
          }
        }
      }

      // Aggressive movement for non-Villager minions
      if (!moved && movableMinions.length > 0) {
        movableMinions.sort((a, b) => a.nearestDist - b.nearestDist);
        const choice = movableMinions[0];

        if (choice.nearestEnemy) {
          let bestSquare = null;
          let bestDist = Infinity;
          for (const sq of choice.movementSquares) {
            const dist = manhattanDist(sq, choice.nearestEnemy.position);
            if (dist < bestDist) {
              bestDist = dist;
              bestSquare = sq;
            }
          }
          if (bestSquare) {
            gameEngine.moveMinion(choice.minion.instanceId, bestSquare.col, bestSquare.row);
            choice.minion.hasMovedThisTurn = true;
            actions.push({
              type: 'move',
              description: `Moved ${choice.minion.type} to ${bestSquare.col}${bestSquare.row}`,
            });
          }
        } else {
          const target = randomPick(choice.movementSquares);
          gameEngine.moveMinion(choice.minion.instanceId, target.col, target.row);
          choice.minion.hasMovedThisTurn = true;
          actions.push({
            type: 'move',
            description: `Moved ${choice.minion.type} to ${target.col}${target.row}`,
          });
        }
      }

      // ── Phase 3: Attack (skip if saving mana) ──
      if (!shouldSaveMana) {
        const attackers = [];
        for (const [, minion] of gameEngine.minionInstances) {
          if (minion.owner !== botRole) continue;
          if (!canAttackMinion(minion)) continue;

          const attackCost = getAttackManaCost(minion.type);
          if (gameEngine.getMana(botRole) < attackCost) continue;

          const squares = calculateValidSquares(minion, gameEngine.board);
          if (squares.attackSquares.length > 0) {
            attackers.push({ minion, attackSquares: squares.attackSquares });
          }
        }

        if (enemyVillager) {
          attackers.sort((a, b) => {
            const aCanHitVillager = a.attackSquares.some(
              sq => sq.col === enemyVillager.col && sq.row === enemyVillager.row
            ) ? 0 : 1;
            const bCanHitVillager = b.attackSquares.some(
              sq => sq.col === enemyVillager.col && sq.row === enemyVillager.row
            ) ? 0 : 1;
            return aCanHitVillager - bCanHitVillager;
          });
        }

        for (const attacker of attackers) {
          const attackCost = getAttackManaCost(attacker.minion.type);
          if (gameEngine.getMana(botRole) < attackCost) continue;

          let target;
          if (enemyVillager) {
            const villagerSquare = attacker.attackSquares.find(
              sq => sq.col === enemyVillager.col && sq.row === enemyVillager.row
            );
            if (villagerSquare) {
              target = villagerSquare;
            }
          }
          if (!target) {
            target = randomPick(attacker.attackSquares);
          }

          let direction = undefined;
          if (attacker.minion.type === 'iron_golem') {
            const dr = target.row.charCodeAt(0) - attacker.minion.position.row.charCodeAt(0);
            const dc = target.col - attacker.minion.position.col;
            if (Math.abs(dc) > Math.abs(dr)) {
              direction = dc > 0 ? 'right' : 'left';
            } else {
              direction = dr > 0 ? 'down' : 'up';
            }
          }

          const result = gameEngine.resolveAttack(
            attacker.minion,
            target.col,
            target.row,
            botRole,
            direction
          );

          if (result.success) {
            actions.push({
              type: 'attack',
              description: `${attacker.minion.type} attacked ${target.col}${target.row}`,
            });
          }
        }
      }

      resolve(actions);
    }, 800);
  });
}
