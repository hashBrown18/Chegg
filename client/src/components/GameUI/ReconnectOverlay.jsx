/**
 * ReconnectOverlay — shown to the LOCAL player when their socket disconnects mid-game.
 *
 * Behaviour:
 *  - Immediately tries to reconnect the socket every ~3 seconds (up to 10 attempts)
 *  - On socket 'connect', emits 'rejoin_game' with stored credentials
 *  - On success ('game_start' with isReconnection) the parent clears this overlay
 *  - On 'error_message' or exhausted retries, shows a hard-fail state with a Leave button
 */
import { useEffect, useRef, useState } from 'react'
import socket from '../../socket.js'
import './ReconnectOverlay.css'

const MAX_RETRIES   = 10
const RETRY_DELAY   = 3000   // ms between socket reconnect attempts
const DISPLAY_DELAY = 1500   // ms after disconnect before showing overlay (avoids flash)

export default function ReconnectOverlay({ onGiveUp }) {
  const [retries, setRetries]   = useState(0)
  const [phase, setPhase]       = useState('connecting') // 'connecting' | 'failed'
  const [errorMsg, setErrorMsg] = useState('')
  const [visible, setVisible]   = useState(false)
  const retryTimerRef           = useRef(null)
  const retriesRef              = useRef(0)

  // Delay showing the overlay slightly to avoid a flash on transient drops
  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), DISPLAY_DELAY)
    return () => clearTimeout(showTimer)
  }, [])

  // ── Core reconnection loop ──
  useEffect(() => {
    function attemptReconnect() {
      if (retriesRef.current >= MAX_RETRIES) {
        setPhase('failed')
        return
      }

      retriesRef.current += 1
      setRetries(retriesRef.current)

      // If socket is somehow already connected, jump straight to emitting
      if (socket.connected) {
        emitReconnectAttempt()
      } else {
        socket.connect()
      }
    }

    function emitReconnectAttempt() {
      try {
        const raw = sessionStorage.getItem('chegg_game_data')
        if (!raw) { setPhase('failed'); setErrorMsg('No session data found.'); return }
        const { hostUsername, guestUsername, yourRole } = JSON.parse(raw)
        const username = yourRole === 'host' ? hostUsername : guestUsername

        // roomCode is stored in localStorage by LobbyPage
        const roomCode = localStorage.getItem('chegg_room_code')
        const playerId = localStorage.getItem('chegg_player_id')
        if (!roomCode) {
          setPhase('failed')
          setErrorMsg('Session credentials missing.')
          return
        }

        socket.emit('rejoin_game', { roomCode, playerId, username })
      } catch {
        setPhase('failed')
        setErrorMsg('Could not read session data.')
      }
    }

    function onConnect() {
      emitReconnectAttempt()
    }

    function onError(err) {
      // Connection attempt failed — schedule another try
      scheduleRetry()
    }

    function onErrorMessage({ message }) {
      setPhase('failed')
      setErrorMsg(message || 'Reconnection rejected by server.')
    }

    function scheduleRetry() {
      retryTimerRef.current = setTimeout(attemptReconnect, RETRY_DELAY)
    }

    socket.on('connect',       onConnect)
    socket.on('connect_error', onError)
    socket.on('error_message', onErrorMessage)

    // Kick off the first attempt immediately
    attemptReconnect()

    return () => {
      clearTimeout(retryTimerRef.current)
      socket.off('connect',       onConnect)
      socket.off('connect_error', onError)
      socket.off('error_message', onErrorMessage)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return (
    <div className="reconnect-overlay" role="dialog" aria-modal="true" aria-label="Reconnecting">
      <div className={`reconnect-card ${phase === 'failed' ? 'reconnect-card--failed' : ''}`}>

        {phase === 'connecting' ? (
          <>
            {/* Pulsing signal ring */}
            <div className="reconnect-ring" aria-hidden="true">
              <div className="reconnect-ring__inner" />
            </div>

            <h2 className="reconnect-title font-display">Connection Lost</h2>
            <p className="reconnect-sub font-body">
              Attempting to reconnect…
            </p>

            <div className="reconnect-attempt-row">
              <span className="reconnect-dots" aria-hidden="true">
                <span /><span /><span />
              </span>
              <span className="reconnect-attempt-count font-mono">
                Attempt {retries}/{MAX_RETRIES}
              </span>
            </div>

            <p className="reconnect-hint font-body">
              Your game session is being held for 60 seconds.
            </p>

            <button
              id="btn-reconnect-give-up"
              className="btn btn-ghost reconnect-give-up-btn"
              onClick={onGiveUp}
            >
              Leave Game
            </button>
          </>
        ) : (
          <>
            {/* Hard-fail state */}
            <div className="reconnect-fail-icon" aria-hidden="true">⚡</div>
            <h2 className="reconnect-title font-display">Reconnection Failed</h2>
            <p className="reconnect-sub font-body">
              {errorMsg || 'Unable to rejoin the session.'}
            </p>
            <button
              id="btn-reconnect-leave"
              className="btn btn-primary reconnect-leave-btn"
              onClick={onGiveUp}
            >
              Return to Lobby
            </button>
          </>
        )}
      </div>
    </div>
  )
}
