/**
 * MovementCalculator.js — Per-minion movement and attack square calculation
 * Each minion type has its own unique logic. No generic system.
 */

const {
  isValidCell, isDarkTile, rowToIndex, indexToRow,
  getForwardDirection, COLS, ROWS,
} = require('./MinionLogic');

// Direction helpers
const LATERAL = [
  { dc: 0, dr: -1 }, // up
  { dc: 0, dr: 1 },  // down
  { dc: -1, dr: 0 }, // left
  { dc: 1, dr: 0 },  // right
];

const DIAGONAL = [
  { dc: -1, dr: -1 }, // up-left
  { dc: 1, dr: -1 },  // up-right
  { dc: -1, dr: 1 },  // down-left
  { dc: 1, dr: 1 },   // down-right
];

const ALL_8 = [...LATERAL, ...DIAGONAL];

/**
 * Get cell key string from col and row
 */
function cellKey(col, row) {
  return `${col},${row}`;
}

/**
 * Get all minion instances on the board as a lookup map: "col,row" → minionInstance
 */
function buildOccupancyMap(boardState) {
  const map = {};
  if (boardState instanceof Map) {
    for (const [key, minion] of boardState) {
      map[key] = minion;
    }
  } else if (boardState && typeof boardState === 'object') {
    for (const [key, minion] of Object.entries(boardState)) {
      map[key] = minion;
    }
  }
  return map;
}

/**
 * Calculate valid squares in given directions with given range
 * @param {number} col - current column
 * @param {string} row - current row letter
 * @param {Array} directions - array of {dc, dr} direction vectors
 * @param {number} range - max range (1 for adjacent)
 * @param {Object} occupancy - occupancy map
 * @param {string} owner - 'host' or 'guest'
 * @param {boolean} isMovement - true for movement squares, false for attack
 * @param {boolean} blocked - whether line of sight matters (Shulker-Box)
 * @param {boolean} friendlyFire - whether attack can hit own minions
 */
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
        // Can't move to occupied square
        if (occupant) {
          if (blocked) break; // line of sight blocked
          continue;
        }
        squares.push({ col: nc, row: nr });
        // If blocked mode and empty, continue checking further
        if (!blocked) continue;
      } else {
        // Attack square
        if (blocked && occupant && occupant.owner === owner && !friendlyFire) {
          break; // blocked by own piece (Shulker-Box)
        }
        if (blocked && !occupant && step < range) {
          continue; // empty square on the way, keep going for Shulker-Box
        }

        if (occupant) {
          if (occupant.owner !== owner || friendlyFire) {
            squares.push({ col: nc, row: nr });
          }
          if (blocked) break; // hit something, stop
        } else if (!blocked) {
          // For non-blocked ranged attacks, still can't attack empty
          // (except Creeper/Puffer-Fish area effects handled separately)
        }

        if (blocked && !occupant) {
          // Keep going for Shulker-Box
          continue;
        }
      }
    }
  }

  return squares;
}

// ============================================================
// Individual minion calculators
// ============================================================

/**
 * VILLAGER — King
 * Movement: 8 surrounding (costs 1 mana, no free move)
 * Attack: 8 surrounding, moves to attack square
 */
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

/**
 * ZOMBIE
 * Movement: 3 forward squares only (forward-left, forward, forward-right)
 * Attack: 4 lateral squares (up, down, left, right)
 */
function calcZombie(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);
  const fwd = getForwardDirection(owner);

  // Movement: 3 forward squares
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

  // Attack: 4 lateral squares
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

/**
 * CREEPER
 * Movement: 8 surrounding
 * Attack: 8 surrounding — EXPLOSION destroys ALL. Friendly fire ON. Self-destructs.
 */
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

  // Creeper attack: all 8 surrounding with any occupant (enemy or friendly)
  // The attack is an explosion — show red on any occupied surrounding square
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

/**
 * PUFFER-FISH
 * Movement: 4 lateral (up, down, left, right)
 * Attack: 4 diagonal simultaneously. Friendly fire ON.
 */
