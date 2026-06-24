/**
 * hardBot.worker.js — Web Worker for Hard Bot minimax computation.
 * Runs entirely off the main thread so the browser never freezes.
 * Receives serialized game state, returns the best move found within the time budget.
 */
import {
  calculateValidSquares,
  getAttackManaCost,
  cellKey,
  rowToIndex,
  ROWS,
  COLS,
  isDarkTile,
} from './gameEngine.js';

const ATTACK_POWER = {
  villager: 1, zombie: 1, creeper: 2, puffer_fish: 2,
  iron_golem: 3, skeleton: 2, blaze: 2, phantom: 2,
  enderman: 3, shulker_box: 3, wither: 6,
};

function findVillager(engine, role) {
  for (const [, minion] of engine.minionInstances) {
    if (minion.type === 'villager' && minion.owner === role) return minion;
  }
  return null;
}

function manhattan(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(rowToIndex(a.row) - rowToIndex(b.row));
}

function forwardScore(position, owner) {
  const ri = rowToIndex(position.row);
  return owner === 'guest' ? ri : 9 - ri;
}

function getEnemyRole(role) {
  return role === 'guest' ? 'host' : 'guest';
}

function snapshotEngine(engine) {
  const board = new Map();
  for (const [key, minion] of engine.board) {
    board.set(key, {
      instanceId: minion.instanceId, type: minion.type, owner: minion.owner,
      position: { col: minion.position.col, row: minion.position.row },
      spawnedThisTurn: minion.spawnedThisTurn, hasMovedThisTurn: minion.hasMovedThisTurn,
      hasAttackedThisTurn: minion.hasAttackedThisTurn, hasUsedAbilityThisTurn: minion.hasUsedAbilityThisTurn,
    });
  }
  const instances = new Map();
  for (const [id, minion] of engine.minionInstances) {
    instances.set(id, board.get(cellKey(minion.position.col, minion.position.row)));
  }
  return {
    board, instances,
    currentTurn: engine.currentTurn, turnNumber: engine.turnNumber,
    hostMana: engine.hostMana, guestMana: engine.guestMana,
    hostHand: [...engine.hostHand], guestHand: [...engine.guestHand],
  };
}

function restoreEngine(engine, snap) {
  engine.board = snap.board;
  engine.minionInstances = snap.instances;
  engine.currentTurn = snap.currentTurn;
  engine.turnNumber = snap.turnNumber;
  engine.hostMana = snap.hostMana;
  engine.guestMana = snap.guestMana;
  engine.hostHand = [...snap.hostHand];
  engine.guestHand = [...snap.guestHand];
}

function evaluate(engine, botRole) {
  const enemyRole = getEnemyRole(botRole);
  const botVillager = findVillager(engine, botRole);
  const enemyVillager = findVillager(engine, enemyRole);
  if (!enemyVillager) return 10000;
  if (!botVillager) return -10000;

  let friendlyPower = 0, enemyPower = 0, friendlyFwd = 0, friendlyCount = 0;
  let totalFriendlyDist = 0, closestEnemyDist = Infinity;

  for (const [, m] of engine.minionInstances) {
    if (m.type === 'villager') continue;
    const power = ATTACK_POWER[m.type] || 1;
    if (m.owner === botRole) {
      friendlyPower += power;
      friendlyFwd += forwardScore(m.position, botRole);
      friendlyCount++;
      totalFriendlyDist += manhattan(m.position, enemyVillager.position);
    } else {
      enemyPower += power;
      const d = manhattan(m.position, botVillager.position);
      if (d < closestEnemyDist) closestEnemyDist = d;
    }
  }

  let score = (friendlyPower - enemyPower) * 10;
  if (friendlyCount > 0) score += friendlyFwd * 2;
  score += forwardScore(enemyVillager.position, enemyRole) * 3;
  if (friendlyCount > 0) score -= (totalFriendlyDist / friendlyCount) * 2;

  if (closestEnemyDist <= 2) score -= (3 - closestEnemyDist) * 80;
  else if (closestEnemyDist <= 4) score -= (5 - closestEnemyDist) * 15;

  for (const [, m] of engine.minionInstances) {
    if (m.owner === botRole && m.type !== 'villager') {
      const d = manhattan(m.position, enemyVillager.position);
      if (d <= 2) score += 20;
      else if (d <= 4) score += 8;
    }
  }

  return score;
}

