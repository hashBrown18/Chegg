/**
 * gameEngine.js — Client-side game state management for CHEGG singleplayer
 * Ported from server/game/GameState.js + MinionLogic.js + MovementCalculator.js
 * Runs entirely in the browser, zero server calls.
 */

// ── Minion Definitions ──
export const MINION_TYPES = {
  villager:    { id: 'villager',    name: 'Villager',    cost: 0,  isKing: true },
  zombie:      { id: 'zombie',      name: 'Zombie',      cost: 1 },
  creeper:     { id: 'creeper',     name: 'Creeper',     cost: 1,  friendlyFire: true },
  puffer_fish: { id: 'puffer_fish', name: 'Puffer-Fish', cost: 2,  friendlyFire: true },
  iron_golem:  { id: 'iron_golem',  name: 'Iron Golem',  cost: 2 },
  skeleton:    { id: 'skeleton',    name: 'Skeleton',    cost: 3 },
  blaze:       { id: 'blaze',       name: 'Blaze',       cost: 3 },
  phantom:     { id: 'phantom',     name: 'Phantom',     cost: 3 },
  enderman:    { id: 'enderman',    name: 'Enderman',    cost: 4 },
  shulker_box: { id: 'shulker_box', name: 'Shulker-Box', cost: 4 },
  wither:      { id: 'wither',      name: 'Wither',      cost: 6,  friendlyFire: true, attackManaCost: 2 },
};

export const DECK_MINION_IDS = [
  'zombie', 'creeper', 'puffer_fish', 'iron_golem', 'skeleton',
  'blaze', 'phantom', 'enderman', 'shulker_box', 'wither',
];

// ── Board Constants ──
export const COLS = [1, 2, 3, 4, 5, 6, 7, 8];
export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROW_INDEX = {};
ROWS.forEach((r, i) => { ROW_INDEX[r] = i; });

export const HOST_SPAWN_ROWS = ['I', 'J'];
export const GUEST_SPAWN_ROWS = ['A', 'B'];

// ── Direction Constants ──
const LATERAL = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
];
const DIAGONAL = [
  { dc: -1, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: 1, dr: 1 },
];
const ALL_8 = [...LATERAL, ...DIAGONAL];

// ── Helper Functions ──
export function cellKey(col, row) {
  return `${col},${row}`;
}

export function isDarkTile(col, row) {
  return (col + ROW_INDEX[row]) % 2 === 1;
}

export function isValidCell(col, row) {
  return COLS.includes(col) && ROWS.includes(row);
}

export function rowToIndex(row) {
  return ROW_INDEX[row];
}

export function indexToRow(index) {
  return ROWS[index];
}

function getForwardDirection(owner) {
  return owner === 'host' ? -1 : 1;
}

export function getAttackManaCost(minionType) {
  if (minionType === 'wither') return 2;
  return 1;
}

export function getSpawnRows(playerRole) {
  return playerRole === 'host' ? HOST_SPAWN_ROWS : GUEST_SPAWN_ROWS;
}

// ── Movement Calculator ──
function buildOccupancyMap(board) {
  const map = {};
  if (board instanceof Map) {
    for (const [key, minion] of board) {
      map[key] = minion;
    }
  } else if (board && typeof board === 'object') {
    for (const [key, minion] of Object.entries(board)) {
      map[key] = minion;
    }
  }
  return map;
}

function getSquaresInDirections(col, row, directions, range, occupancy, owner, isMovement, blocked = false, friendlyFire = false) {
  const squares = [];
  const ri = rowToIndex(row);

  for (const dir of directions) {
    for (let step = 1; step <= range; step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;

      const key = cellKey(nc, nr);
      const occupant = occupancy[key];

      if (isMovement) {
        if (occupant) {
          if (blocked) break;
          continue;
        }
        squares.push({ col: nc, row: nr });
        if (!blocked) continue;
      } else {
        if (blocked && occupant && occupant.owner === owner && !friendlyFire) {
          break;
        }
        if (blocked && !occupant && step < range) {
          continue;
        }
        if (occupant) {
          if (occupant.owner !== owner || friendlyFire) {
            squares.push({ col: nc, row: nr });
          }
          if (blocked) break;
        }
        if (blocked && !occupant) {
          continue;
        }
      }
    }
  }
  return squares;
}