function calcPufferFish(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);

  // Movement: lateral
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

  // Attack: 4 diagonal squares (all hit simultaneously)
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

/**
 * IRON GOLEM
 * Movement: 8 surrounding
 * Attack: Sweeping 3 tiles in a chosen lateral direction
 * For highlights: show all possible attack targets (enemies in any sweepable pattern)
 */
function calcIronGolem(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);

  // Movement: 8 surrounding
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

  // Attack: sweeping — for each lateral direction, the 3-tile sweep pattern
  // Direction UP: hit (col-1, row-1), (col, row-1), (col+1, row-1)
  // Direction DOWN: hit (col-1, row+1), (col, row+1), (col+1, row+1)
  // Direction LEFT: hit (col-1, row-1), (col-1, row), (col-1, row+1)
  // Direction RIGHT: hit (col+1, row-1), (col+1, row), (col+1, row+1)
  const sweepPatterns = [
    // UP sweep: row above, 3 cols
    [{ dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 }],
    // DOWN sweep: row below, 3 cols
    [{ dc: -1, dr: 1 }, { dc: 0, dr: 1 }, { dc: 1, dr: 1 }],
    // LEFT sweep: col left, 3 rows
    [{ dc: -1, dr: -1 }, { dc: -1, dr: 0 }, { dc: -1, dr: 1 }],
    // RIGHT sweep: col right, 3 rows
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

/**
 * Get Iron Golem sweep targets for a specific direction
 */
function getIronGolemSweepTargets(col, row, direction) {
  const ri = rowToIndex(row);
  const targets = [];

  let offsets;
  switch (direction) {
    case 'up':
      offsets = [{ dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 }];
      break;
    case 'down':
      offsets = [{ dc: -1, dr: 1 }, { dc: 0, dr: 1 }, { dc: 1, dr: 1 }];
      break;
    case 'left':
      offsets = [{ dc: -1, dr: -1 }, { dc: -1, dr: 0 }, { dc: -1, dr: 1 }];
      break;
    case 'right':
      offsets = [{ dc: 1, dr: -1 }, { dc: 1, dr: 0 }, { dc: 1, dr: 1 }];
      break;
    default:
      return targets;
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

/**
 * SKELETON
 * Movement: 4 lateral (up, down, left, right)
 * Attack: 4 diagonal, range 3
 */
function calcSkeleton(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);

  // Movement: lateral
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

  // Attack: diagonal, range 3
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
        break; // blocked by any piece
      }
    }
  }

  return { movementSquares: movement, attackSquares: attack };
}

/**
 * BLAZE
 * Movement: 4 diagonal
 * Attack: 4 lateral, range 2
 */
function calcBlaze(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);

  // Movement: diagonal
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

  // Attack: lateral, range 2
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
        break; // blocked
      }
    }
  }

  return { movementSquares: movement, attackSquares: attack };
}

/**
 * PHANTOM
 * Movement: dark tiles only, any range, blocked by pieces
 * Attack: same as movement (dark tiles only)
 * Can ONLY spawn on dark tiles
 */
function calcPhantom(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);

  // Phantom moves on dark tiles in all 8 directions
  for (const dir of ALL_8) {
    for (let step = 1; step <= Math.max(COLS.length, ROWS.length); step++) {
      const nc = col + dir.dc * step;
      const nri = ri + dir.dr * step;
      if (nri < 0 || nri >= ROWS.length) break;
      const nr = indexToRow(nri);
      if (!isValidCell(nc, nr)) break;
      if (!isDarkTile(nc, nr)) continue; // skip light tiles but keep going

      const key = cellKey(nc, nr);
      const occupant = occupancy[key];

      if (occupant) {
        if (occupant.owner !== owner) {
          attack.push({ col: nc, row: nr });
        }
        break; // blocked by any minion
      } else {
        movement.push({ col: nc, row: nr });
      }
    }
  }

  return { movementSquares: movement, attackSquares: attack };
}

/**
 * ENDERMAN
 * Movement: NONE (cannot move normally)
 * Attack: 8 surrounding
 * Special: Teleport (handled separately) — swap with any minion in lateral direction
 */
