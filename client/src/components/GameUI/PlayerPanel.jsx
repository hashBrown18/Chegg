/**
 * PlayerPanel — shows player name, mana dots (6 max), deck count, hand count
 * Used for both left (opponent in host view) and right (your) panels
 */
import './PlayerPanel.css'

export default function PlayerPanel({ username, mana, maxMana, deckCount, handCount, isActive, side }) {
  // side: 'left' | 'right'
  const isHost = side === 'left' // host is on left for host player; reversed for guest
  const dotColor = isHost ? 'blue' : 'red'

  return (
    <div className={`player-panel ${isActive ? 'panel-active' : ''} panel-${dotColor}`}>
      {/* Player name */}
      <div className="panel-name-row">
        <span className={`panel-dot dot-${dotColor}`} />
        <span className="panel-username font-display">{username || '...'}</span>
      </div>

      {/* Mana */}
      <div className="panel-mana-section">
        <span className="panel-label font-label">Mana</span>
        <div className="panel-mana-dots">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`mana-dot ${i < mana ? 'filled' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <span className="panel-mana-fraction font-mono">{mana}/{maxMana}</span>
      </div>

      {/* Counts */}
      <div className="panel-counts">
        <div className="panel-count-item">
          <span className="panel-count-icon">🃏</span>
          <span className="panel-count-label font-label">Deck</span>
          <span className="panel-count-val font-mono">{deckCount ?? '—'}</span>
        </div>
        <div className="panel-count-item">
          <span className="panel-count-icon">✋</span>
          <span className="panel-count-label font-label">Hand</span>
          <span className="panel-count-val font-mono">{handCount ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}
