/**
 * MinionLogic.js — Minion type definitions and constants
 * All 11 minion types with their properties
 */

const MINION_TYPES = {
  VILLAGER: {
    id: 'villager',
    name: 'Villager',
    cost: 0, // FREE — placed at game start, not in deck
    isKing: true,
  },
  ZOMBIE: {
    id: 'zombie',
    name: 'Zombie',
    cost: 1,
  },
  CREEPER: {
    id: 'creeper',
    name: 'Creeper',
    cost: 1,
    friendlyFire: true,
  },
  PUFFER_FISH: {
    id: 'puffer_fish',
    name: 'Puffer-Fish',
    cost: 2,
    friendlyFire: true,
  },
  IRON_GOLEM: {
    id: 'iron_golem',
    name: 'Iron Golem',
    cost: 2,
  },
  SKELETON: {
    id: 'skeleton',
    name: 'Skeleton',
    cost: 3,
  },
  BLAZE: {
    id: 'blaze',
    name: 'Blaze',
    cost: 3,
  },
  PHANTOM: {
    id: 'phantom',
    name: 'Phantom',
    cost: 3,
  },
  ENDERMAN: {
    id: 'enderman',
    name: 'Enderman',
    cost: 4,
  },
  SHULKER_BOX: {
    id: 'shulker_box',
    name: 'Shulker-Box',
    cost: 4,
  },
  WITHER: {
    id: 'wither',
    name: 'Wither',
    cost: 6,
    friendlyFire: true,
    attackManaCost: 2, // Wither attack costs 2 mana instead of 1
  },
};

// Map from minion id string to type definition
const MINION_BY_ID = {};
for (const key of Object.keys(MINION_TYPES)) {
  const m = MINION_TYPES[key];
  MINION_BY_ID[m.id] = m;
}

// Board constants
const COLS = [1, 2, 3, 4, 5, 6, 7, 8];
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROW_INDEX = {};
ROWS.forEach((r, i) => { ROW_INDEX[r] = i; });

// Spawn zones
const HOST_SPAWN_ROWS = ['I', 'J'];   // Bottom for host (Blue)
const GUEST_SPAWN_ROWS = ['A', 'B'];  // Top for guest (Red) — but guest sees flipped

/**
 * Check if a cell is a dark tile on the checkerboard
 * Standard checkerboard: (col + rowIndex) % 2 determines color
 */
function isDarkTile(col, row) {
  return (col + ROW_INDEX[row]) % 2 === 1;
}

/**
 * Check if cell is within board bounds
 */
function isValidCell(col, row) {
  return COLS.includes(col) && ROWS.includes(row);
}

/**
 * Convert row letter to index and back
 */
function rowToIndex(row) {
  return ROW_INDEX[row];
}

function indexToRow(index) {
  return ROWS[index];
}

/**
 * Get the "forward" direction for a player
 * Host (Blue) is at bottom (rows I,J) — forward is UP (decreasing row index)
 * Guest (Red) is at top (rows A,B) — forward is DOWN (increasing row index)
 */
function getForwardDirection(owner) {
  return owner === 'host' ? -1 : 1;
}

/**
 * Get attack mana cost for a minion type
 */
function getAttackManaCost(minionType) {
  if (minionType === 'wither') return 2;
  return 1;
}

/**
 * Get the spawn rows for a player
 */
function getSpawnRows(playerRole) {
  return playerRole === 'host' ? HOST_SPAWN_ROWS : GUEST_SPAWN_ROWS;
}

module.exports = {
  MINION_TYPES,
  MINION_BY_ID,
  COLS,
  ROWS,
  ROW_INDEX,
  HOST_SPAWN_ROWS,
  GUEST_SPAWN_ROWS,
  isDarkTile,
  isValidCell,
  rowToIndex,
  indexToRow,
  getForwardDirection,
  getAttackManaCost,
  getSpawnRows,
};
