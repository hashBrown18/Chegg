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
import { useNavigate } from 'react-router-dom'
import socket from '../socket.js'

import Board from '../components/Board/Board.jsx'
import PlayerPanel from '../components/GameUI/PlayerPanel.jsx'
import Hand from '../components/GameUI/Hand.jsx'
import TurnIndicator from '../components/GameUI/TurnIndicator.jsx'
import AbandonTimer from '../components/GameUI/AbandonTimer.jsx'
import RulesPanel from '../components/GameUI/RulesPanel.jsx'
import WinScreen from '../components/GameUI/WinScreen.jsx'
import './GamePage.css'

export default function GamePage() {
  const navigate = useNavigate()

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
  const [winData, setWinData] = useState(null) // { winner, loser, winnerRole }
  const [disconnectData, setDisconnectData] = useState(null) // { message, timeoutSeconds }

  // Track opponent mana changes through turn_change
  const opponentManaRef = useRef(0)

  // ── Mount: register socket events ──
  useEffect(() => {
    if (!socket.connected) socket.connect()

    // Restore from sessionStorage (set by DeckBuilderPage when game_start comes in)
    const stored = sessionStorage.getItem('chegg_game_data')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        applyGameStart(data)
      } catch {}
    }

    socket.on('game_start', (data) => {
      sessionStorage.setItem('chegg_game_data', JSON.stringify(data))
      applyGameStart(data)
    })

    socket.on('board_update', ({ boardState: bs }) => {
      setBoardState(bs)
      clearSelections()
    })

    socket.on('mana_update', ({ yourMana: ym, maxMana: mm }) => {
      setYourMana(ym)
      setMaxMana(mm)
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
      setTurnNumber(tn)
      clearSelections()
    })

    socket.on('valid_moves', ({ minionInstanceId, movementSquares, attackSquares, abilitySquares }) => {
      setHighlights({ minionInstanceId, movementSquares, attackSquares, abilitySquares })
    })

    socket.on('game_over', (data) => {
      setWinData(data)
    })

    socket.on('opponent_disconnected', ({ message, timeoutSeconds }) => {
      setDisconnectData({ message, timeoutSeconds })
    })

    socket.on('opponent_reconnected', ({ message }) => {
      setDisconnectData(null)
    })

    socket.on('abandon_win', ({ message }) => {
      // Show as a win for us
      setWinData({ winner: 'You', loser: 'Opponent', winnerRole: yourRole })
      setDisconnectData(null)
    })

    return () => {
      socket.off('game_start')
      socket.off('board_update')
      socket.off('mana_update')
      socket.off('your_hand')
      socket.off('opponent_card_count')
      socket.off('deck_update')
      socket.off('turn_change')
      socket.off('valid_moves')
      socket.off('game_over')
      socket.off('opponent_disconnected')
      socket.off('opponent_reconnected')
      socket.off('abandon_win')
    }
  }, [yourRole])

  function applyGameStart(data) {
    setGameData(data)
    setBoardState(data.boardState || {})
    setYourRole(data.yourRole)
    setYourMana(data.mana ?? 0)
    setMaxMana(data.maxMana ?? 1)
    setYourHand(data.yourHand || [])
    setOpponentHandCount(data.opponentCardCount ?? 0)
    setYourDeckCount(data.yourDeckCount ?? 0)
    setOpponentDeckCount(data.opponentDeckCount ?? 0)
    setCurrentTurn(data.currentTurn || 'host')
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
    if (currentTurn !== yourRole) return

    if (selectedHandIndex === index) {
      // Deselect
      clearSelections()
      return
    }

    clearSelections()
    setSelectedHandIndex(index)
    // Show spawn highlights — valid spawn squares in own spawn zone
    // The server highlights logic is request-based only for minions on board.
    // For hand cards, the client shows the spawn zone (rows I,J for host; A,B for guest)
    const spawnRows = yourRole === 'host' ? ['I', 'J'] : ['A', 'B']
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
  }, [currentTurn, yourRole, selectedHandIndex, boardState])

  // ── Board cell click ──
  const handleCellClick = useCallback((col, row, occupant) => {
    const isYourTurn = currentTurn === yourRole

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
      if (occupant && occupant.owner === yourRole && isYourTurn) {
        selectBoardMinion(occupant)
        return
      }

      // Click anywhere else — deselect
      clearSelections()
      return
    }

    // No selection — click on your minion to select it
    if (occupant && occupant.owner === yourRole && isYourTurn) {
      selectBoardMinion(occupant)
    }
  }, [currentTurn, yourRole, selectedMinion, selectedHandIndex, highlights, yourHand, boardState])

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
    if (currentTurn !== yourRole) return
    clearSelections()
    socket.emit('end_turn', {})
  }

  // ── Win / Rematch / Leave ──
  const handleRematch = () => {
    setWinData(null)
    clearSelections()
    sessionStorage.removeItem('chegg_game_data')
    navigate('/deck')
  }

  const handleLeave = () => {
    sessionStorage.removeItem('chegg_game_data')
    socket.disconnect()
    navigate('/')
  }

  // ── Derived values ──
  const yourUsername = yourRole === 'host' ? hostUsername : guestUsername
  const opponentUsername = yourRole === 'host' ? guestUsername : hostUsername
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

  if (!gameData && !sessionStorage.getItem('chegg_game_data')) {
    return (
      <div className="gamepage-loading">
        <span className="font-label">Connecting to game...</span>
      </div>
    )
  }

  return (
    <div className="gamepage">
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
        <div className="topbar-right">
          {disconnectData && (
            <AbandonTimer
              initialSeconds={disconnectData.timeoutSeconds}
              message={disconnectData.message}
            />
          )}
        </div>
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

          <button
            id="btn-end-turn"
            className={`btn ${isYourTurn ? 'btn-primary' : 'btn-ghost'} end-turn-btn`}
            onClick={handleEndTurn}
            disabled={!isYourTurn}
          >
            {isYourTurn ? 'End Turn →' : 'Waiting...'}
          </button>
        </aside>
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

      {/* ── Overlays ── */}
      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
      {winData && (
        <WinScreen
          winnerUsername={winData.winner}
          yourUsername={yourUsername}
          onRematch={handleRematch}
          onLeave={handleLeave}
        />
      )}
    </div>
  )
}
