/**
 * hardBot.js — Hard difficulty bot AI for CHEGG singleplayer
 *
 * Uses Minimax with Alpha-Beta pruning at depth 2.
 * Minimax computation runs in a Web Worker so the main thread never freezes.
 * Strict 150ms time budget — returns best move found if exceeded.
 * Fixed preset deck: 2x Wither, 3x Enderman, 3x Blaze, 3x Iron Golem,
 *                    2x Skeleton, 1x Phantom, 1x Zombie.
 */
import {
  calculateValidSquares,
  getSpawnRows,
  MINION_TYPES,
  getAttackManaCost,
  cellKey,
  isDarkTile,
  rowToIndex,
} from './gameEngine.js';

const PRESET_DECK = [
  'wither', 'wither',
  'enderman', 'enderman', 'enderman',
  'blaze', 'blaze', 'blaze',
  'iron_golem', 'iron_golem', 'iron_golem',
  'skeleton', 'skeleton',
  'phantom',
  'zombie',
];

function findVillager(engine, role) {
  for (const [, minion] of engine.minionInstances) {
    if (minion.type === 'villager' && minion.owner === role) return minion;
  }
  return null;
}

function manhattan(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(rowToIndex(a.row) - rowToIndex(b.row));
}

function serializeEngine(engine) {
  const minions = [];
  for (const [, m] of engine.minionInstances) {
    minions.push({
      instanceId: m.instanceId, type: m.type, owner: m.owner,
      position: { col: m.position.col, row: m.position.row },
      spawnedThisTurn: m.spawnedThisTurn, hasMovedThisTurn: m.hasMovedThisTurn,
      hasAttackedThisTurn: m.hasAttackedThisTurn, hasUsedAbilityThisTurn: m.hasUsedAbilityThisTurn,
    });
  }
  return {
    minions, currentTurn: engine.currentTurn, turnNumber: engine.turnNumber,
    hostMana: engine.hostMana, guestMana: engine.guestMana,
    hostHand: [...engine.hostHand], guestHand: [...engine.guestHand],
  };
}

function createWorker() {
  try {
    return new Worker(
      new URL('./hardBot.worker.js', import.meta.url),
      { type: 'module' }
    );
  } catch {
    return null;
  }
}

export function runHardBotTurn(gameEngine) {
  return new Promise((resolve) => {
    const TIME_BUDGET = 150;
    const startTime = Date.now();
    const actions = [];
    const botRole = 'guest';
    const hand = gameEngine.getPlayerHand(botRole);
    const mana = gameEngine.getMana(botRole);

    const affordable = hand
      .filter(id => { const d = MINION_TYPES[id]; return d && d.cost <= mana; })
      .sort((a, b) => (MINION_TYPES[b]?.cost || 0) - (MINION_TYPES[a]?.cost || 0));

    if (affordable.length > 0) {
      const card = affordable[0];
      const def = MINION_TYPES[card];
      const spawnRows = getSpawnRows(botRole);
      const emptyTiles = [];
      for (let col = 1; col <= 8; col++) {
        for (const row of spawnRows) {
          const key = cellKey(col, row);
          if (!gameEngine.board.has(key)) {
            if (card === 'phantom' && !isDarkTile(col, row)) continue;
            emptyTiles.push({ col, row });
          }
        }
      }
      if (emptyTiles.length > 0) {
        const ev = findVillager(gameEngine, 'host');
        let bestTile = emptyTiles[0];
        if (ev) {
          let bestD = Infinity;
          for (const t of emptyTiles) {
            const d = manhattan(t, ev.position);
            if (d < bestD) { bestD = d; bestTile = t; }
          }
        }
        const res = gameEngine.spawnMinion(botRole, card, bestTile.col, bestTile.row);
        if (res.success) actions.push({ type: 'spawn', description: `Spawned ${def.name} at ${bestTile.col}${bestTile.row}` });
      }
    }

    function applyMove(moveRes) {
      if (moveRes) {
        gameEngine.moveMinion(moveRes.instanceId, moveRes.target.col, moveRes.target.row);
        const minion = gameEngine.getMinionInstance(moveRes.instanceId);
        if (minion) {
          minion.hasMovedThisTurn = true;
          actions.push({ type: 'move', description: `Moved ${minion.type} to ${moveRes.target.col}${moveRes.target.row}` });
        }
      }
    }

    function executeAttacks() {
      const attackers = [];
      for (const [, minion] of gameEngine.minionInstances) {
        if (minion.owner !== botRole) continue;
        if (minion.spawnedThisTurn || minion.hasAttackedThisTurn || minion.hasMovedThisTurn) continue;
        const cost = getAttackManaCost(minion.type);
        if (gameEngine.getMana(botRole) < cost) continue;
        const sq = calculateValidSquares(minion, gameEngine.board);
        if (sq.attackSquares.length > 0) attackers.push({ minion, attackSquares: sq.attackSquares });
      }

      const ev = findVillager(gameEngine, 'host');
      if (ev) {
        attackers.sort((a, b) => {
          const aV = a.attackSquares.some(s => s.col === ev.position.col && s.row === ev.position.row) ? 0 : 1;
          const bV = b.attackSquares.some(s => s.col === ev.position.col && s.row === ev.position.row) ? 0 : 1;
          return aV - bV;
        });
      }

      for (const atk of attackers) {
        const cost = getAttackManaCost(atk.minion.type);
        if (gameEngine.getMana(botRole) < cost) continue;
        const t = atk.attackSquares[0];
        let dir = undefined;
        if (atk.minion.type === 'iron_golem') {
          const dr = t.row.charCodeAt(0) - atk.minion.position.row.charCodeAt(0);
          const dc = t.col - atk.minion.position.col;
          dir = Math.abs(dc) > Math.abs(dr) ? (dc > 0 ? 'right' : 'left') : (dr > 0 ? 'down' : 'up');
        }
        const res = gameEngine.resolveAttack(atk.minion, t.col, t.row, botRole, dir);
        if (res.success) actions.push({ type: 'attack', description: `${atk.minion.type} attacked ${t.col}${t.row}` });
      }
    }

    function finish() {
      executeAttacks();
      resolve(actions);
    }

    const worker = createWorker();
    if (worker) {
      const timeout = setTimeout(() => {
        worker.terminate();
        finish();
      }, TIME_BUDGET);

      worker.onmessage = (e) => {
        if (e.data.type === 'result') {
          clearTimeout(timeout);
          worker.terminate();
          applyMove(e.data.move);
          finish();
        }
      };

      worker.onerror = () => {
        clearTimeout(timeout);
        worker.terminate();
        finish();
      };

      worker.postMessage({
        type: 'compute',
        data: serializeEngine(gameEngine),
        botRole,
        timeBudget: TIME_BUDGET - (Date.now() - startTime),
      });
    } else {
      setTimeout(finish, TIME_BUDGET);
    }
  });
}

export function getHardBotPresetDeck() {
  return [...PRESET_DECK];
}
