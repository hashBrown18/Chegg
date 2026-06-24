/**
 * easyBot.js — Easy difficulty bot AI for CHEGG singleplayer
 * Logic: waits 1 second, spawns a random affordable card, moves a random minion, attacks randomly.
 * Never saves mana, never plans ahead, spends immediately.
 */
import {
  calculateValidSquares,
  getSpawnRows,
  MINION_TYPES,
  getAttackManaCost,
  COLS,
  ROWS,
  cellKey,
  isDarkTile,
} from './gameEngine.js';

function randomPick(arr) {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
 * Run the Easy bot's turn.
 * Returns a promise that resolves with an array of action descriptions.
 * Each action is { type: 'spawn'|'move'|'attack', description: string }
 */
export function runEasyBotTurn(gameEngine) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const actions = [];
      const botRole = 'guest';
      const botHand = gameEngine.getPlayerHand(botRole);
      const mana = gameEngine.getMana(botRole);

      // ── Phase 1: Spawn ──
      // Filter affordable cards, pick one random, place on random valid spawn tile
      const affordableCards = botHand.filter(id => {
        const def = MINION_TYPES[id];
        return def && def.cost <= mana;
      });

      if (affordableCards.length > 0) {
        const cardToSpawn = randomPick(affordableCards);
        const def = MINION_TYPES[cardToSpawn];
        const spawnRows = getSpawnRows(botRole);
        const emptySpawnTiles = [];

        for (let col = 1; col <= 8; col++) {
          for (const row of spawnRows) {
            const key = cellKey(col, row);
            if (!gameEngine.board.has(key)) {
              // Phantom can only spawn on dark tiles
              if (cardToSpawn === 'phantom' && !isDarkTile(col, row)) continue;
              emptySpawnTiles.push({ col, row });
            }
          }
        }

        if (emptySpawnTiles.length > 0) {
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

      // ── Phase 2: Move ──
      // Pick a random friendly minion that hasn't moved/spawned this turn and has valid moves
      // Shulker-Box and Enderman have NO movement squares so they are automatically excluded.
      // Villager movement costs 1 mana (no free movement ever).
      const friendlyMinions = [];
      for (const [, minion] of gameEngine.minionInstances) {
        if (minion.owner !== botRole) continue;
        if (!canMoveMinion(minion)) continue;

        const squares = calculateValidSquares(minion, gameEngine.board);
        if (squares.movementSquares.length > 0) {
          friendlyMinions.push({ minion, movementSquares: squares.movementSquares });
        }
      }

      if (friendlyMinions.length > 0) {
        const choice = randomPick(friendlyMinions);
        const target = randomPick(choice.movementSquares);

        // Villager movement always costs 1 mana
        if (choice.minion.type === 'villager') {
          if (gameEngine.getMana(botRole) < 1) {
            // Not enough mana to move Villager, skip
          } else {
            gameEngine.deductMana(botRole, 1);
            gameEngine.moveMinion(choice.minion.instanceId, target.col, target.row);
            choice.minion.hasMovedThisTurn = true;
            actions.push({
              type: 'move',
              description: `Moved villager to ${target.col}${target.row}`,
            });
          }
        } else {
          gameEngine.moveMinion(choice.minion.instanceId, target.col, target.row);
          choice.minion.hasMovedThisTurn = true;
          actions.push({
            type: 'move',
            description: `Moved ${choice.minion.type} to ${target.col}${target.row}`,
          });
        }
      }

      // ── Phase 3: Attack ──
      // For each friendly minion that can attack, pick one random attack
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

      if (attackers.length > 0) {
        const choice = randomPick(attackers);
        const target = randomPick(choice.attackSquares);

        let direction = undefined;
        if (choice.minion.type === 'iron_golem') {
          // Compute sweep direction from attacker to target
          const dr = target.row.charCodeAt(0) - choice.minion.position.row.charCodeAt(0);
          const dc = target.col - choice.minion.position.col;
          if (Math.abs(dc) > Math.abs(dr)) {
            direction = dc > 0 ? 'right' : 'left';
          } else {
            direction = dr > 0 ? 'down' : 'up';
          }
        }

        const result = gameEngine.resolveAttack(
          choice.minion,
          target.col,
          target.row,
          botRole,
          direction
        );

        if (result.success) {
          actions.push({
            type: 'attack',
            description: `${choice.minion.type} attacked ${target.col}${target.row}`,
          });
        }
      }

      resolve(actions);
    }, 1000);
  });
}
