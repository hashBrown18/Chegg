/**
 * OpponentDisconnectBanner
 *
 * Shown to the player whose OPPONENT has disconnected.
 * Counts down from timeoutSeconds. Dismissed when opponent reconnects
 * or the game ends with abandon_win.
 */
import { useEffect, useState } from 'react'
import './OpponentDisconnectBanner.css'

export default function OpponentDisconnectBanner({ message, timeoutSeconds = 60 }) {
  const [secs, setSecs] = useState(timeoutSeconds)

  // Reset and restart whenever a new disconnection event arrives
  useEffect(() => {
    setSecs(timeoutSeconds)
  }, [timeoutSeconds, message])

  useEffect(() => {
    if (secs <= 0) return
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secs])

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
