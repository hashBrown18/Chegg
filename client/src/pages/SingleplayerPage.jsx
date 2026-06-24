/**
 * SingleplayerPage — Full singleplayer game with Easy bot
 * Deck building → Game play with local AI opponent
 * All logic client-side, zero server calls.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GameEngine,
  DECK_MINION_IDS,
  MINION_TYPES,
  getSpawnRows,
  calculateValidSquares,
  cellKey,
} from '../singleplayer/gameEngine.js'
import { runEasyBotTurn } from '../singleplayer/easyBot.js'
import { runMediumBotTurn } from '../singleplayer/mediumBot.js'
import { runHardBotTurn, getHardBotPresetDeck } from '../singleplayer/hardBot.js'
import Board from '../components/Board/Board.jsx'
import PlayerPanel from '../components/GameUI/PlayerPanel.jsx'
import Hand from '../components/GameUI/Hand.jsx'
import TurnIndicator from '../components/GameUI/TurnIndicator.jsx'
import RulesPanel from '../components/GameUI/RulesPanel.jsx'
import WinScreen from '../components/GameUI/WinScreen.jsx'
import BackgroundSVG from '../components/BackgroundSVG.jsx'
import './GamePage.css'
import './SingleplayerPage.css'

const ALL_MINIONS = [
  { id: 'zombie',      name: 'Zombie',      cost: 1,  image: '/images/eggs/Zombie.png' },
  { id: 'creeper',     name: 'Creeper',     cost: 1,  image: '/images/eggs/Creeper.png' },
  { id: 'puffer_fish', name: 'Puffer-Fish', cost: 2,  image: '/images/eggs/Pufferfish.png' },
  { id: 'iron_golem',  name: 'Iron Golem',  cost: 2,  image: '/images/eggs/Iron-Golem.png' },
  { id: 'skeleton',    name: 'Skeleton',    cost: 3,  image: '/images/eggs/Skelton.png' },
  { id: 'blaze',       name: 'Blaze',       cost: 3,  image: '/images/eggs/Blaze.png' },
  { id: 'phantom',     name: 'Phantom',     cost: 3,  image: '/images/eggs/Phantom.png' },
  { id: 'enderman',    name: 'Enderman',    cost: 4,  image: '/images/eggs/Enderman.png' },
  { id: 'shulker_box', name: 'Shulker-Box', cost: 4,  image: '/images/eggs/Shulker.png' },
  { id: 'wither',      name: 'Wither',      cost: 6,  image: '/images/eggs/Wither.png' },
]

const MAX_DECK = 15

const DIFFICULTY_LABELS = {
  easy: 'Easy Bot',
  medium: 'Medium Bot',
  hard: 'Hard Bot',
}

function getBotTurnFn(diff) {
  if (diff === 'hard') return runHardBotTurn
  if (diff === 'medium') return runMediumBotTurn
  return runEasyBotTurn
}

export default function SingleplayerPage() {
  const navigate = useNavigate()

  // ── Phase State ──
  const [phase, setPhase] = useState('deckbuilding') // 'deckbuilding' | 'playing'

  // ── Difficulty State ──
  const [difficulty, setDifficulty] = useState('easy') // 'easy' | 'medium'

  // ── Deck Building State ──
  const [chosen, setChosen] = useState([])

  // ── Game State ──
  const engineRef = useRef(null)
  const [boardState, setBoardState] = useState({})
  const [yourMana, setYourMana] = useState(1)
  const [maxMana, setMaxMana] = useState(1)
  const [opponentMana, setOpponentMana] = useState(1)
  const [yourHand, setYourHand] = useState([])
  const [opponentHandCount, setOpponentHandCount] = useState(0)
  const [yourDeckCount, setYourDeckCount] = useState(0)
  const [opponentDeckCount, setOpponentDeckCount] = useState(0)
  const [currentTurn, setCurrentTurn] = useState('host')
  const [turnNumber, setTurnNumber] = useState(1)

  // ── Selection State ──
  const [selectedMinion, setSelectedMinion] = useState(null)
  const [selectedHandIndex, setSelectedHandIndex] = useState(null)
  const [highlights, setHighlights] = useState(null)

  // ── UI State ──
  const [showRules, setShowRules] = useState(false)
  const [winData, setWinData] = useState(null)
  const [moveError, setMoveError] = useState(null)
  const [botThinking, setBotThinking] = useState(false)

  const yourRole = 'host'
  const currentTurnRef = useRef('host')
  const boardStateRef = useRef({})
  const selectedMinionRef = useRef(null)
  const selectedHandIndexRef = useRef(null)
  const yourHandRef = useRef([])
  const highlightsRef = useRef(null)

  useEffect(() => {
    currentTurnRef.current = currentTurn
    boardStateRef.current = boardState
    selectedMinionRef.current = selectedMinion
    selectedHandIndexRef.current = selectedHandIndex
    yourHandRef.current = yourHand
    highlightsRef.current = highlights
  }, [currentTurn, boardState, selectedMinion, selectedHandIndex, yourHand, highlights])

  const isYourTurn = currentTurn === 'host'

  // ── Sync state from engine ──
  const syncState = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setBoardState(engine.getBoardState())
    setYourMana(engine.getMana('host'))
    setOpponentMana(engine.getMana('guest'))
    setYourHand(engine.getPlayerHand('host'))
    setOpponentHandCount(engine.getPlayerHandCount('guest'))
    setYourDeckCount(engine.getPlayerDeckCount('host'))
    setOpponentDeckCount(engine.getPlayerDeckCount('guest'))
    setCurrentTurn(engine.currentTurn)
    setTurnNumber(engine.turnNumber)
    setMaxMana(Math.min(engine.turnNumber, 6))
  }, [])

  // ── Deck Building ──
  const addMinion = (minionId) => {
    if (chosen.length >= MAX_DECK) return
    setChosen(prev => [...prev, minionId])
  }

  const removeMinion = (index) => {
    setChosen(prev => prev.filter((_, i) => i !== index))
  }

  const generateBotDeck = () => {
    if (difficulty === 'hard') return getHardBotPresetDeck()
    const deck = []
    for (let i = 0; i < MAX_DECK; i++) {
      deck.push(DECK_MINION_IDS[Math.floor(Math.random() * DECK_MINION_IDS.length)])
    }
    return deck
  }

  const startGame = () => {
    if (chosen.length !== MAX_DECK) return
    const engine = new GameEngine()
    const botDeck = generateBotDeck()
    engine.initializeGame(chosen, botDeck, difficulty !== 'hard')
    engineRef.current = engine
    syncState()
    setPhase('playing')
  }

  // ── Clear Selections ──
  const clearSelections = useCallback(() => {
    setSelectedMinion(null)
    setSelectedHandIndex(null)
    setHighlights(null)
  }, [])

  // ── Hand Card Selection ──
  const handleCardSelect = useCallback((index) => {
    if (currentTurnRef.current !== 'host') return

    if (selectedHandIndexRef.current === index) {
      clearSelections()
      return
    }

    clearSelections()
    setSelectedHandIndex(index)

    const spawnRows = getSpawnRows('host')
    const movementSquares = []
    for (let col = 1; col <= 8; col++) {
      for (const row of spawnRows) {
        const key = `${col},${row}`
        if (!boardStateRef.current[key]) {
          movementSquares.push({ col, row })
        }
      }
    }
    setHighlights({ movementSquares, attackSquares: [], abilitySquares: [] })
  }, [clearSelections])

  // ── Board Cell Click ──
  const handleCellClick = useCallback((col, row, occupant) => {
    if (currentTurnRef.current !== 'host') return

    // Spawn from hand
    if (selectedHandIndexRef.current !== null) {
      const inMoveHighlights = highlightsRef.current?.movementSquares?.some(
        sq => sq.col === col && sq.row === row
      )
      if (inMoveHighlights) {
        const engine = engineRef.current
        const minionId = yourHandRef.current[selectedHandIndexRef.current]
        const result = engine.spawnMinion('host', minionId, col, row)
        if (result.success) {
          syncState()
          clearSelections()
          // Check win after spawn (Wither explosion can kill Villager)
          const winner = engine.checkWinCondition()
          if (winner) {
            setWinData({
              winner: winner === 'host' ? 'You' : 'Bot',
              loser: winner === 'host' ? 'Bot' : 'You',
              winnerRole: winner,
            })
          }
        } else {
          setMoveError({ message: result.error })
          setTimeout(() => setMoveError(null), 2000)
        }
        return
      }
      clearSelections()
      return
    }

    // Board minion selection/interaction
    if (selectedMinionRef.current) {
      const inMoves = highlightsRef.current?.movementSquares?.some(
        sq => sq.col === col && sq.row === row
      )
      const inAttacks = highlightsRef.current?.attackSquares?.some(
        sq => sq.col === col && sq.row === row
      )

      if (inMoves) {
        const engine = engineRef.current
        engine.moveMinion(selectedMinionRef.current.instanceId, col, row)
        const engineMinion = engine.getMinionInstance(selectedMinionRef.current.instanceId)
        if (engineMinion) engineMinion.hasMovedThisTurn = true
        syncState()
        clearSelections()
        return
      }

      if (inAttacks) {
        const engine = engineRef.current
        const engineMinion = engine.getMinionInstance(selectedMinionRef.current.instanceId)
        let direction = undefined
        if (selectedMinionRef.current.type === 'iron_golem') {
          const dr = row.charCodeAt(0) - selectedMinionRef.current.position.row.charCodeAt(0)
          const dc = col - selectedMinionRef.current.position.col
          direction = Math.abs(dc) > Math.abs(dr)
            ? (dc > 0 ? 'right' : 'left')
            : (dr > 0 ? 'down' : 'up')
        }
        const result = engine.resolveAttack(
          engineMinion || selectedMinionRef.current,
          col, row,
          'host',
          direction
        )
        if (result.success) {
          syncState()
          clearSelections()
          const winner = engine.checkWinCondition()
          if (winner) {
            setWinData({
              winner: winner === 'host' ? 'You' : 'Bot',
              loser: winner === 'host' ? 'Bot' : 'You',
              winnerRole: winner,
            })
          }
        } else {
          setMoveError({ message: result.error })
          setTimeout(() => setMoveError(null), 2000)
        }
        return
      }

      // Click on another friendly minion
      if (occupant && occupant.owner === 'host') {
        selectBoardMinion(occupant)
        return
      }

      clearSelections()
      return
    }

    // No selection — click own minion to select
    if (occupant && occupant.owner === 'host') {
      selectBoardMinion(occupant)
    }
  }, [clearSelections, syncState])

  function selectBoardMinion(minion) {
    clearSelections()

    // Enforce turn constraints: a minion cannot act if it has already
    // moved, already attacked, or was just spawned this turn.
    if (minion.spawnedThisTurn) {
      // Freshly spawned minions cannot move or attack this turn at all
      setSelectedMinion(minion)
      setHighlights({
        minionInstanceId: minion.instanceId,
        movementSquares: [],
        attackSquares: [],
        abilitySquares: [],
      })
      return
    }

    const squares = calculateValidSquares(minion, engineRef.current.board)

    // If already moved this turn, strip movement squares (can still attack)
    const movementSquares = minion.hasMovedThisTurn ? [] : squares.movementSquares
    // If already attacked this turn, strip attack squares (can still move)
    const attackSquares = minion.hasAttackedThisTurn ? [] : squares.attackSquares

    setSelectedMinion(minion)
    setHighlights({
      minionInstanceId: minion.instanceId,
      movementSquares,
      attackSquares,
      abilitySquares: [],
    })
  }

  // ── End Turn ──
  const handleEndTurn = useCallback(async () => {
    if (currentTurnRef.current !== 'host') return
    clearSelections()

    const engine = engineRef.current
    engine.endTurn()
    syncState()

    // Bot's turn
    if (engine.currentTurn === 'guest') {
      setBotThinking(true)
      const botFn = getBotTurnFn(difficulty)
      await botFn(engine)
      setBotThinking(false)
      syncState()

      // Check win after bot turn
      const winner = engine.checkWinCondition()
      if (winner) {
        setWinData({
          winner: winner === 'host' ? 'You' : 'Bot',
          loser: winner === 'host' ? 'Bot' : 'You',
          winnerRole: winner,
        })
        return
      }

      // End bot's turn → back to player
      engine.endTurn()
      syncState()
    }
  }, [clearSelections, syncState, difficulty])

  // ── Rematch / Leave ──
  const handleRematch = () => {
    setWinData(null)
    clearSelections()
    setPhase('deckbuilding')
    setChosen([])
    engineRef.current = null
    setBoardState({})
    setYourMana(1)
    setOpponentMana(1)
    setYourHand([])
    setOpponentHandCount(0)
    setYourDeckCount(0)
    setOpponentDeckCount(0)
    setCurrentTurn('host')
    setTurnNumber(1)
  }

  const handleLeave = () => {
    navigate('/')
  }

  // ── Compute Iron Golem direction ──
  function computeDirection(from, to) {
    const dr = to.row.charCodeAt(0) - from.row.charCodeAt(0)
    const dc = to.col - from.col
    if (Math.abs(dc) > Math.abs(dr)) return dc > 0 ? 'right' : 'left'
    return dr > 0 ? 'down' : 'up'
  }

  // ── Derived values ──
  const hostPanel = {
    username: 'You',
    mana: yourMana,
    maxMana,
    deckCount: yourDeckCount,
    handCount: yourHand.length,
    isActive: currentTurn === 'host',
    side: 'left',
  }

  const guestPanel = {
    username: DIFFICULTY_LABELS[difficulty],
    mana: opponentMana,
    maxMana,
    deckCount: opponentDeckCount,
    handCount: opponentHandCount,
    isActive: currentTurn === 'guest',
    side: 'right',
  }

  // ── Deck Builder Phase ──
  if (phase === 'deckbuilding') {
    return (
      <div className="singleplayer-page">
        <BackgroundSVG />
        <div className="sp-deckbuilder">
          <header className="sp-deck-header">
            <span className="font-display sp-deck-logo">CHEGG</span>
            <h1 className="font-display sp-deck-title">Build Your Deck</h1>
            <span className="font-label sp-deck-subtitle">Singleplayer vs {DIFFICULTY_LABELS[difficulty]}</span>
          </header>

          {/* Difficulty Selection */}
          <div className="sp-difficulty-selector">
            <span className="font-label sp-difficulty-label">Difficulty</span>
            <div className="sp-difficulty-buttons">
              <button
                className={`btn btn-ghost sp-diff-btn ${difficulty === 'easy' ? 'sp-diff-btn-active' : ''}`}
                onClick={() => setDifficulty('easy')}
              >
                Easy
              </button>
              <button
                className={`btn btn-ghost sp-diff-btn ${difficulty === 'medium' ? 'sp-diff-btn-active' : ''}`}
                onClick={() => setDifficulty('medium')}
              >
                Medium
              </button>
              <button
                className={`btn btn-ghost sp-diff-btn ${difficulty === 'hard' ? 'sp-diff-btn-active' : ''}`}
                onClick={() => setDifficulty('hard')}
              >
                Hard
              </button>
            </div>
          </div>

          <div className="sp-deck-counter font-mono">
            <span className={chosen.length === MAX_DECK ? 'counter-full' : ''}>{chosen.length}</span>
            <span className="counter-sep"> / </span>
            <span>{MAX_DECK}</span>
            <span className="font-label" style={{ marginLeft: '0.5rem', opacity: 0.6 }}>Selected</span>
          </div>

          <section className="sp-minion-grid-section">
            <h2 className="font-display sp-section-title">Available Eggs</h2>
            <div className="sp-minion-grid">
              {ALL_MINIONS.map((minion) => {
                const count = chosen.filter(c => c === minion.id).length
                return (
                  <div
                    key={minion.id}
                    className={`minion-card ${chosen.length >= MAX_DECK && count === 0 ? 'minion-card-disabled' : ''}`}
                    onClick={() => addMinion(minion.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && addMinion(minion.id)}
                  >
                    {count > 0 && (
                      <span className="minion-count-badge font-mono">x{count}</span>
                    )}
                    <div className="minion-img-wrap">
                      <img src={minion.image} alt={minion.name} className="minion-img" />
                    </div>
                    <div className="minion-card-info">
                      <span className="minion-name font-label">{minion.name}</span>
                      <span className="minion-cost font-mono">{minion.cost} Mana</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="sp-chosen-section">
            <h2 className="font-display sp-section-title">Chosen Deck</h2>
            <div className="sp-chosen-cards">
              {chosen.length === 0 && (
                <p className="font-label sp-chosen-empty">Click eggs above to add them to your deck</p>
              )}
              {chosen.map((minionId, index) => {
                const m = ALL_MINIONS.find(x => x.id === minionId)
                return (
                  <div
                    key={`${minionId}-${index}`}
                    className="chosen-card"
                    onClick={() => removeMinion(index)}
                    role="button"
                    tabIndex={0}
                    title="Click to remove"
                    onKeyDown={e => e.key === 'Enter' && removeMinion(index)}
                  >
                    <img src={m.image} alt={m.name} className="chosen-img" />
                    <span className="chosen-name font-label">{m.name}</span>
                    <span className="chosen-cost font-mono">{m.cost}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="sp-deck-actions">
            <button
              className={`btn btn-primary ${chosen.length === MAX_DECK ? 'confirm-btn-ready' : ''}`}
              onClick={startGame}
              disabled={chosen.length !== MAX_DECK}
            >
              {chosen.length === MAX_DECK ? `Start Game vs ${DIFFICULTY_LABELS[difficulty]}` : `Select ${MAX_DECK - chosen.length} more`}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Game Phase ──
  return (
    <div className="gamepage" data-turn={currentTurn} data-is-your-turn={isYourTurn}>
      {/* Top Bar */}
      <header className="gamepage-topbar">
        <div className="topbar-left">
          <span className="topbar-logo font-display">CHEGG</span>
          <span className="topbar-vs font-body">You vs {DIFFICULTY_LABELS[difficulty]}</span>
        </div>
        <div className="topbar-center">
          <TurnIndicator
            currentTurn={currentTurn}
            yourRole={yourRole}
            hostUsername="You"
            guestUsername={DIFFICULTY_LABELS[difficulty]}
            turnNumber={turnNumber}
          />
        </div>
        <div className="topbar-right" />
      </header>

      {/* Main Layout */}
      <div className="gamepage-body">
        <aside className="gamepage-sidebar-left">
          <PlayerPanel {...hostPanel} />
          <div className="sidebar-buttons">
            <button
              className="btn btn-ghost sidebar-btn"
              onClick={() => setShowRules(true)}
            >
              Rules
            </button>
          </div>
          {botThinking && (
            <div className="sp-bot-thinking font-label">
              Bot is thinking...
            </div>
          )}
        </aside>

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

        <aside className="gamepage-sidebar-right">
          <PlayerPanel {...guestPanel} />
        </aside>
      </div>

      {/* Hand */}
      <footer className="gamepage-hand-area">
        <Hand
          hand={yourHand}
          selectedHandIndex={selectedHandIndex}
          onCardSelect={handleCardSelect}
          yourMana={yourMana}
          isYourTurn={isYourTurn}
        />
      </footer>

      {/* Controls */}
      <div className="gamepage-controls">
        {moveError && (
          <div className="sp-move-error font-label">
            {moveError.message}
          </div>
        )}
        <button
          className={`btn ${isYourTurn && !botThinking ? 'btn-primary' : 'btn-ghost'} end-turn-btn`}
          onClick={handleEndTurn}
          disabled={!isYourTurn || botThinking}
        >
          {isYourTurn && !botThinking ? 'End Turn' : botThinking ? 'Bot thinking...' : 'Waiting...'}
        </button>
      </div>

      {/* Overlays */}
      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
      {winData && (
        <WinScreen
          winnerUsername={winData.winner}
          yourUsername="You"
          onRematch={handleRematch}
          onLeave={handleLeave}
        />
      )}
    </div>
  )
}