function calcVillager(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    const occupant = occupancy[key];
    if (!occupant) {
      movement.push({ col: nc, row: nr });
    } else if (occupant.owner !== owner) {
      attack.push({ col: nc, row: nr });
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcZombie(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  const fwd = getForwardDirection(owner);
  const forwardDirs = [
    { dc: -1, dr: fwd },
    { dc: 0, dr: fwd },
    { dc: 1, dr: fwd },
  ];
  for (const dir of forwardDirs) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    if (!occupancy[key]) {
      movement.push({ col: nc, row: nr });
    }
  }
  for (const dir of LATERAL) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    const occupant = occupancy[key];
    if (occupant && occupant.owner !== owner) {
      attack.push({ col: nc, row: nr });
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcCreeper(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    const occupant = occupancy[key];
    if (!occupant) {
      movement.push({ col: nc, row: nr });
    }
  }
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    const occupant = occupancy[key];
    if (occupant) {
      attack.push({ col: nc, row: nr });
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcPufferFish(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of LATERAL) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    if (!occupancy[key]) {
      movement.push({ col: nc, row: nr });
    }
  }
  for (const dir of DIAGONAL) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    const occupant = occupancy[key];
    if (occupant) {
      attack.push({ col: nc, row: nr });
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcIronGolem(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    if (!occupancy[key]) {
      movement.push({ col: nc, row: nr });
    }
  }
  const sweepPatterns = [
    [{ dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 }],
    [{ dc: -1, dr: 1 }, { dc: 0, dr: 1 }, { dc: 1, dr: 1 }],
    [{ dc: -1, dr: -1 }, { dc: -1, dr: 0 }, { dc: -1, dr: 1 }],
    [{ dc: 1, dr: -1 }, { dc: 1, dr: 0 }, { dc: 1, dr: 1 }],
  ];
  const attackSet = new Set();
  for (const sweep of sweepPatterns) {
    for (const offset of sweep) {
      const nc = col + offset.dc;
      const nri = ri + offset.dr;
      if (nri < 0 || nri >= ROWS.length) continue;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) continue;
      const key = cellKey(nc, nr);
      const occupant = occupancy[key];
      if (occupant && occupant.owner !== owner) {
        attackSet.add(key);
      }
    }
  }
  for (const key of attackSet) {
    const [c, r] = key.split(',');
    attack.push({ col: parseInt(c), row: r });
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcSkeleton(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of LATERAL) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    if (!occupancy[key]) {
      movement.push({ col: nc, row: nr });
    }
  }
  for (const dir of DIAGONAL) {
    for (let step = 1; step <= 3; step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;
      const key = cellKey(nc, nr);
      const occupant = occupancy[key];
      if (occupant) {
        if (occupant.owner !== owner) {
          attack.push({ col: nc, row: nr });
        }
        break;
      }
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcBlaze(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of DIAGONAL) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    if (!occupancy[key]) {
      movement.push({ col: nc, row: nr });
    }
  }
  for (const dir of LATERAL) {
    for (let step = 1; step <= 2; step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;
      const key = cellKey(nc, nr);
      const occupant = occupancy[key];
      if (occupant) {
        if (occupant.owner !== owner) {
          attack.push({ col: nc, row: nr });
        }
        break;
      }
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcPhantom(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    for (let step = 1; step <= Math.max(COLS.length, ROWS.length); step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;
      if (!isDarkTile(nc, nr)) continue;
      const key = cellKey(nc, nr);
      const occupant = occupancy[key];
      if (occupant) {
        if (occupant.owner !== owner) {
          attack.push({ col: nc, row: nr });
        }
        break;
      } else {
        movement.push({ col: nc, row: nr });
      }
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcEnderman(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    const occupant = occupancy[key];
    if (occupant && occupant.owner !== owner) {
      attack.push({ col: nc, row: nr });
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcShulkerBox(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of LATERAL) {
    for (let step = 1; step <= Math.max(COLS.length, ROWS.length); step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;
      const key = cellKey(nc, nr);
      const occupant = occupancy[key];
      if (occupant) {
        if (occupant.owner !== owner) {
          attack.push({ col: nc, row: nr });
        }
        break;
      }
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

function calcWither(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    const key = cellKey(nc, nr);
    if (!occupancy[key]) {
      movement.push({ col: nc, row: nr });
    }
  }
  for (const dir of LATERAL) {
    for (let step = 1; step <= 3; step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;
      const key = cellKey(nc, nr);
      const occupant = occupancy[key];
      if (occupant) {
        attack.push({ col: nc, row: nr });
        break;
      }
    }
  }
  return { movementSquares: movement, attackSquares: attack };
}

export function calculateValidSquares(minionInstance, board) {
  const occupancy = buildOccupancyMap(board);
  const { type, owner, position } = minionInstance;
  const { col, row } = position;

  switch (type) {
    case 'villager':    return calcVillager(col, row, occupancy, owner);
    case 'zombie':      return calcZombie(col, row, occupancy, owner);
    case 'creeper':     return calcCreeper(col, row, occupancy, owner);
    case 'puffer_fish': return calcPufferFish(col, row, occupancy, owner);
    case 'iron_golem':  return calcIronGolem(col, row, occupancy, owner);
    case 'skeleton':    return calcSkeleton(col, row, occupancy, owner);
    case 'blaze':       return calcBlaze(col, row, occupancy, owner);
    case 'phantom':     return calcPhantom(col, row, occupancy, owner);
    case 'enderman':    return calcEnderman(col, row, occupancy, owner);
    case 'shulker_box': return calcShulkerBox(col, row, occupancy, owner);
    case 'wither':      return calcWither(col, row, occupancy, owner);
    default:            return { movementSquares: [], attackSquares: [] };
  }
}

export function getIronGolemSweepTargets(col, row, direction) {
  const ri = rowToIndex(row);
  const targets = [];
  let offsets;
  switch (direction) {
    case 'up':    offsets = [{ dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 }]; break;
    case 'down':  offsets = [{ dc: -1, dr: 1 }, { dc: 0, dr: 1 }, { dc: 1, dr: 1 }]; break;
    case 'left':  offsets = [{ dc: -1, dr: -1 }, { dc: -1, dr: 0 }, { dc: -1, dr: 1 }]; break;
    case 'right': offsets = [{ dc: 1, dr: -1 }, { dc: 1, dr: 0 }, { dc: 1, dr: 1 }]; break;
    default: return targets;
  }
  for (const offset of offsets) {
    const nc = col + offset.dc;
    const nri = ri + offset.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    targets.push({ col: nc, row: nr });
  }
  return targets;
}

export function getWitherSplashTargets(hitCol, hitRow) {
  const targets = [];
  const ri = rowToIndex(hitRow);
  for (const dir of LATERAL) {
    const nc = hitCol + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    targets.push({ col: nc, row: nr });
  }
  return targets;
}

export function getWitherSpawnExplosionTargets(col, row) {
  const targets = [];
  const ri = rowToIndex(row);
  for (const dir of ALL_8) {
    const nc = col + dir.dc;
    const nri = ri + dir.dr;
    if (nri < 0 || nri >= ROWS.length) continue;
    const nr = indexToRow(nri);
    if (!isValidCell(nc, nr)) continue;
    targets.push({ col: nc, row: nr });
  }
  return targets;
}

// ── Instance ID Generator ──
let instanceCounter = 0;
function generateInstanceId() {
  instanceCounter++;
  return `sp_minion_${instanceCounter}_${Date.now()}`;
}

// ── Game Engine Class ──
export class GameEngine {
  constructor() {
    this.board = new Map();
    this.minionInstances = new Map();
    this.currentTurn = 'host';
    this.turnNumber = 1;
    this.hostMana = 1;
    this.guestMana = 1;
    this.status = 'playing';
    this.hostDeck = [];
    this.guestDeck = [];
    this.hostHand = [];
    this.guestHand = [];
  }

  initializeGame(hostDeck, guestDeck, shuffleGuestDeck = true) {
    this.board = new Map();
    this.minionInstances = new Map();
    instanceCounter = 0;

    this.hostDeck = this.shuffleArray([...hostDeck]);
    this.guestDeck = shuffleGuestDeck ? this.shuffleArray([...guestDeck]) : [...guestDeck];
    this.hostHand = [];
    this.guestHand = [];

    this.placeVillagers();

    this.hostHand = this.hostDeck.splice(0, 3);
    this.guestHand = this.guestDeck.splice(0, 3);

    this.hostMana = 1;
    this.guestMana = 1;
    this.turnNumber = 1;
    this.currentTurn = 'host';
    this.status = 'playing';
  }

  placeVillagers() {
    const hostVillager = this.createMinionInstance('villager', 'host', 5, 'J');
    this.addToBoard(hostVillager);
    const guestVillager = this.createMinionInstance('villager', 'guest', 4, 'A');
    this.addToBoard(guestVillager);
  }

  createMinionInstance(minionType, owner, col, row) {
    const instance = {
      instanceId: generateInstanceId(),
      type: minionType,
      owner,
      position: { col, row },
      spawnedThisTurn: false,
      hasMovedThisTurn: false,
      hasAttackedThisTurn: false,
      hasUsedAbilityThisTurn: false,
    };
    return instance;
  }

  addToBoard(minionInstance) {
    const key = cellKey(minionInstance.position.col, minionInstance.position.row);
    this.board.set(key, minionInstance);
    this.minionInstances.set(minionInstance.instanceId, minionInstance);
  }

  removeMinion(instanceId) {
    const minion = this.minionInstances.get(instanceId);
    if (!minion) return null;
    const key = cellKey(minion.position.col, minion.position.row);
    this.board.delete(key);
    this.minionInstances.delete(instanceId);
    return minion;
  }

  removeMinionAt(col, row) {
    const key = cellKey(col, row);
    const minion = this.board.get(key);
    if (!minion) return null;
    this.board.delete(key);
    this.minionInstances.delete(minion.instanceId);
    return minion;
  }

  moveMinion(instanceId, newCol, newRow) {
    const minion = this.minionInstances.get(instanceId);
    if (!minion) return false;
    const oldKey = cellKey(minion.position.col, minion.position.row);
    this.board.delete(oldKey);
    minion.position.col = newCol;
    minion.position.row = newRow;
    const newKey = cellKey(newCol, newRow);
    this.board.set(newKey, minion);
    return true;
  }

  spawnMinion(playerRole, minionId, targetCol, targetRow) {
    const hand = playerRole === 'host' ? this.hostHand : this.guestHand;
    const mana = playerRole === 'host' ? this.hostMana : this.guestMana;
    const spawnRows = getSpawnRows(playerRole);

    const cardIndex = hand.indexOf(minionId);
    if (cardIndex === -1) return { success: false, error: 'Card not in hand' };

    const minionDef = MINION_TYPES[minionId];
    if (!minionDef) return { success: false, error: 'Invalid minion type' };

    if (mana < minionDef.cost) return { success: false, error: 'Not enough mana' };
    if (!spawnRows.includes(targetRow)) return { success: false, error: 'Not in spawn zone' };

    const key = cellKey(targetCol, targetRow);
    if (this.board.has(key)) return { success: false, error: 'Cell is occupied' };

    if (minionId === 'phantom' && !isDarkTile(targetCol, targetRow)) {
      return { success: false, error: 'Phantom can only spawn on dark tiles' };
    }

    if (playerRole === 'host') {
      this.hostMana -= minionDef.cost;
    } else {
      this.guestMana -= minionDef.cost;
    }

    hand.splice(cardIndex, 1);

    const instance = this.createMinionInstance(minionId, playerRole, targetCol, targetRow);
    instance.spawnedThisTurn = true;
    this.addToBoard(instance);

    let destroyedMinions = [];
    if (minionId === 'wither') {
      const explosionTargets = getWitherSpawnExplosionTargets(targetCol, targetRow);
      for (const target of explosionTargets) {
        const destroyed = this.removeMinionAt(target.col, target.row);
        if (destroyed) {
          destroyedMinions.push(destroyed);
        }
      }
    }

    return { success: true, instance, destroyedMinions };
  }

  resolveAttack(minion, targetCol, targetRow, playerRole, direction) {
    const { type, owner, position } = minion;
    const attackCost = getAttackManaCost(type);
    const mana = playerRole === 'host' ? this.hostMana : this.guestMana;

    if (mana < attackCost) return { success: false, error: 'Not enough mana' };
    if (minion.spawnedThisTurn) return { success: false, error: 'Spawned this turn' };
    if (minion.hasAttackedThisTurn) return { success: false, error: 'Already attacked' };
    if (minion.hasMovedThisTurn) return { success: false, error: 'Already moved' };

    if (playerRole === 'host') {
      this.hostMana -= attackCost;
    } else {
      this.guestMana -= attackCost;
    }

    let destroyedMinions = [];

    switch (type) {
      case 'creeper': {
        const occupancy = buildOccupancyMap(this.board);
        const ri = rowToIndex(position.row);
        for (const dir of ALL_8) {
          const nc = position.col + dir.dc;
          const nri = ri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = indexToRow(nri);
          if (!isValidCell(nc, nr)) continue;
          const destroyed = this.removeMinionAt(nc, nr);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        this.removeMinion(minion.instanceId);
        break;
      }
      case 'puffer_fish': {
        const ri = rowToIndex(position.row);
        for (const dir of DIAGONAL) {
          const nc = position.col + dir.dc;
          const nri = ri + dir.dr;
          if (nri < 0 || nri >= ROWS.length) continue;
          const nr = indexToRow(nri);
          if (!isValidCell(nc, nr)) continue;
          const destroyed = this.removeMinionAt(nc, nr);
          if (destroyed) destroyedMinions.push(destroyed);
        }
        break;
      }
      case 'iron_golem': {
        if (!direction) return { success: false, error: 'Direction required' };
        const targets = getIronGolemSweepTargets(position.col, position.row, direction);
        for (const target of targets) {
          const occupant = this.getMinionAt(target.col, target.row);
          if (occupant && occupant.owner !== playerRole) {
            const destroyed = this.removeMinionAt(target.col, target.row);
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
        const splashTargets = getWitherSplashTargets(targetCol, targetRow);
        for (const st of splashTargets) {
          const splashOccupant = this.getMinionAt(st.col, st.row);
          if (splashOccupant && splashOccupant.instanceId !== minion.instanceId) {
            const destroyed = this.removeMinionAt(st.col, st.row);
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
  }

  drawCards(playerRole, count) {
    const deck = playerRole === 'host' ? this.hostDeck : this.guestDeck;
    const hand = playerRole === 'host' ? this.hostHand : this.guestHand;
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (deck.length === 0) break;
      const card = deck.shift();
      hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  getMana(playerRole) {
    return playerRole === 'host' ? this.hostMana : this.guestMana;
  }

  deductMana(playerRole, amount) {
    if (playerRole === 'host') {
      this.hostMana -= amount;
    } else {
      this.guestMana -= amount;
    }
  }

  getPlayerHand(playerRole) {
    return playerRole === 'host' ? [...this.hostHand] : [...this.guestHand];
  }

  getPlayerHandCount(playerRole) {
    return playerRole === 'host' ? this.hostHand.length : this.guestHand.length;
  }

  getPlayerDeckCount(playerRole) {
    return playerRole === 'host' ? this.hostDeck.length : this.guestDeck.length;
  }

  getMinionInstance(instanceId) {
    return this.minionInstances.get(instanceId) || null;
  }

  getMinionAt(col, row) {
    const key = cellKey(col, row);
    return this.board.get(key) || null;
  }

  getBoardState() {
    const state = {};
    for (const [key, minion] of this.board) {
      state[key] = {
        instanceId: minion.instanceId,
        type: minion.type,
        owner: minion.owner,
        position: { ...minion.position },
        spawnedThisTurn: minion.spawnedThisTurn,
        hasMovedThisTurn: minion.hasMovedThisTurn,
        hasAttackedThisTurn: minion.hasAttackedThisTurn,
        hasUsedAbilityThisTurn: minion.hasUsedAbilityThisTurn,
      };
    }
    return state;
  }

  checkWinCondition() {
    let hostVillagerAlive = false;
    let guestVillagerAlive = false;
    for (const [, minion] of this.minionInstances) {
      if (minion.type === 'villager') {
        if (minion.owner === 'host') hostVillagerAlive = true;
        if (minion.owner === 'guest') guestVillagerAlive = true;
      }
    }
    if (!hostVillagerAlive) return 'guest';
    if (!guestVillagerAlive) return 'host';
    return null;
  }

  resetTurnFlags(playerRole) {
    for (const [, minion] of this.minionInstances) {
      if (minion.owner === playerRole) {
        minion.spawnedThisTurn = false;
        minion.hasMovedThisTurn = false;
        minion.hasAttackedThisTurn = false;
        minion.hasUsedAbilityThisTurn = false;
      }
    }
  }

  endTurn() {
    const previousTurn = this.currentTurn;
    this.currentTurn = previousTurn === 'host' ? 'guest' : 'host';

    if (previousTurn === 'guest') {
      this.turnNumber++;
    }

    const newTurn = this.currentTurn;
    const turnNumber = this.turnNumber;
    const maxMana = Math.min(turnNumber, 6);

    if (newTurn === 'host') {
      this.hostMana = maxMana;
    } else {
      this.guestMana = maxMana;
    }

    this.resetTurnFlags(newTurn);
    this.drawCards(newTurn, 1);

    return { newTurn, turnNumber };
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
