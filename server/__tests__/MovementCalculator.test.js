// COUNCIL FIX: BUG 5 — Jest tests for MovementCalculator
const { calculateValidSquares } = require('../game/MovementCalculator');

function minion(type, col, row, owner = 'host') {
  return { type, owner, position: { col, row }, instanceId: `${type}_${col}_${row}` };
}

function board(entries) {
  const b = {};
  for (const m of entries) {
    b[`${m.position.col},${m.position.row}`] = m;
  }
  return b;
}

function sortSquares(arr) {
  return [...arr].sort((a, b) => a.col - b.col || a.row.localeCompare(b.row));
}

// Test 1: Zombie — forward movement only, lateral attacks
test('Zombie at (4,E) host: moves 3 forward squares, attacks 4 lateral', () => {
  const zombie = minion('zombie', 4, 'E', 'host');
  const result = calculateValidSquares(zombie, board([zombie]));

  expect(sortSquares(result.movementSquares)).toEqual(
    sortSquares([
      { col: 3, row: 'D' },
      { col: 4, row: 'D' },
      { col: 5, row: 'D' },
    ])
  );
  expect(result.attackSquares).toEqual([]);
});

// Test 2: Creeper — 8 surrounding movement, explosion attack with friendly fire
test('Creeper at (4,E) host: moves to empty 8-adjacent, attacks all occupied 8-adjacent', () => {
  const creeper = minion('creeper', 4, 'E', 'host');
  const enemy = minion('zombie', 5, 'D', 'guest');
  const friendly = minion('zombie', 3, 'D', 'host');
  const result = calculateValidSquares(creeper, board([creeper, enemy, friendly]));

  expect(sortSquares(result.movementSquares)).toEqual(
    sortSquares([
      { col: 4, row: 'D' },
      { col: 3, row: 'E' },
      { col: 5, row: 'E' },
      { col: 3, row: 'F' },
      { col: 4, row: 'F' },
      { col: 5, row: 'F' },
    ])
  );
  expect(sortSquares(result.attackSquares)).toEqual(
    sortSquares([
      { col: 5, row: 'D' },
      { col: 3, row: 'D' },
    ])
  );
});

// Test 3: Phantom — dark tiles only, blocked by any piece
test('Phantom at (1,A) host: only dark tiles reachable, enemy blocks path', () => {
  const phantom = minion('phantom', 1, 'A', 'host');
  const enemy = minion('zombie', 2, 'B', 'guest');
  const result = calculateValidSquares(phantom, board([phantom, enemy]));

  // From (1,A): dark tiles reachable in each direction (empty board except enemy at 2,B)
  // isDarkTile: (col + rowIndex) % 2 === 1, A=0,B=1,C=2,...
  // Down: (1,B) light→skip, (1,C) dark→move, (1,D) light→skip, (1,E) dark→move, (1,F) skip, (1,G) move, (1,H) skip, (1,I) move, (1,J) skip
  // Right: (2,A) light→skip, (3,A) dark→move, (4,A) skip, (5,A) move, (6,A) skip, (7,A) move, (8,A) skip
  // Down-right: (2,B) dark+enemy→attack, break
  expect(sortSquares(result.movementSquares)).toEqual(
    sortSquares([
      { col: 1, row: 'C' },
      { col: 1, row: 'E' },
      { col: 1, row: 'G' },
      { col: 1, row: 'I' },
      { col: 3, row: 'A' },
      { col: 5, row: 'A' },
      { col: 7, row: 'A' },
    ])
  );
  expect(result.attackSquares).toEqual([{ col: 2, row: 'B' }]);
});

// Test 4: Wither — 8 surrounding movement, lateral attack range 3
test('Wither at (4,E) host: moves 8 surrounding, attacks lateral up to range 3', () => {
  const wither = minion('wither', 4, 'E', 'host');
  const enemy = minion('zombie', 4, 'B', 'guest');
  const result = calculateValidSquares(wither, board([wither, enemy]));

  // Movement: all 8 surrounding empty squares
  expect(sortSquares(result.movementSquares)).toEqual(
    sortSquares([
      { col: 3, row: 'D' },
      { col: 4, row: 'D' },
      { col: 5, row: 'D' },
      { col: 3, row: 'E' },
      { col: 5, row: 'E' },
      { col: 3, row: 'F' },
      { col: 4, row: 'F' },
      { col: 5, row: 'F' },
    ])
  );

  // Attack: lateral range 3. Up direction: (4,D) empty, (4,C) empty, (4,B) enemy → hit, stop.
  expect(result.attackSquares).toEqual([{ col: 4, row: 'B' }]);
});

// Test 5: Enderman — no movement, 8 surrounding attack only
test('Enderman at (4,E) host: no movement, attacks enemy in 8-adjacent only', () => {
  const enderman = minion('enderman', 4, 'E', 'host');
  const enemy = minion('zombie', 5, 'D', 'guest');
  const friendly = minion('zombie', 3, 'F', 'host');
  const result = calculateValidSquares(enderman, board([enderman, enemy, friendly]));

  expect(result.movementSquares).toEqual([]);
  // Only enemy at (5,D) is attackable; friendly at (3,F) is not
  expect(result.attackSquares).toEqual([{ col: 5, row: 'D' }]);
});