function calcIronGolemDirection(from, to) {
  const dr = to.row.charCodeAt(0) - from.row.charCodeAt(0);
  const dc = to.col - from.col;
  return Math.abs(dc) > Math.abs(dr)
    ? (dc > 0 ? 'right' : 'left')
    : (dr > 0 ? 'down' : 'up');
}

function getValidAttackTargets(engine, minion, role) {
  const squares = calculateValidSquares(minion, engine.board);
  if (squares.attackSquares.length === 0) return [];
  const enemyRole = getEnemyRole(role);
  const enemyVillager = findVillager(engine, enemyRole);
  const results = [];

  for (const sq of squares.attackSquares) {
    const occupant = engine.getMinionAt(sq.col, sq.row);
    if (occupant && occupant.owner !== role) {
      let priority = 0;
      if (enemyVillager && sq.col === enemyVillager.position.col && sq.row === enemyVillager.position.row) {
        priority = 1000;
      } else {
        priority = ATTACK_POWER[occupant.type] || 0;
      }
      results.push({ ...sq, priority, power: ATTACK_POWER[occupant.type] || 0 });
    }
  }
  results.sort((a, b) => b.priority - a.priority);
  return results;
}

function executeAttacksInPlace(engine, role) {
  let mana = engine.getMana(role);
  for (const [, minion] of engine.minionInstances) {
    if (minion.owner !== role) continue;
    if (minion.spawnedThisTurn || minion.hasAttackedThisTurn || minion.hasMovedThisTurn) continue;
    const cost = getAttackManaCost(minion.type);
    if (mana < cost) continue;
    const targets = getValidAttackTargets(engine, minion, role);
    if (targets.length === 0) continue;
    const t = targets[0];
    let dir = undefined;
    if (minion.type === 'iron_golem') dir = calcIronGolemDirection(minion.position, t);
    const res = engine.resolveAttack(minion, t.col, t.row, role, dir);
    if (res.success) mana -= cost;
  }
}

