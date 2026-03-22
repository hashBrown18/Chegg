/**
 * WinScreen — chess.com inspired popup overlay
 */
import { useState } from 'react'
import BackgroundSVG from '../BackgroundSVG.jsx'
import './WinScreen.css'

export default function WinScreen({ winnerUsername, yourUsername, onLeave }) {
  const youWon = winnerUsername === yourUsername
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="win-screen">
      <BackgroundSVG />

      <div className="win-card">
        {/* X button to dismiss overlay */}
        <button className="win-close-btn" onClick={() => setDismissed(true)} title="Review board">
          ✕
        </button>

        <div className="win-trophy">🏆</div>

        <p className="win-eyebrow">BATTLE CONCLUDED</p>

        <h1 className="win-title">
          {winnerUsername} Wins!
        </h1>

        <p className={`win-result ${youWon ? 'win-victory' : 'win-defeat'}`}>
          {youWon ? 'Victory' : 'Defeat'}
        </p>

        <div className="win-divider" />

        <button className="win-leave-btn" onClick={onLeave}>
          ⇒ Leave
        </button>
      </div>
    </div>
  )
}