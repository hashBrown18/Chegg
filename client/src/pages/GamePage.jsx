/**
 * GamePage — The main game screen
 *
 * Layout (per CLAUDE.md spec):
 *   [CHEGG title - top left] [• Red/Blue's Turn - top center] [Turn N - top right]
 *   [OPPONENT PANEL - left]  [8x10 BOARD - center]            [YOUR PANEL - right]
 *   [EGGS / RULES - left]
 *                            [YOUR HAND - bottom center]
 *
 * Background: pure black #000000 (no purple, no pattern per spec)
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import socket from '../socket.js'
import { getOrCreatePlayerId } from '../playerId.js'
import { getRoomCode, getRole, getRejoinToken, dropRejoinToken, dropRoomSession } from '../roomSession.js'

import Board from '../components/Board/Board.jsx'
import PlayerPanel from '../components/GameUI/PlayerPanel.jsx'
import Hand from '../components/GameUI/Hand.jsx'
import TurnIndicator from '../components/GameUI/TurnIndicator.jsx'
import RulesPanel from '../components/GameUI/RulesPanel.jsx'
import WinScreen from '../components/GameUI/WinScreen.jsx'
import ReconnectOverlay from '../components/GameUI/ReconnectOverlay.jsx'
import OpponentDisconnectBanner from '../components/GameUI/OpponentDisconnectBanner.jsx'
import MoveErrorToast from '../components/GameUI/MoveErrorToast.jsx'
import './GamePage.css'

export default function GamePage() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const playerId = localStorage.getItem('chegg_player_id') || getOrCreatePlayerId()
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [seatInUse, setSeatInUse] = useState('')

  // Secure rejoin token — never in the URL, never shared. The room code comes
  // from the URL when present, otherwise from the stored session. The role is
  // per tab, and only falls back to ?role= for a tab that was closed and
  // reopened, so each player reads their own token out of the shared browser.
  const [searchParams] = useSearchParams()
  const roomCode = roomId || getRoomCode()
  const role = getRole() || searchParams.get('role') || ''
  const rejoinToken = getRejoinToken(roomCode, role)
  const username = sessionStorage.getItem('chegg_username') || ''

  useEffect(() => {
    if (!localStorage.getItem('chegg_player_id')) {
      localStorage.setItem('chegg_player_id', playerId)
    }
  }, [playerId])

  // ── Game State ──
  const [gameData, setGameData] = useState(null) // initial data from game_start event
  const [boardState, setBoardState] = useState({})
  const [yourRole, setYourRole] = useState(null)  // 'host' | 'guest'
  const [yourMana, setYourMana] = useState(0)
  const [maxMana, setMaxMana] = useState(1)
  const [opponentMana, setOpponentMana] = useState(0)
  const [yourHand, setYourHand] = useState([])
  const [opponentHandCount, setOpponentHandCount] = useState(0)
  const [yourDeckCount, setYourDeckCount] = useState(0)
  const [opponentDeckCount, setOpponentDeckCount] = useState(0)
  const [currentTurn, setCurrentTurn] = useState('host')
  const [turnNumber, setTurnNumber] = useState(1)
  const [hostUsername, setHostUsername] = useState('')
  const [guestUsername, setGuestUsername] = useState('')

  // ── Selected Unit State ──
  const [selectedMinion, setSelectedMinion] = useState(null) // board minion instance
  const [selectedHandIndex, setSelectedHandIndex] = useState(null) // hand card index
  const [highlights, setHighlights] = useState(null) // { movementSquares, attackSquares, abilitySquares }

  // ── UI State ──
  const [showRules, setShowRules] = useState(false)
  const [winData, setWinData] = useState(null)           // { youWon, winnerUsername }
  // Rematch request state — 'idle' | 'requested' | 'incoming' | 'blocked'
  const [rematch, setRematch] = useState({ state: 'idle', fromName: '', notice: '' })
  // Opponent disconnected (shown to the waiting player) — uses remainingMs from server
  const [opponentDisconnect, setOpponentDisconnect] = useState(null) // { message, remainingMs, endTime }
  // Self disconnected (shown to the player who lost connection)
  const [showReconnectOverlay, setShowReconnectOverlay] = useState(false)
  const [moveError, setMoveError] = useState(null)       // { message }
  // Socket connection state for "Reconnecting..." indicator
  const [isConnecting, setIsConnecting] = useState(false)

  // Track opponent mana changes through turn_change
  const opponentManaRef = useRef(0)

  // Refs for yourRole and currentTurn — used in socket callbacks so we don't
  // need these as effect dependencies (which would re-register listeners).
  const yourRoleRef = useRef(null)
  const currentTurnRef = useRef('host')
  const gameDataRef = useRef(null) // set as soon as the server hands over game state

  // COUNCIL FIX: BUG 3 — refs for all state read inside socket handlers to
  // avoid stale closures from the empty-dep useEffect registration.
  const selectedMinionRef = useRef(null)
  const selectedHandIndexRef = useRef(null)
  const yourHandRef = useRef([])
  const highlightsRef = useRef(null)
  const boardStateRef = useRef({})

  // COUNCIL FIX: BUG 3 — sync refs with state so socket handlers never read stale closures
  useEffect(() => {
    selectedMinionRef.current = selectedMinion
    selectedHandIndexRef.current = selectedHandIndex
    yourHandRef.current = yourHand
    highlightsRef.current = highlights
    boardStateRef.current = boardState
  }, [selectedMinion, selectedHandIndex, yourHand, highlights, boardState])

  // A seat is only ever claimed with the private rejoin token — no token, no room
  // context (or an old shared link) goes through the join flow instead.
  useEffect(() => {
    if (!roomCode || !rejoinToken) {
      navigate(roomCode ? `/join/${roomCode}` : '/', { replace: true })
    }
  }, [roomCode, rejoinToken, navigate])

  // ── Mount: register socket events ──
  useEffect(() => {
    // Connect if not already
    if (!socket.connected) {
      socket.connect({ query: { roomId, playerId } })
    }

    // COUNCIL FIX: BUG 4 — removed sessionStorage as third source of truth for hand state.
    // Hand data now comes only from server via game_start and your_hand events.

    if (roomCode && rejoinToken) {
      // Initial join/rejoin on mount — the private rejoin token is the only credential.
      console.log(`[CHEGG] Joining room ${roomCode}`)
      socket.emit('rejoin_game', { roomCode, rejoinToken, playerId, username })
    }

    // ── Auto-reconnect on socket connect (socket.io handles reconnection, we rejoin) ──
    const onConnect = () => {
      setIsConnecting(false)
      if (roomCode && rejoinToken) {
        console.log(`[CHEGG] Socket reconnected — re-joining room ${roomCode}`)
        socket.emit('rejoin_game', {
          roomCode,
          rejoinToken,
          playerId,
          username,
        })
      }
    }

    // Track disconnection for "Reconnecting..." UI
    const onDisconnect = (reason) => {
      if (reason !== 'io client disconnect') {
        setIsConnecting(true)
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    // ── Game events ──
    socket.on('game_start', (data) => {
      // Server is the single source of truth. Always apply server state.
      applyGameStart(data)

      if (data.isReconnection) {
        // Reconnection: server sent full state.
        setShowReconnectOverlay(false)
        setIsConnecting(false)
      }
    })

    socket.on('board_update', ({ boardState: bs }) => {
      setBoardState(bs)
      clearSelections()
    })

    socket.on('mana_update', ({ yourMana: ym, opponentMana: om, maxMana: mm }) => {
      setYourMana(ym)
      setMaxMana(mm)
      if (typeof om === 'number') setOpponentMana(om)
    })

    socket.on('your_hand', ({ hand }) => {
      setYourHand(hand)
    })

    socket.on('opponent_card_count', ({ count }) => {
      setOpponentHandCount(count)
    })

    socket.on('deck_update', ({ yourDeckCount: yd, opponentDeckCount: od }) => {
      setYourDeckCount(yd)
      setOpponentDeckCount(od)
    })

    socket.on('turn_change', ({ currentTurn: ct, turnNumber: tn }) => {
      setCurrentTurn(ct)
      currentTurnRef.current = ct
      setTurnNumber(tn)
      clearSelections()
    })

    socket.on('valid_moves', ({ minionInstanceId, movementSquares, attackSquares, abilitySquares }) => {
      setHighlights({ minionInstanceId, movementSquares, attackSquares, abilitySquares })
    })

    socket.on('game_over', (data) => {
      // Each client derives its own result from its own identity. The payload is
      // shared by both players, so usernames/text can never decide the outcome.
      const youWon = data.winnerId
        ? data.winnerId === playerId
        : data.winnerRole === yourRoleRef.current
      setShowReconnectOverlay(false)
      setOpponentDisconnect(null)
      setWinData({
        youWon,
        winnerUsername: data.winnerUsername || 'Your opponent',
      })
      setRematch({ state: 'idle', fromName: '', notice: '' })
    })

    socket.on('game_abandoned', () => {
      // Both players were gone when the clock ran out — nobody wins.
      setOpponentDisconnect(null)
      setRoomNotFound(true)
    })

    socket.on('room_expired', () => setRoomNotFound(true))

    socket.on('seat_in_use', ({ message }) => setSeatInUse(message))

    socket.on('game_error', () => setRoomNotFound(true))

    // A rejected rejoin (bad/missing token) before the game state arrives means
    // this browser cannot claim the seat — send it back to the join flow instead
    // of sitting on "Connecting to game..." forever. Rejections that arrive after
    // the state is restored are shown by the reconnect overlay, not acted on here.
    socket.on('error_message', ({ message } = {}) => {
      if (!gameDataRef.current && roomCode) {
        console.warn('[CHEGG] Rejected before game state:', message)
        navigate(`/join/${roomCode}`, { replace: true })
      }
    })

    socket.on('invalid_move', ({ message, reason }) => {
      setMoveError({ message: reason || message })
    })

    // ── Opponent disconnect / reconnect events (shown to the WAITING player) ──
    // Server sends remainingMs (not absolute deadline) — clock-skew safe.
    // We compute endTime = performance.now() + remainingMs and count down locally.
    socket.on('opponent_disconnected', ({ message, remainingMs }) => {
      const endTime = performance.now() + (remainingMs || 60000)
      setOpponentDisconnect({ message, remainingMs, endTime })
    })

    socket.on('opponent_reconnected', () => {
      setOpponentDisconnect(null)
    })

    // ── Rematch events ──
    socket.on('rematch_received', ({ fromUsername }) => {
      setRematch({ state: 'incoming', fromName: fromUsername || 'Your opponent', notice: '' })
    })

    socket.on('rematch_declined', ({ message }) => {
      setRematch({ state: 'blocked', fromName: '', notice: message || 'Rematch declined' })
    })

    socket.on('rematch_start', () => {
      // Same room, fresh deck phase — keep the room code and player token so the
      // deck builder can rejoin the room and both players can confirm again.
      sessionStorage.removeItem('chegg_game_data')
      dropRejoinToken(roomCode, yourRoleRef.current || role)
      setWinData(null)
      setRematch({ state: 'idle', fromName: '', notice: '' })
      clearSelections()
      navigate('/deck')
    })

    socket.on('opponent_left', ({ message }) => {
      setRematch({
        state: 'blocked',
        fromName: '',
        notice: message || 'Your opponent left the room.',
      })
    })

    // ── Self disconnect/reconnect (shown to the DISCONNECTED player) ──
    socket.on('disconnect', (reason) => {
      // Don't show overlay for deliberate client-side disconnects
      if (reason === 'io client disconnect') return
      setShowReconnectOverlay(true)
    })

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('game_start')
      socket.off('board_update')
      socket.off('mana_update')
      socket.off('your_hand')
      socket.off('opponent_card_count')
      socket.off('deck_update')
      socket.off('turn_change')
      socket.off('valid_moves')
      socket.off('game_over')
      socket.off('game_abandoned')
      socket.off('room_expired')
      socket.off('seat_in_use')
      socket.off('game_error')
      socket.off('error_message')
      socket.off('invalid_move')
      socket.off('opponent_disconnected')
      socket.off('opponent_reconnected')
      socket.off('rematch_received')
      socket.off('rematch_declined')
      socket.off('rematch_start')
      socket.off('opponent_left')
      socket.off('disconnect')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyGameStart(data) {
    gameDataRef.current = data
    setGameData(data)
    setBoardState(data.boardState || {})
    setYourRole(data.yourRole)
    yourRoleRef.current = data.yourRole
    setYourMana(data.mana ?? 0)
    setOpponentMana(data.opponentMana ?? 0)
    setMaxMana(data.maxMana ?? 1)
    setYourHand(data.yourHand || [])
    setOpponentHandCount(data.opponentCardCount ?? 0)
    setYourDeckCount(data.yourDeckCount ?? 0)
    setOpponentDeckCount(data.opponentDeckCount ?? 0)
    setCurrentTurn(data.currentTurn || 'host')
    currentTurnRef.current = data.currentTurn || 'host'
    setTurnNumber(data.turnNumber ?? 1)
    setHostUsername(data.hostUsername || 'Host')
    setGuestUsername(data.guestUsername || 'Guest')
  }

  function clearSelections() {
    setSelectedMinion(null)
    setSelectedHandIndex(null)
    setHighlights(null)
  }

  // ── Hand card selection ──
  const handleCardSelect = useCallback((index) => {
    if (currentTurnRef.current !== yourRoleRef.current) return

    if (selectedHandIndex === index) {
      // Deselect
      clearSelections()
      return
    }

    clearSelections()
    setSelectedHandIndex(index)
    // Show spawn highlights — valid spawn squares in own spawn zone
    const spawnRows = yourRoleRef.current === 'host' ? ['I', 'J'] : ['A', 'B']
    const movementSquares = []
    for (let col = 1; col <= 8; col++) {
      for (const row of spawnRows) {
        const key = `${col},${row}`
        if (!boardState[key]) {
          movementSquares.push({ col, row })
        }
      }
    }
    setHighlights({ movementSquares, attackSquares: [], abilitySquares: [] })
  }, [selectedHandIndex, boardState])

  // ── Board cell click ──
  const handleCellClick = useCallback((col, row, occupant) => {
    const isYourTurn = currentTurnRef.current === yourRoleRef.current

    // If a hand card is selected and we click a green spawn square → spawn
    if (selectedHandIndex !== null && isYourTurn) {
      const inMoveHighlights = highlights?.movementSquares?.some(sq => sq.col === col && sq.row === row)
      if (inMoveHighlights) {
        const minionId = yourHand[selectedHandIndex]
        socket.emit('spawn_minion', { minionId, targetCell: { col, row } })
        clearSelections()
        return
      } else {
        // Click outside highlights — deselect hand
        clearSelections()
        return
      }
    }

    // If a board minion is selected
    if (selectedMinion) {
      const inMoves = highlights?.movementSquares?.some(sq => sq.col === col && sq.row === row)
      const inAttacks = highlights?.attackSquares?.some(sq => sq.col === col && sq.row === row)
      const inAbility = highlights?.abilitySquares?.some(sq => sq.col === col && sq.row === row)

      if (inMoves) {
        socket.emit('move_minion', { minionInstanceId: selectedMinion.instanceId, targetCell: { col, row } })
        clearSelections()
        return
      }

      if (inAttacks) {
        // Iron Golem needs a direction — compute from selected minion position
        let direction = undefined
        if (selectedMinion.type === 'iron_golem') {
          direction = computeDirection(selectedMinion.position, { col, row })
        }
        socket.emit('attack', {
          minionInstanceId: selectedMinion.instanceId,
          targetCell: { col, row },
          direction,
        })
        clearSelections()
        return
      }

      if (inAbility) {
        socket.emit('use_ability', {
          minionInstanceId: selectedMinion.instanceId,
          targetCell: { col, row },
        })
        clearSelections()
        return
      }

      // Click on another of your minions — select that instead
      if (occupant && occupant.owner === yourRoleRef.current && isYourTurn) {
        selectBoardMinion(occupant)
        return
      }

      // Click anywhere else — deselect
      clearSelections()
      return
    }

    // No selection — click on your minion to select it
    if (occupant && occupant.owner === yourRoleRef.current && isYourTurn) {
      selectBoardMinion(occupant)
    }
  }, [selectedMinion, selectedHandIndex, highlights, yourHand, boardState])

  function selectBoardMinion(minion) {
    clearSelections()
    setSelectedMinion(minion)
    socket.emit('request_highlights', { minionInstanceId: minion.instanceId })
  }

  // For Iron Golem: determine sweep direction from attacker to target
  function computeDirection(from, to) {
    const dr = to.row.charCodeAt(0) - from.row.charCodeAt(0)
    const dc = to.col - from.col
    if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 'right' : 'left'
    return dr > 0 ? 'down' : 'up'
  }

  // ── End Turn ──
  const handleEndTurn = () => {
    if (currentTurnRef.current !== yourRoleRef.current) return
    clearSelections()
    socket.emit('end_turn', {})
  }

  // ── Win / Rematch / Leave ──
  // Rematch is negotiated with the opponent: request → they accept/decline.
  const handleRematch = () => {
    if (rematch.state !== 'idle') return
    socket.emit('rematch_request')
    setRematch({ state: 'requested', fromName: '', notice: '' })
  }

  const handleAcceptRematch = () => {
    socket.emit('rematch_accept')
    setRematch({ state: 'requested', fromName: '', notice: '' })
  }

  const handleDeclineRematch = () => {
    socket.emit('rematch_decline')
    setRematch({ state: 'idle', fromName: '', notice: '' })
  }

  const handleLeave = () => {
    sessionStorage.removeItem('chegg_game_data')
    dropRoomSession(roomCode, yourRoleRef.current || role)
    sessionStorage.removeItem('chegg_username')
    sessionStorage.removeItem('chegg_player_token')
    sessionStorage.removeItem('chegg_guest_link')
    socket.disconnect()
    navigate('/')
  }

  // ── Derived values ──
  const isYourTurn = currentTurn === yourRole

  // For host: opponent is left (blue), you are right (red) — actually per spec:
  // Blue player is host (LEFT), Red player is guest (RIGHT)
  // Both see themselves on the "right" / their side. But layout is fixed: left = host side, right = guest side.
  // Per spec: Left sidebar = Blue Player Panel, Right sidebar = Red Player Panel
  const hostPanel = {
    username: hostUsername,
    mana: yourRole === 'host' ? yourMana : opponentMana,
    maxMana,
    deckCount: yourRole === 'host' ? yourDeckCount : opponentDeckCount,
    handCount: yourRole === 'host' ? yourHand.length : opponentHandCount,
    isActive: currentTurn === 'host',
    side: 'left',
  }
  const guestPanel = {
    username: guestUsername,
    mana: yourRole === 'guest' ? yourMana : opponentMana,
    maxMana,
    deckCount: yourRole === 'guest' ? yourDeckCount : opponentDeckCount,
    handCount: yourRole === 'guest' ? yourHand.length : opponentHandCount,
    isActive: currentTurn === 'guest',
    side: 'right',
  }

   if (seatInUse) {
     return (
       <div className="gamepage-error">
         <h2>This seat is open in another tab</h2>
         <p>{seatInUse}</p>
         <button onClick={() => navigate('/')}>Return to Home</button>
       </div>
     )
   }

   if (roomNotFound) {
     return (
       <div className="gamepage-error">
         <h2>Room not found or expired</h2>
         <p>The room you are looking for does not exist or has been deleted.</p>
         <button onClick={() => navigate('/')}>Return to Home</button>
       </div>
     )
   }

   // A late reconnect can receive game_over with no game_start (e.g. the
   // forfeit clock already expired) — show the result instead of loading forever.
   if (!gameData && !winData) {
     return (
       <div className="gamepage-loading">
         <span className="font-label">{isConnecting ? 'Reconnecting…' : 'Connecting to game...'}</span>
       </div>
     )
   }

  return (
    <div className="gamepage" data-turn={currentTurn} data-is-your-turn={isYourTurn} data-role={yourRole}>
      {/* ── Top Bar ── */}
      <header className="gamepage-topbar">
        <div className="topbar-left">
          <span className="topbar-logo font-display">CHEGG</span>
          <span className="topbar-vs font-body">
            {hostUsername} vs {guestUsername}
          </span>
        </div>
        <div className="topbar-center">
          <TurnIndicator
            currentTurn={currentTurn}
            yourRole={yourRole}
            hostUsername={hostUsername}
            guestUsername={guestUsername}
            turnNumber={turnNumber}
          />
        </div>
        <div className="topbar-right" />
      </header>

      {/* ── Main Layout ── */}
      <div className="gamepage-body">
        {/* Left sidebar */}
        <aside className="gamepage-sidebar-left">
          <PlayerPanel {...hostPanel} />

          <div className="sidebar-buttons">
            <button
              id="btn-eggs"
              className="btn btn-ghost sidebar-btn"
              title="View your deck / eggs"
              disabled
            >
              🥚 Eggs
            </button>
            <button
              id="btn-rules"
              className="btn btn-ghost sidebar-btn"
              onClick={() => setShowRules(true)}
            >
              📖 Rules
            </button>
          </div>
        </aside>

        {/* Board */}
        <section className="gamepage-board-area">
          <Board
            boardState={boardState}
            yourRole={yourRole}
            highlights={highlights}
            selectedMinion={selectedMinion}
            onCellClick={handleCellClick}
            currentTurn={currentTurn}
          />
        </section>

        {/* Right sidebar */}
        <aside className="gamepage-sidebar-right">
          <PlayerPanel {...guestPanel} />
        </aside>
      </div>

      {/* ── Mobile Status Bar (Hidden on desktop) ── */}
      <div className="mobile-only-mana-bar">
        <div className="mobile-mana-item mobile-mana-host">
          <span className="mobile-mana-dot" />
          <span className="font-mono">{hostPanel.mana}/{maxMana}</span>
        </div>
        <div className="mobile-mana-item mobile-mana-guest">
          <span className="mobile-mana-dot" />
          <span className="font-mono">{guestPanel.mana}/{maxMana}</span>
        </div>
      </div>

      {/* ── Your Hand (bottom center) ── */}
      <footer className="gamepage-hand-area">
        <Hand
          hand={yourHand}
          selectedHandIndex={selectedHandIndex}
          onCardSelect={handleCardSelect}
          yourMana={yourMana}
          isYourTurn={isYourTurn}
        />
      </footer>

      {/* ── Global Controls (fixed/bottom on mobile) ── */}
      <div className="gamepage-controls">
        {moveError && (
          <MoveErrorToast 
            message={moveError.message} 
            onClose={() => setMoveError(null)} 
          />
        )}
        
        <button
          id="btn-end-turn"
          className={`btn ${isYourTurn ? 'btn-primary' : 'btn-ghost'} end-turn-btn`}
          onClick={handleEndTurn}
          disabled={!isYourTurn}
        >
          {isYourTurn ? 'End Turn →' : 'Waiting...'}
        </button>
      </div>

      {/* ── Overlays ── */}
      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}

      {/* Shown to the player waiting for opponent to come back */}
      {opponentDisconnect && !winData && (
        <OpponentDisconnectBanner
          message={opponentDisconnect.message}
          endTime={opponentDisconnect.endTime}
        />
      )}

      {/* Shown to the player who themselves disconnected */}
      {showReconnectOverlay && !winData && (
        <ReconnectOverlay onGiveUp={handleLeave} />
      )}

      {winData && (
        <WinScreen
          youWon={winData.youWon}
          winnerUsername={winData.winnerUsername}
          onRematch={handleRematch}
          onLeave={handleLeave}
          rematchState={rematch.state}
          incomingName={rematch.fromName}
          notice={rematch.notice}
          onAcceptRematch={handleAcceptRematch}
          onDeclineRematch={handleDeclineRematch}
        />
      )}
    </div>
  )
}