function minimax(engine, depth, alpha, beta, botRole, start, limit) {
  if (Date.now() - start > limit || depth === 0) {
    return { score: evaluate(engine, botRole) };
  }

  const isMax = engine.currentTurn === botRole;
  const role = isMax ? botRole : getEnemyRole(botRole);

  const candidates = [];
  for (const [, minion] of engine.minionInstances) {
    if (minion.owner !== role) continue;
    if (minion.spawnedThisTurn || minion.hasMovedThisTurn || minion.hasAttackedThisTurn) continue;
    const sq = calculateValidSquares(minion, engine.board);
    for (const s of sq.movementSquares) {
      candidates.push({ minion, target: s });
    }
  }

  const enemyV = findVillager(engine, getEnemyRole(role));
  if (enemyV) {
    candidates.sort((a, b) => manhattan(a.target, enemyV.position) - manhattan(b.target, enemyV.position));
  }

  const limit2 = depth >= 3 ? 8 : depth >= 2 ? 12 : 16;
  const limited = candidates.slice(0, limit2);

  if (isMax) {
    let best = -Infinity;
    for (const { minion, target } of limited) {
      if (Date.now() - start > limit) break;
      const oc = minion.position.col, or2 = minion.position.row;
      const ok = cellKey(oc, or2), nk = cellKey(target.col, target.row);
      engine.board.delete(ok);
      minion.position.col = target.col;
      minion.position.row = target.row;
      engine.board.set(nk, minion);
      minion.hasMovedThisTurn = true;

      const snap = snapshotEngine(engine);
      executeAttacksInPlace(engine, role);
      const prev = engine.currentTurn;
      engine.currentTurn = getEnemyRole(role);

      const r = minimax(engine, depth - 1, alpha, beta, botRole, start, limit);
      restoreEngine(engine, snap);
      engine.currentTurn = prev;

      engine.board.delete(nk);
      minion.position.col = oc;
      minion.position.row = or2;
      engine.board.set(ok, minion);
      minion.hasMovedThisTurn = false;

      if (r.score > best) best = r.score;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return { score: best };
  } else {
    let worst = Infinity;
    for (const { minion, target } of limited) {
      if (Date.now() - start > limit) break;
      const oc = minion.position.col, or2 = minion.position.row;
      const ok = cellKey(oc, or2), nk = cellKey(target.col, target.row);
      engine.board.delete(ok);
      minion.position.col = target.col;
      minion.position.row = target.row;
      engine.board.set(nk, minion);
      minion.hasMovedThisTurn = true;

      const snap = snapshotEngine(engine);
      executeAttacksInPlace(engine, role);
      const prev = engine.currentTurn;
      engine.currentTurn = getEnemyRole(role);

      const r = minimax(engine, depth - 1, alpha, beta, botRole, start, limit);
      restoreEngine(engine, snap);
      engine.currentTurn = prev;

      engine.board.delete(nk);
      minion.position.col = oc;
      minion.position.row = or2;
      engine.board.set(ok, minion);
      minion.hasMovedThisTurn = false;

      if (r.score < worst) worst = r.score;
      beta = Math.min(beta, worst);
      if (beta <= alpha) break;
    }
    return { score: worst };
  }
}

function calcBestMove(engine, botRole, timeLimit) {
  const start = Date.now();
  const DEPTH = 2;
  const candidates = [];
  for (const [, minion] of engine.minionInstances) {
    if (minion.owner !== botRole) continue;
    if (minion.spawnedThisTurn || minion.hasMovedThisTurn || minion.hasAttackedThisTurn) continue;
    const sq = calculateValidSquares(minion, engine.board);
    for (const s of sq.movementSquares) candidates.push({ minion, target: s });
  }
  if (candidates.length === 0) return null;

  const ev = findVillager(engine, 'host');
  if (ev) candidates.sort((a, b) => manhattan(a.target, ev.position) - manhattan(b.target, ev.position));
  const limited = candidates.slice(0, 20);

  let bestScore = -Infinity, bestMove = null;
  for (const { minion, target } of limited) {
    if (Date.now() - start > timeLimit) break;
    const oc = minion.position.col, or2 = minion.position.row;
    const ok = cellKey(oc, or2), nk = cellKey(target.col, target.row);
    engine.board.delete(ok);
    minion.position.col = target.col;
    minion.position.row = target.row;
    engine.board.set(nk, minion);
    minion.hasMovedThisTurn = true;

    const snap = snapshotEngine(engine);
    executeAttacksInPlace(engine, botRole);
    engine.currentTurn = 'host';

    const r = minimax(engine, DEPTH - 1, -Infinity, Infinity, botRole, start, timeLimit);
    restoreEngine(engine, snap);
    engine.currentTurn = botRole;

    engine.board.delete(nk);
    minion.position.col = oc;
    minion.position.row = or2;
    engine.board.set(ok, minion);
    minion.hasMovedThisTurn = false;

    if (r.score > bestScore) {
      bestScore = r.score;
      bestMove = { minion, target };
    }
  }
  return bestMove;
}

function serializeEngine(engine) {
  const minions = [];
  for (const [, m] of engine.minionInstances) {
    minions.push({
      instanceId: m.instanceId,
      type: m.type,
      owner: m.owner,
      position: { col: m.position.col, row: m.position.row },
      spawnedThisTurn: m.spawnedThisTurn,
      hasMovedThisTurn: m.hasMovedThisTurn,
      hasAttackedThisTurn: m.hasAttackedThisTurn,
      hasUsedAbilityThisTurn: m.hasUsedAbilityThisTurn,
    });
  }
  return {
    minions,
    currentTurn: engine.currentTurn,
    turnNumber: engine.turnNumber,
    hostMana: engine.hostMana,
    guestMana: engine.guestMana,
    hostHand: [...engine.hostHand],
    guestHand: [...engine.guestHand],
  };
}

function reconstructEngine(data) {
  const engine = {
    board: new Map(),
    minionInstances: new Map(),
    currentTurn: data.currentTurn,
    turnNumber: data.turnNumber,
    hostMana: data.hostMana,
    guestMana: data.guestMana,
    hostHand: [...data.hostHand],
    guestHand: [...data.guestHand],
  };

  for (const m of data.minions) {
    const obj = {
      instanceId: m.instanceId,
      type: m.type,
      owner: m.owner,
      position: { col: m.position.col, row: m.position.row },
      spawnedThisTurn: m.spawnedThisTurn,
      hasMovedThisTurn: m.hasMovedThisTurn,
      hasAttackedThisTurn: m.hasAttackedThisTurn,
      hasUsedAbilityThisTurn: m.hasUsedAbilityThisTurn,
    };
    engine.minionInstances.set(m.instanceId, obj);
    engine.board.set(cellKey(m.position.col, m.position.row), obj);
  }

  engine.getMana = function (role) {
    return role === 'host' ? this.hostMana : this.guestMana;
  };
  engine.getMinionAt = function (col, row) {
    return this.board.get(cellKey(col, row)) || null;
  };
  engine.moveMinion = function (instanceId, newCol, newRow) {
    const minion = this.minionInstances.get(instanceId);
    if (!minion) return false;
    this.board.delete(cellKey(minion.position.col, minion.position.row));
    minion.position.col = newCol;
    minion.position.row = newRow;
    this.board.set(cellKey(newCol, newRow), minion);
    return true;
  };
  engine.removeMinion = function (instanceId) {
    const minion = this.minionInstances.get(instanceId);
    if (!minion) return null;
    this.board.delete(cellKey(minion.position.col, minion.position.row));
    this.minionInstances.delete(instanceId);
    return minion;
  };
  engine.removeMinionAt = function (col, row) {
    const key = cellKey(col, row);
    const minion = this.board.get(key);
    if (!minion) return null;
    this.board.delete(key);
    this.minionInstances.delete(minion.instanceId);
    return minion;
  };
  engine.resolveAttack = function (minion, targetCol, targetRow, playerRole, direction) {
    const { type, owner, position } = minion;
    const attackCost = getAttackManaCost(type);
    const mana = this.getMana(playerRole);

    if (mana < attackCost) return { success: false, error: 'Not enough mana' };
    if (minion.spawnedThisTurn) return { success: false, error: 'Spawned this turn' };
    if (minion.hasAttackedThisTurn) return { success: false, error: 'Already attacked' };
    if (minion.hasMovedThisTurn) return { success: false, error: 'Already moved' };

    if (playerRole === 'host') {
      this.hostMana -= attackCost;
    } else {
      this.guestMana -= attackCost;
    }

    const destroyedMinions = [];

    switch (type) {
      case 'creeper': {
        const ri = rowToIndex(position.row);
        for (const dir of ALL_8_DIRECTIONS) {
          const nc = position.col + dir.dc;
          const nri = ri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = ROWS[nri];
          if (nc < 1 || nc > 8) continue;
          const destroyed = this.removeMinionAt(nc, nr);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        this.removeMinion(minion.instanceId);
        break;
      }
      case 'puffer_fish': {
        const ri = rowToIndex(position.row);
        for (const dir of DIAGONAL_DIRS) {
          const nc = position.col + dir.dc;
          const nri = ri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = ROWS[nri];
          if (nc < 1 || nc > 8) continue;
          const destroyed = this.removeMinionAt(nc, nr);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        break;
      }
      case 'iron_golem': {
        if (!direction) return { success: false, error: 'Direction required' };
        const ri = rowToIndex(position.row);
        let offsets;
        switch (direction) {
          case 'up':    offsets = [{ dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 }]; break;
          case 'down':  offsets = [{ dc: -1, dr: 1 }, { dc: 0, dr: 1 }, { dc: 1, dr: 1 }]; break;
          case 'left':  offsets = [{ dc: -1, dr: -1 }, { dc: -1, dr: 0 }, { dc: -1, dr: 1 }]; break;
          case 'right': offsets = [{ dc: 1, dr: -1 }, { dc: 1, dr: 0 }, { dc: 1, dr: 1 }]; break;
          default: return { success: false, error: 'Invalid direction' };
        }
        for (const offset of offsets) {
          const nc = position.col + offset.dc;
          const nri = ri + offset.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = ROWS[nri];
          if (nc < 1 || nc > 8) continue;
          const occupant = this.getMinionAt(nc, nr);
          if (occupant && occupant.owner !== playerRole) {
            const destroyed = this.removeMinionAt(nc, nr);
            if (destroyed) destroyedMinions.push(destroyed);
          }
        }
        break;
      }
      case 'wither': {
        const target = this.getMinionAt(targetCol, targetRow);
        if (target) {
          const destroyed = this.removeMinionAt(targetCol, targetRow);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        const ri = rowToIndex(targetRow);
        for (const dir of LATERAL_DIRS) {
          const nc = targetCol + dir.dc;
          const nri = ri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = ROWS[nri];
          if (nc < 1 || nc > 8) continue;
          const splashOccupant = this.getMinionAt(nc, nr);
          if (splashOccupant && splashOccupant.instanceId !== minion.instanceId) {
            const destroyed = this.removeMinionAt(nc, nr);
            if (destroyed) destroyedMinions.push(destroyed);
          }
        }
        break;
      }
      case 'villager': {
        const target = this.getMinionAt(targetCol, targetRow);
        if (target && target.owner !== playerRole) {
          this.removeMinionAt(targetCol, targetRow);
          this.moveMinion(minion.instanceId, targetCol, targetRow);
        }
        break;
      }
      case 'shulker_box': {
        const target = this.getMinionAt(targetCol, targetRow);
        if (target && target.owner !== playerRole) {
          this.removeMinionAt(targetCol, targetRow);
          this.moveMinion(minion.instanceId, targetCol, targetRow);
        }
        break;
      }
      default: {
        const target = this.getMinionAt(targetCol, targetRow);
        if (target && target.owner !== playerRole) {
          this.removeMinionAt(targetCol, targetRow);
        }
        break;
      }
    }

    minion.hasAttackedThisTurn = true;
    return { success: true, destroyedMinions };
  };

  return engine;
}

const LATERAL_DIRS = [
  { dc: 0, dr: -1 }, { dc: 0, dr: 1 },
  { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
];
const DIAGONAL_DIRS = [
  { dc: -1, dr: -1 }, { dc: 1, dr: -1 },
  { dc: -1, dr: 1 }, { dc: 1, dr: 1 },
];
const ALL_8_DIRECTIONS = [...LATERAL_DIRS, ...DIAGONAL_DIRS];

self.onmessage = (e) => {
  const { type, data, botRole, timeBudget } = e.data;

  if (type === 'compute') {
    try {
      const engine = reconstructEngine(data);
      const move = calcBestMove(engine, botRole, timeBudget);

      if (move) {
        self.postMessage({
          type: 'result',
          move: {
            instanceId: move.minion.instanceId,
            target: { col: move.target.col, row: move.target.row },
          },
        });
      } else {
        self.postMessage({ type: 'result', move: null });
      }
    } catch (err) {
      self.postMessage({ type: 'result', move: null, error: err.message });
    }
  }
};
