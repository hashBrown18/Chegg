/**
 * OpponentDisconnectBanner
 *
 * Shown to the player whose OPPONENT has disconnected.
 * The countdown is rendered from the server-provided remainingMs, converted to
 * an endTime using performance.now() so it cannot drift from the server's
 * forfeit clock due to clock skew. Removed when the opponent reconnects
 * or the game finishes.
 */
import { useEffect, useState } from 'react'
import './OpponentDisconnectBanner.css'

function secondsLeft(endTime) {
  if (!endTime) return 0
  return Math.max(0, Math.ceil((endTime - performance.now()) / 1000))
}

export default function OpponentDisconnectBanner({ message, endTime }) {
  const [secs, setSecs] = useState(() => secondsLeft(endTime))

  useEffect(() => {
    const tick = () => setSecs(secondsLeft(endTime))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [endTime])

  // Urgency colour: red when ≤10s remain
  const urgent = secs <= 10

  return (
    <div className="opp-disconnect-overlay" role="status" aria-live="polite">
      <div className={`opp-disconnect-card ${urgent ? 'opp-disconnect-card--urgent' : ''}`}>
        <div className="opp-disconnect-icon" aria-hidden="true">
          {urgent ? '⚡' : '⏳'}
        </div>

        <div className="opp-disconnect-body">
          <p className="opp-disconnect-msg font-body">
            {message || 'Opponent disconnected. Waiting for reconnection…'}
          </p>
          <p className="opp-disconnect-hint font-label">
            Game continues if they reconnect in time
          </p>
        </div>

        <div className={`opp-disconnect-timer ${urgent ? 'opp-disconnect-timer--urgent' : ''}`}>
          <span className="opp-timer-count font-mono">{secs}</span>
          <span className="opp-timer-unit font-label">sec</span>
        </div>
      </div>
    </div>
  )
}