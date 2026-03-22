/**
 * Board.jsx — 8x10 CHEGG checkerboard with minion pieces, highlights, and labels
 *
 * Board spec:
 *  - 8 columns labeled 1-8 left to right
 *  - 10 rows labeled A-J top to bottom
 *  - Alternating dark/light squares
 *  - Blue spawn zone: rows A,B (tinted blue)
 *  - Red spawn zone: rows I,J (tinted red)
 *  - Player 2 (guest) sees board FLIPPED 180°
 */
import MinionPiece from './MinionPiece.jsx'
import './Board.css'

const COLS = [1, 2, 3, 4, 5, 6, 7, 8]
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

// For Player 2 (guest), board is flipped
const COLS_FLIPPED = [...COLS].reverse()
const ROWS_FLIPPED = [...ROWS].reverse()

function isDarkTile(col, rowIndex) {
  return (col + rowIndex) % 2 === 1
}

function getSpawnZone(rowLetter) {
  if (['A', 'B'].includes(rowLetter)) return 'guest' // guest spawn = rows A,B = top
  if (['I', 'J'].includes(rowLetter)) return 'host'  // host spawn = rows I,J = bottom
  return null
}

export default function Board({
  boardState,          // { "col,row": minionInstance }
  yourRole,            // 'host' | 'guest'
  highlights,          // { minionInstanceId, movementSquares, attackSquares, abilitySquares }
  selectedMinion,      // minionInstance | null (currently selected piece)
  onCellClick,         // (col, row, occupant) => void
  currentTurn,
}) {
  // Player 2 sees the board flipped 180°
  const isFlipped = yourRole === 'guest'
  const displayCols = isFlipped ? COLS_FLIPPED : COLS
  const displayRows = isFlipped ? ROWS_FLIPPED : ROWS

  function getCellHighlight(col, row) {
    if (!highlights) return null
    const key = `${col},${row}`
    if (highlights.movementSquares?.some(sq => sq.col === col && sq.row === row)) return 'move'
    if (highlights.attackSquares?.some(sq => sq.col === col && sq.row === row)) return 'attack'
    if (highlights.abilitySquares?.some(sq => sq.col === col && sq.row === row)) return 'ability'
    return null
  }

  return (
    <div className={`board-container ${isFlipped ? 'board-flipped' : ''}`}>
      {/* Column headers */}
      <div className="board-col-headers">
        <div className="board-corner" /> {/* empty corner above row labels */}
        {displayCols.map(col => (
          <div key={col} className="board-col-label font-mono">{col}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="board-rows">
        {displayRows.map((row, rowDisplayIdx) => {
          const rowIndex = ROWS.indexOf(row) // 0-9
          const spawnZone = getSpawnZone(row)

          return (
            <div key={row} className="board-row">
              {/* Row label */}
              <div className="board-row-label font-mono">{row}</div>

              {/* Cells */}
              {displayCols.map(col => {
                const dark = isDarkTile(col, rowIndex)
                const cellKey = `${col},${row}`
                const occupant = boardState?.[cellKey] || null
                const highlight = getCellHighlight(col, row)
                const isSelected = selectedMinion?.position?.col === col && selectedMinion?.position?.row === row

                return (
                  <div
                    key={cellKey}
                    id={`cell-${col}-${row}`}
                    className={[
                      'board-cell',
                      dark ? 'dark' : 'light',
                      spawnZone === 'host' ? 'spawn-host' : '',
                      spawnZone === 'guest' ? 'spawn-guest' : '',
                      highlight ? `highlight-${highlight}` : '',
                      isSelected ? 'cell-selected' : '',
                      (highlight === 'move' || highlight === 'attack' || highlight === 'ability') ? 'cell-clickable' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onCellClick(col, row, occupant)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Cell ${col}${row}${occupant ? `, ${occupant.type}` : ''}`}
                    onKeyDown={e => e.key === 'Enter' && onCellClick(col, row, occupant)}
                  >
                    {occupant && (
                      <MinionPiece
                        minion={occupant}
                        isSelected={isSelected}
                        yourRole={yourRole}
                        isYourTurn={currentTurn === yourRole}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
