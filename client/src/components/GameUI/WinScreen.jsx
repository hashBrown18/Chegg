/**
 * WinScreen — chess.com inspired popup overlay
 *
 * rematchState: 'idle' | 'requested' | 'incoming' | 'blocked'
 */
import { useState } from 'react'
import BackgroundSVG from '../BackgroundSVG.jsx'
import './WinScreen.css'

export default function WinScreen({
  youWon = false,
  winnerUsername = '',
  onRematch,
  onLeave,
  rematchState = 'idle',
  incomingName = '',
  notice = '',
  onAcceptRematch,
  onDeclineRematch,
}) {
  const [dismissed, setDismissed] = useState(false)

  // A pending request from the opponent must always be visible.
  if (dismissed && rematchState !== 'incoming') return null

  return (
    <div className="win-screen">
      <BackgroundSVG />

      <div className="win-card">
        {/* X button to dismiss overlay */}
        {rematchState !== 'incoming' && (
          <button className="win-close-btn" onClick={() => setDismissed(true)} title="Review board">
            ✕
          </button>
        )}

        <div className="win-trophy">🏆</div>

        <p className="win-eyebrow">BATTLE CONCLUDED</p>

        <h1 className="win-title">
          {youWon ? 'You Win!' : `${winnerUsername} Wins!`}
        </h1>

        <p className={`win-result ${youWon ? 'win-victory' : 'win-defeat'}`}>
          {youWon ? 'Victory' : 'Defeat'}
        </p>

        <div className="win-divider" />

        {notice && <p className="win-notice">{notice}</p>}

        {rematchState === 'incoming' ? (
          <>
            <p className="win-request-text">{incomingName} wants a rematch</p>
            <button className="win-rematch-btn" onClick={onAcceptRematch}>
              Accept
            </button>
            <button className="win-leave-btn" onClick={onDeclineRematch}>
              Decline
            </button>
          </>
        ) : (
          <>
            {rematchState !== 'blocked' && (
              <button
                className="win-rematch-btn"
                onClick={onRematch}
                disabled={rematchState === 'requested'}
              >
                {rematchState === 'requested' ? 'Waiting for opponent...' : 'Rematch'}
              </button>
            )}

            <button className="win-leave-btn" onClick={onLeave}>
              ⇒ Leave
            </button>
          </>
        )}
      </div>
    </div>
  )
}