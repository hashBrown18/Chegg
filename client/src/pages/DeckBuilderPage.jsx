import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket.js'
import BackgroundSVG from '../components/BackgroundSVG.jsx'
import MinionPopup from '../components/DeckBuilder/MinionPopup.jsx'
import './DeckBuilderPage.css'

// All 11 minions in exact order from CLAUDE.md
// Image files use the filenames from client/public/images/eggs/
const MINIONS = [
  {
    id: 'villager',
    name: 'Villager',
    cost: 0,
    image: '/images/eggs/Vilager.png',
    movement: 'All 8 surrounding squares. Costs 1 mana always.',
    attack: 'All 8 surrounding squares. Moves to the square it attacks.',
    ability: 'KING: Losing this minion = instant game loss.',
    inDeck: false, // Not a deck card — placed at game start for free
  },
  {
    id: 'zombie',
    name: 'Zombie',
    cost: 1,
    image: '/images/eggs/Zombie.png',
    movement: 'Forward only — one of the 3 squares directly ahead.',
    attack: '4 lateral surrounding squares (up, down, left, right). NOT diagonals.',
  },
  {
    id: 'creeper',
    name: 'Creeper',
    cost: 1,
    image: '/images/eggs/Creeper.png',
    movement: 'Any of the 8 surrounding squares.',
    attack: 'EXPLOSION — destroys ALL minions in all 8 surrounding squares including itself. One time use.',
    ability: 'Friendly fire ON. After explosion, Creeper is permanently eliminated.',
  },
  {
    id: 'puffer_fish',
    name: 'Puffer-Fish',
    cost: 2,
    image: '/images/eggs/Pufferfish.png',
    movement: 'Lateral only (up, down, left, right). NOT diagonals.',
    attack: 'Hits ALL 4 diagonal squares simultaneously in one attack.',
    ability: 'Friendly fire ON.',
  },
  {
    id: 'iron_golem',
    name: 'Iron Golem',
    cost: 2,
    image: '/images/eggs/Iron-Golem.png',
    movement: 'Any of the 8 surrounding squares.',
    attack: 'Sweeping — hits 3 adjacent tiles in a chosen lateral direction.',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    cost: 3,
    image: '/images/eggs/Skelton.png',
    movement: 'Lateral only (up, down, left, right).',
    attack: 'Diagonal only, range of 3 squares.',
  },
  {
    id: 'blaze',
    name: 'Blaze',
    cost: 3,
    image: '/images/eggs/Blaze.png',
    movement: 'Diagonal only.',
    attack: 'Lateral only, range of 2 squares. Exact mirror opposite of Skeleton.',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    cost: 3,
    image: '/images/eggs/Phantom.png',
    movement: 'ONLY dark tiles on checkerboard. Can ONLY spawn on dark tile in spawn zone.',
    attack: 'Any tile it can also move to (dark tiles only). Costs 1 mana.',
    ability: 'Restricted to dark tiles permanently.',
  },
  {
    id: 'enderman',
    name: 'Enderman',
    cost: 4,
    image: '/images/eggs/Enderman.png',
    movement: 'CANNOT move normally at all.',
    attack: 'Any of 8 surrounding squares. Costs 1 mana. CANNOT attack same turn as Teleport.',
    ability: 'TELEPORT (1 mana): Swaps positions with ANY minion in any lateral direction regardless of distance. CANNOT target Villager.',
  },
  {
    id: 'shulker_box',
    name: 'Shulker-Box',
    cost: 4,
    image: '/images/eggs/Shulker.png',
    movement: 'CANNOT move freely. Moves ONLY to position of successfully attacked and eliminated minion.',
    attack: 'Long range lateral (up, down, left, right). BLOCKED if any minion is in the path.',
  },
  {
    id: 'wither',
    name: 'Wither',
    cost: 6,
    image: '/images/eggs/Wither.png',
    movement: 'Any of the 8 surrounding squares.',
    attack: 'Shoots projectile in any lateral direction range of 3. On hit damages 4 surrounding tiles. Costs 2 mana.',
    ability: 'ON SPAWN: Destroys EVERYTHING in all 8 surrounding squares. Friendly fire ON.',
  },
]

// Only deck-buildable minions (not Villager)
const DECK_MINIONS = MINIONS.filter(m => m.id !== 'villager')

