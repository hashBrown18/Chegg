/** TurnIndicator — top center: shows whose turn + turn number */
import './TurnIndicator.css'

export default function TurnIndicator({ currentTurn, yourRole, hostUsername, guestUsername, turnNumber }) {
  const activeUsername = currentTurn === 'host' ? hostUsername : guestUsername
  const isYourTurn = currentTurn === yourRole
  const activeColor = currentTurn === 'host' ? 'blue' : 'red'

  return (
    <div className="turn-indicator">
      <div className={`turn-dot dot-${activeColor}`} />
      <span className="turn-text font-label">
        {isYourTurn ? 'Your Turn' : `${activeUsername}'s Turn`}
      </span>
      <span className="turn-number font-mono">Turn {turnNumber}</span>
    </div>
  )
}
