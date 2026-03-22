import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket.js'
import BackgroundSVG from '../components/BackgroundSVG.jsx'
import './LobbyPage.css'

/**
 * LobbyPage — handles both Create Room (/create) and Join Room (/join)
 * Mode prop: 'create' | 'join'
 */
export default function LobbyPage({ mode }) {
  const navigate = useNavigate()
  const isCreate = mode === 'create'

  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('') // waiting message
  const [generatedCode, setGeneratedCode] = useState('') // after room is created
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(socket.connected)

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
    socket.on('room_created', ({ roomCode: code }) => {
      setGeneratedCode(code)
      setStatus('Waiting for opponent...')
      setLoading(false)
    })

    socket.on('opponent_joined', ({ opponentUsername }) => {
      setStatus(`${opponentUsername} has joined! Heading to deck builder...`)
      // Both navigate to deck builder
      setTimeout(() => navigate('/deck'), 800)
    })

    // ── JOIN ROOM listeners ──
    socket.on('room_joined', ({ roomCode: code, opponentUsername }) => {
      setStatus(`Joining room ${code}... Heading to deck builder!`)
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
  }, [navigate])

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

    if (isCreate) {
      socket.emit('create_room', { username: username.trim() })
    } else {
      socket.emit('join_room', {
        username: username.trim(),
        roomCode: roomCode.trim().toUpperCase(),
      })
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="lobby">
      <BackgroundSVG />

      {/* Header */}
      <header className="lobby-header">
        <h1 className="lobby-logo font-display">CHEGG</h1>
        <p className="lobby-tagline font-label">Ethereal Strategy Environment</p>
      </header>

      {/* Card */}
      <main className="lobby-main">
        <div className="lobby-card card-glass animate-fade-in-up">

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
                  {copied ? '✓ Copied' : 'Copy'}
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
                      placeholder="Enter 6-character code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
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
        </div>

        <button
          id="btn-return-lobby"
          className="lobby-back font-label"
          onClick={() => navigate('/')}
        >
          ← Return to Lobby
        </button>
      </main>
    </div>
  )
}