function calcEnderman(col, row, occupancy, owner) {
  const movement = []; // no movement
  const attack = [];
  const ri = rowToIndex(row);

  // Attack: 8 surrounding
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

/**
 * Get Enderman teleport targets — any minion (friendly or enemy) in lateral direction,
 * any distance. Cannot target Villager.
 */
function calcEndermanTeleportTargets(col, row, occupancy) {
  const targets = [];
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
        // Cannot target Villager
        if (occupant.type !== 'villager') {
          targets.push({ col: nc, row: nr });
        }
        // Don't break — Enderman teleport goes through pieces? 
        // Spec says "in any lateral direction regardless of distance"
        // Not clear if blocked. Playing safe: not blocked.
      }
    }
  }

  return targets;
}

/**
 * SHULKER-BOX
 * Movement: NONE freely. Moves ONLY to position of eliminated minion (handled in attack resolution)
 * Attack: Long range lateral, BLOCKED by any minion in the path
 */
function calcShulkerBox(col, row, occupancy, owner) {
  const movement = []; // no free movement
  const attack = [];
  const ri = rowToIndex(row);

  // Attack: lateral, long range, blocked
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
        break; // blocked by any piece (even own)
      }
    }
  }

  return { movementSquares: movement, attackSquares: attack };
}

/**
 * WITHER
 * Movement: 8 surrounding
 * Attack: Lateral projectile range 3, hits target + 4 surrounding tiles (splash)
 * ON SPAWN: destroys everything in 8 surrounding (handled in spawn logic)
 */
function calcWither(col, row, occupancy, owner) {
  const movement = [];
  const attack = [];
  const ri = rowToIndex(row);

  // Movement: 8 surrounding
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

  // Attack: lateral, range 3, blocked
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
        // Wither can hit enemy and friendly (friendly fire ON)
        attack.push({ col: nc, row: nr });
        break; // projectile stops on hit
      }
    }
  }

  return { movementSquares: movement, attackSquares: attack };
}

/**
 * Get Wither splash damage targets — 4 lateral tiles around the hit square
 */
function getWitherSplashTargets(hitCol, hitRow) {
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

/**
 * Get Wither spawn explosion targets — 8 surrounding tiles
 */
function getWitherSpawnExplosionTargets(col, row) {
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

// ============================================================
// Main calculator dispatcher
// ============================================================

/**
 * Calculate valid movement and attack squares for a given minion instance
 * @param {Object} minionInstance - the minion on the board
 * @param {Object|Map} boardState - the full board state
 * @returns {{ movementSquares: Array, attackSquares: Array }}
 */
function calculateValidSquares(minionInstance, boardState) {
  const occupancy = buildOccupancyMap(boardState);
  const { type, owner, position } = minionInstance;
  const { col, row } = position;

  switch (type) {
    case 'villager': return calcVillager(col, row, occupancy, owner);
    case 'zombie': return calcZombie(col, row, occupancy, owner);
    case 'creeper': return calcCreeper(col, row, occupancy, owner);
    case 'puffer_fish': return calcPufferFish(col, row, occupancy, owner);
    case 'iron_golem': return calcIronGolem(col, row, occupancy, owner);
    case 'skeleton': return calcSkeleton(col, row, occupancy, owner);
    case 'blaze': return calcBlaze(col, row, occupancy, owner);
    case 'phantom': return calcPhantom(col, row, occupancy, owner);
    case 'enderman': return calcEnderman(col, row, occupancy, owner);
    case 'shulker_box': return calcShulkerBox(col, row, occupancy, owner);
    case 'wither': return calcWither(col, row, occupancy, owner);
    default:
      return { movementSquares: [], attackSquares: [] };
  }
}

module.exports = {
  calculateValidSquares,
  buildOccupancyMap,
  cellKey,
  calcEndermanTeleportTargets,
  getIronGolemSweepTargets,
  getWitherSplashTargets,
  getWitherSpawnExplosionTargets,
};
