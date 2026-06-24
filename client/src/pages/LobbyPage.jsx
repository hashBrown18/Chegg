import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket.js'
import { getOrCreatePlayerId } from '../playerId.js'
import BackgroundPaths from '../components/Lobby/BackgroundPaths.jsx'
import LiquidGlassCard from '../components/ui/LiquidGlassCard.jsx'
import Loader from '../components/ui/Loader.jsx'
import './LobbyPage.css'

/**
 * LobbyPage — handles both Create Room (/create) and Join Room (/join)
 * Mode prop: 'create' | 'join'
 */
export default function LobbyPage({ mode }) {
  const navigate = useNavigate()
  const isCreate = mode === 'create'

  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem('chegg_username') || '' } catch { return '' }
  })
  const [roomCode, setRoomCode] = useState(() => {
    // Prefill from a /join/:roomId redirect, if present
    try {
      const pre = sessionStorage.getItem('chegg_prefill_room_code')
      if (pre) {
        sessionStorage.removeItem('chegg_prefill_room_code')
        return pre.toLowerCase()
      }
    } catch {}
    return ''
  })
  const [error, setError] = useState('')
  const [status, setStatus] = useState('') // waiting message
  const [generatedCode, setGeneratedCode] = useState('') // after room is created
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(socket.connected)

  // Ref to hold latest username so socket callbacks don't depend on username state
  const usernameRef = useRef(username)
  useEffect(() => { usernameRef.current = username }, [username])

  useEffect(() => {
    // Connect socket when page mounts
    if (!socket.connected) {
      setStatus('Connecting to server...')
      socket.connect()
    }

    // ── CONNECTION lifecycle ──
    const onConnect = () => {
      console.log('[CHEGG] Socket connected:', socket.id)
      setConnected(true)
      setStatus('')
      setError('')
    }

    const onConnectError = (err) => {
      console.error('[CHEGG] Socket connection error:', err.message)
      setConnected(false)
      setLoading(false)
      setError('Cannot connect to server — is the backend running on port 3001?')
      setStatus('')
    }

    const onDisconnect = (reason) => {
      console.warn('[CHEGG] Socket disconnected:', reason)
      setConnected(false)
      setLoading(false)
      setStatus('')
    }

    socket.on('connect', onConnect)
    socket.on('connect_error', onConnectError)
    socket.on('disconnect', onDisconnect)

    // ── CREATE ROOM listeners ──
    socket.on('room_created', ({ roomCode, hostToken, guestLink }) => {
      const finalCode = (roomCode || '').toLowerCase()
      localStorage.setItem('chegg_room_code', finalCode)   // persist for reconnection
      localStorage.setItem('chegg_username', usernameRef.current.trim())
      localStorage.setItem('chegg_player_id', getOrCreatePlayerId())
      // Store tokens for URL-based reconnection
      sessionStorage.setItem('chegg_player_token', hostToken)
      sessionStorage.setItem('chegg_host_token', hostToken)
      // Store the pre-built guest join link (host never sees raw guestToken)
      if (guestLink) {
        sessionStorage.setItem('chegg_guest_link', guestLink)
      }
      setGeneratedCode(finalCode)
      setStatus('Waiting for opponent...')
      setLoading(false)
    })

    socket.on('opponent_joined', ({ opponentUsername }) => {
      setStatus(`${opponentUsername} has joined! Heading to deck builder...`)
      // Both navigate to deck builder
      setTimeout(() => navigate('/deck'), 800)
    })

    // ── JOIN ROOM listeners ──
    socket.on('room_joined', ({ roomCode, opponentUsername, guestToken }) => {
      const finalCode = (roomCode || '').toLowerCase()
      localStorage.setItem('chegg_room_code', finalCode)   // persist for reconnection
      localStorage.setItem('chegg_username', usernameRef.current.trim())
      localStorage.setItem('chegg_player_id', getOrCreatePlayerId())
      // Store token for URL-based reconnection
      if (guestToken) {
        sessionStorage.setItem('chegg_player_token', guestToken)
      }
      setStatus(`Joining room ${finalCode}... Heading to deck builder!`)
      setTimeout(() => navigate('/deck'), 600)
    })

    socket.on('error_message', ({ message }) => {
      setError(message)
      setStatus('')
      setLoading(false)
    })

    // If socket is already connected (e.g. navigated back), sync state
    if (socket.connected) {
      setConnected(true)
      setStatus('')
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('connect_error', onConnectError)
      socket.off('disconnect', onDisconnect)
      socket.off('room_created')
      socket.off('opponent_joined')
      socket.off('room_joined')
      socket.off('error_message')
    }
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!connected) {
      setError('Not connected to server — please wait or check that the backend is running')
      return
    }

    if (!username.trim()) {
      setError('Please enter a username')
      return
    }
    if (!isCreate && !roomCode.trim()) {
      setError('Please enter a room code')
      return
    }
    setLoading(true)

    const playerId = getOrCreatePlayerId()

    if (isCreate) {
      socket.emit('create_room', { username: username.trim(), playerId })
    } else {
      socket.emit('join_room', {
        username: username.trim(),
        roomCode: roomCode.trim().toLowerCase(),
        playerId,
      })
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    })
  }

  const buildShareLink = (code) => {
    if (!code) return ''
    // Prefer the pre-built link from the server (host never holds raw guestToken)
    const guestLink = sessionStorage.getItem('chegg_guest_link')
    if (guestLink) return guestLink
    // Fallback to join link if link not available
    const origin =
      (typeof window !== 'undefined' && window.location && window.location.origin) ||
      'https://chegg-game.vercel.app'
    return `${origin}/join/${code.toLowerCase()}`
  }

  const copyLink = () => {
    const link = buildShareLink(generatedCode)
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  return (
    <BackgroundPaths>
      <div className="lobby-content" style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Header */}
        <header className="lobby-header">
          <h1 className="lobby-logo font-display">CHEGG</h1>
          <p className="lobby-tagline font-label">Ethereal Strategy Environment</p>
        </header>

        {/* Card */}
        <main className="lobby-main">
          {/* Single card: loader (when connecting) + form (always) */}
          <LiquidGlassCard className="lobby-card animate-fade-in-up">
            {/* Connecting loader — sits above the form, hidden once connected */}
            {!connected && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(74,74,82,0.25)' }}>
                <Loader title="Connecting to backend..." subtitle="Please wait" size="sm" />
              </div>
            )}

            {/* Card Header */}
            <div className="lobby-card-header">
              <h2 className="lobby-title font-display">
                {isCreate ? 'Create Room' : 'Join Room'}
              </h2>
              <p className="lobby-subtitle font-body">
                {isCreate
                  ? 'Initialize a new tactical session'
                  : 'Enter a room code to join the battle'}
              </p>
            </div>

            {/* Show generated code if room was created */}
            {generatedCode ? (
              <div className="lobby-code-display">
                <p className="font-label code-label">Your Room Code</p>
                <div className="code-row">
                  <span className="code-value font-mono">{generatedCode}</span>
                  <button
                    id="btn-copy-code"
                    className="btn btn-ghost code-copy-btn"
                    onClick={copyCode}
                  >
                    {copiedCode ? '✓ Copied' : 'Copy Code'}
                  </button>
                </div>

                <p className="font-label code-label share-label">Share this link</p>
                <div className="code-row share-row">
                  <span className="share-link font-mono">{buildShareLink(generatedCode)}</span>
                  <button
                    id="btn-copy-link"
                    className="btn btn-ghost code-copy-btn"
                    onClick={copyLink}
                  >
                    {copiedLink ? '✓ Copied' : 'Copy Link'}
                  </button>
                </div>

                {status && <p className="status-msg lobby-waiting">{status}</p>}
              </div>
            ) : (
              <form className="lobby-form" onSubmit={handleSubmit}>
                {/* Room Code field (Join only) */}
                {!isCreate && (
                  <div className="form-group">
                    <label className="form-label font-label">Room Code</label>
                    <div className="input-wrapper">
                      <span className="input-icon">⌗</span>
                      <input
                        id="input-room-code"
                        type="text"
                        className="input-field"
                        placeholder="Enter 8-character code"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toLowerCase())}
                        maxLength={8}
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {/* Username field */}
                <div className="form-group">
                  <label className="form-label font-label">Username</label>
                  <div className="input-wrapper">
                    <span className="input-icon">⚔</span>
                    <input
                      id="input-username"
                      type="text"
                      className="input-field"
                      placeholder="Enter battle alias..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={20}
                      autoComplete="off"
                      autoFocus={isCreate}
                    />
                  </div>
                </div>

                {/* Server metadata row */}
                <div className="lobby-meta">
                  <span className="meta-item font-label">
                    <span className="meta-label">Region</span>
                    <span className="meta-value">US-EAST-01</span>
                  </span>
                  <span className="meta-item font-label">
                    <span className="meta-label">Status</span>
                    <span className="meta-value meta-online">Online</span>
                  </span>
                </div>

                {error && <p className="error-msg">{error}</p>}
                {status && <p className="status-msg">{status}</p>}

                <button
                  id={isCreate ? 'btn-create-room-submit' : 'btn-join-room-submit'}
                  type="submit"
                  className="btn btn-primary lobby-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner" />
                  ) : isCreate ? (
                    '✕  Create Room'
                  ) : (
                    '⚔  Join Room'
                  )}
                </button>

                <p className="lobby-version font-label">v1.0.0 Obsidian</p>
              </form>
            )}
          </LiquidGlassCard>

          <button
            id="btn-return-lobby"
            className="lobby-back font-label"
            onClick={() => navigate('/')}
          >
            ← Return to Lobby
          </button>
        </main>
      </div>
    </BackgroundPaths>
  )
}
