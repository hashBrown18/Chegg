/**
 * TurnIndicator — top-center pill showing whose turn it is.
 *
 * Visual states:
 *   yours  + ti-blue  → "YOUR TURN"    pulsing blue glow + shimmer text
 *   yours  + ti-red   → "YOUR TURN"    pulsing red  glow + shimmer text
 *   theirs + ti-blue  → "ALEX'S TURN"  dimmed blue tint
 *   theirs + ti-red   → "ALEX'S TURN"  dimmed red  tint
 *
 * No game logic — all props are passed in from GamePage.
 */
import './TurnIndicator.css'

export default function TurnIndicator({
  currentTurn,
  yourRole,
  hostUsername,
  guestUsername,
  turnNumber,
}) {
  const activeUsername = currentTurn === 'host' ? hostUsername : guestUsername
  const isYourTurn   = currentTurn === yourRole
  const colorClass   = currentTurn === 'host' ? 'ti-blue' : 'ti-red'
  const stateClass   = isYourTurn ? 'yours' : 'theirs'

  const labelText  = isYourTurn ? 'YOUR TURN' : `${activeUsername}'s Turn`
  const phaseText  = isYourTurn ? 'Active' : 'Waiting'

  return (
    <div
      className={`turn-indicator ${stateClass} ${colorClass}`}
      role="status"
      aria-live="polite"
      aria-label={labelText}
      /*
        Key on `currentTurn` so React unmounts+remounts the component
        each turn change, re-triggering the tiSlideIn animation.
      */
      key={currentTurn}
    >
      {/* Coloured pulsing dot */}
      <div className="ti-dot" aria-hidden="true" />

      {/* Text block */}
      <div className="ti-body">
        <span className="ti-label font-label">{labelText}</span>
        <span className="ti-turn-num">Turn {turnNumber}</span>
      </div>

      {/* Separator + phase badge */}
      <div className="ti-sep" aria-hidden="true" />
      <span className="ti-phase font-label">{phaseText}</span>
    </div>
  )
}