export default function DeckBuilderPage() {
  const navigate = useNavigate()
  const [chosen, setChosen] = useState([]) // array of minion IDs (with duplicates)
  const [popup, setPopup] = useState(null) // minion info popup
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')

  const MAX_DECK = 15

  useEffect(() => {
    if (!socket.connected) socket.connect()

    socket.on('waiting_for_opponent', ({ message }) => {
      setWaiting(true)
    })

    socket.on('game_start', (data) => {
      // Store initial game data in sessionStorage for GamePage
      sessionStorage.setItem('chegg_game_data', JSON.stringify(data))
      navigate('/game')
    })

    socket.on('error_message', ({ message }) => {
      setError(message)
      setWaiting(false)
    })

    return () => {
      socket.off('waiting_for_opponent')
      socket.off('game_start')
      socket.off('error_message')
    }
  }, [navigate])

  const addMinion = (minionId) => {
    if (chosen.length >= MAX_DECK) return
    setChosen(prev => [...prev, minionId])
  }

  const removeMinion = (index) => {
    setChosen(prev => prev.filter((_, i) => i !== index))
  }

  const confirmDeck = () => {
    if (chosen.length !== MAX_DECK) return
    setError('')
    socket.emit('deck_confirmed', { deck: chosen })
    setWaiting(true)
  }

  const getMinionById = (id) => MINIONS.find(m => m.id === id)

  const countInChosen = (id) => chosen.filter(c => c === id).length

  return (
    <div className="deckbuilder">
      <BackgroundSVG />

      {/* Header */}
      <header className="deckbuilder-header">
        <div className="deckbuilder-header-left">
          <span className="deckbuilder-logo font-display">CHEGG</span>
          <div className="deckbuilder-phase">
            <span className="font-label phase-label">Phase</span>
            <span className="font-label phase-value">Tactical Deployment</span>
          </div>
        </div>
        <div className="deckbuilder-header-right">
          <span className="deck-counter font-mono">
            <span className={chosen.length === MAX_DECK ? 'counter-full' : ''}>{chosen.length}</span>
            <span className="counter-sep"> / </span>
            <span>{MAX_DECK}</span>
          </span>
          <span className="counter-label font-label">Selected</span>
        </div>
      </header>

      <main className="deckbuilder-main">
        {/* Top Section — Available Eggs */}
        <section className="minion-grid-section">
          <div className="section-header">
            <h2 className="section-title font-display">Available Eggs</h2>
            <span className="section-hint font-label">{DECK_MINIONS.length} / {DECK_MINIONS.length} Unlocked</span>
          </div>

          <div className="minion-grid">
            {DECK_MINIONS.map((minion) => {
              const count = countInChosen(minion.id)
              return (
                <div
                  key={minion.id}
                  className={`minion-card ${chosen.length >= MAX_DECK && count === 0 ? 'minion-card-disabled' : ''}`}
                  onClick={() => addMinion(minion.id)}
                  role="button"
                  tabIndex={0}
                  id={`minion-card-${minion.id}`}
                  onKeyDown={e => e.key === 'Enter' && addMinion(minion.id)}
                >
                  {count > 0 && (
                    <span className="minion-count-badge font-mono">×{count}</span>
                  )}
                  <button
                    className="minion-info-btn"
                    onClick={e => { e.stopPropagation(); setPopup(minion) }}
                    title="View details"
                    aria-label={`Info for ${minion.name}`}
                    id={`info-btn-${minion.id}`}
                  >
                    i
                  </button>
                  <div className="minion-img-wrap">
                    <img src={minion.image} alt={minion.name} className="minion-img" />
                  </div>
                  <div className="minion-card-info">
                    <span className="minion-name font-label">{minion.name}</span>
                    <span className="minion-cost font-mono">{minion.cost} Mana</span>
                  </div>
                  <div className="minion-mana-bar">
                    <div
                      className="minion-mana-fill"
                      style={{ width: `${(minion.cost / 6) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Bottom Section — Chosen Deck */}
        <section className="chosen-section">
          <div className="chosen-header">
            <div>
              <h2 className="section-title font-display">Chosen Deck</h2>
              <p className="chosen-subtitle font-body">Active combat units</p>
            </div>
            <div className="chosen-actions">
              {error && <p className="error-msg">{error}</p>}
              {waiting ? (
                <div className="waiting-state">
                  <span className="spinner-small" />
                  <span className="font-label waiting-text">Waiting for opponent...</span>
                </div>
              ) : (
                <button
                  id="btn-confirm-deck"
                  className={`btn btn-primary confirm-btn ${chosen.length === MAX_DECK ? 'confirm-btn-ready' : ''}`}
                  onClick={confirmDeck}
                  disabled={chosen.length !== MAX_DECK}
                >
                  {chosen.length === MAX_DECK ? '⚡ Confirm Deck' : `Select ${MAX_DECK - chosen.length} more`}
                </button>
              )}
            </div>
          </div>

          <div className="chosen-cards">
            {chosen.length === 0 && (
              <p className="chosen-empty font-label">Click eggs above to add them to your deck</p>
            )}
            {chosen.map((minionId, index) => {
              const m = getMinionById(minionId)
              return (
                <div
                  key={`${minionId}-${index}`}
                  className="chosen-card"
                  onClick={() => removeMinion(index)}
                  role="button"
                  tabIndex={0}
                  title="Click to remove"
                  id={`chosen-${index}`}
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
      </main>

      {/* Minion Info Popup Modal */}
      {popup && (
        <MinionPopup minion={popup} onClose={() => setPopup(null)} />
      )}
    </div>
  )
}
