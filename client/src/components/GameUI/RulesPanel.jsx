/**
 * RulesPanel — two-panel scrollable rules panel per spec
 * LEFT: scrollable rules text, synced to right panel minion image on scroll
 * RIGHT: egg image of the currently-scrolling minion section
 * Background: #50207A, Border: #838CE5
 */
import { useState, useRef, useCallback } from 'react'
import './RulesPanel.css'

const MINION_IMAGES = {
  'villager':   '/images/eggs/Vilager.png',
  'zombie':     '/images/eggs/Zombie.png',
  'creeper':    '/images/eggs/Creeper.png',
  'puffer_fish':'/images/eggs/Pufferfish.png',
  'iron_golem': '/images/eggs/Iron-Golem.png',
  'skeleton':   '/images/eggs/Skelton.png',
  'blaze':      '/images/eggs/Blaze.png',
  'phantom':    '/images/eggs/Phantom.png',
  'enderman':   '/images/eggs/Enderman.png',
  'shulker_box': '/images/eggs/Shulker.png',
  'wither':     '/images/eggs/Wither.png',
}

const MINION_COSTS = {
  villager: 'FREE', zombie: 1, creeper: 1, puffer_fish: 2, iron_golem: 2,
  skeleton: 3, blaze: 3, phantom: 3, enderman: 4, shulker_box: 4, wither: 6,
}

const SECTIONS = [
  { id: 'intro', type: 'text' },
  { id: 'villager', type: 'minion', name: 'Villager' },
  { id: 'zombie', type: 'minion', name: 'Zombie' },
  { id: 'creeper', type: 'minion', name: 'Creeper' },
  { id: 'puffer_fish', type: 'minion', name: 'Puffer-Fish' },
  { id: 'iron_golem', type: 'minion', name: 'Iron Golem' },
  { id: 'skeleton', type: 'minion', name: 'Skeleton' },
  { id: 'blaze', type: 'minion', name: 'Blaze' },
  { id: 'phantom', type: 'minion', name: 'Phantom' },
  { id: 'enderman', type: 'minion', name: 'Enderman' },
  { id: 'shulker_box', type: 'minion', name: 'Shulker-Box' },
  { id: 'wither', type: 'minion', name: 'Wither' },
]

export default function RulesPanel({ onClose }) {
  const [activeMinion, setActiveMinion] = useState(null)
  const scrollRef = useRef(null)
  const sectionRefs = useRef({})

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const containerTop = container.getBoundingClientRect().top

    let closest = null
    let closestDist = Infinity
    SECTIONS.forEach(({ id, type }) => {
      const el = sectionRefs.current[id]
      if (!el || type !== 'minion') return
      const dist = Math.abs(el.getBoundingClientRect().top - containerTop)
      if (dist < closestDist) { closestDist = dist; closest = id }
    })
    if (closest !== activeMinion) setActiveMinion(closest)
  }, [activeMinion])

  return (
    <div className="rules-overlay animate-fade-in">
      <div className="rules-modal animate-fade-in-up">
        {/* Header */}
        <div className="rules-modal-header">
          <h2 className="rules-title font-display">Rule Book</h2>
          <button
            id="rules-close-btn"
            className="rules-close-btn"
            onClick={onClose}
            aria-label="Close rule book"
          >
            ✕
          </button>
        </div>

        <div className="rules-body">
          {/* Left: scrollable text */}
          <div
            className="rules-left"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {/* ── INTRO ── */}
            <section ref={el => sectionRefs.current['intro'] = el}>
              <h3 className="rules-section-title font-display">CHEGG — How to Play</h3>

              <h4 className="rules-h4 font-label">Objective</h4>
              <p className="rules-p">Eliminate your opponent's Villager to win the game. If your Villager is eliminated, you lose.</p>

              <h4 className="rules-h4 font-label">The Board</h4>
              <p className="rules-p">CHEGG is played on a 10×8 checkerboard. The last 2 rows on your side are your Spawn Zone — the only place you can place new minions. Once spawned, minions can move anywhere on the board.</p>

              <h4 className="rules-h4 font-label">Mana</h4>
              <p className="rules-p">Each player has a mana pool that grows each turn:</p>
              <ul className="rules-list">
                <li>Turn 1: 1 mana</li>
                <li>Turn 2: 2 mana</li>
                <li>Turn 3: 3 mana</li>
                <li>Turn 4: 4 mana</li>
                <li>Turn 5: 5 mana</li>
                <li>Turn 6+: 6 mana (maximum)</li>
              </ul>
              <p className="rules-p">Unused mana is discarded at end of turn. It never carries over.</p>

              <h4 className="rules-h4 font-label">Your Turn</h4>
              <p className="rules-p">Each turn you automatically draw 1 card. You can then:</p>
              <ul className="rules-list">
                <li>Spawn minions from your hand into your spawn zone (costs mana equal to minion cost)</li>
                <li>Move minions already on the board (1 free move per minion)</li>
                <li>Attack with minions (costs 1 mana per attack)</li>
                <li>Use special abilities (cost listed per minion)</li>
                <li>Click End Turn when done</li>
              </ul>

              <h4 className="rules-h4 font-label">Important Rules</h4>
              <ul className="rules-list">
                <li>Minions spawned this turn cannot act until next turn</li>
                <li>A minion cannot both move AND attack in the same turn</li>
                <li>A minion cannot move after attacking</li>
                <li>Each minion can only attack once per turn</li>
                <li>The Villager costs 1 mana to move (no free movement)</li>
              </ul>

              <h4 className="rules-h4 font-label">Deck</h4>
              <p className="rules-p">Before the game starts you choose 15 minions for your deck. You draw 3 cards at the start. Duplicates are allowed. Your opponent cannot see your deck or hand.</p>

              <h4 className="rules-h4 font-label">Clicking Minions</h4>
              <p className="rules-p">Click your own minion to see valid moves (green) and attack range (red). Opponent minion ranges are hidden.</p>
            </section>

            {/* ── MINIONS ── */}
            <h3 className="rules-section-title font-display" style={{ marginTop: '2rem' }}>Minions</h3>

            {[
              { id: 'villager', cost: 'FREE', movement: 'All 8 surrounding squares. Costs 1 mana always.', attack: 'All 8 surrounding squares. Moves to the square it attacks.', special: 'Losing the Villager = instant game loss.' },
              { id: 'zombie', cost: '1', movement: 'Forward only — one of the 3 squares directly ahead.', attack: '4 lateral surrounding squares (up, down, left, right). NOT diagonals.' },
              { id: 'creeper', cost: '1', movement: 'Any of the 8 surrounding squares.', attack: 'EXPLOSION — destroys ALL minions in all 8 surrounding squares including itself. One time use.', special: 'Friendly fire ON. Self-destructs on attack.' },
              { id: 'puffer_fish', cost: '2', movement: 'Lateral only (up, down, left, right). NOT diagonals.', attack: 'Hits ALL 4 diagonal squares simultaneously in one attack. Friendly fire ON.' },
              { id: 'iron_golem', cost: '2', movement: 'Any of the 8 surrounding squares.', attack: 'Sweeping — hits 3 adjacent tiles in a chosen lateral direction.' },
              { id: 'skeleton', cost: '3', movement: 'Lateral only (up, down, left, right).', attack: 'Diagonal only, range of 3 squares.' },
              { id: 'blaze', cost: '3', movement: 'Diagonal only.', attack: 'Lateral only, range of 2 squares. Exact mirror opposite of Skeleton.' },
              { id: 'phantom', cost: '3', movement: 'ONLY dark tiles on checkerboard.', attack: 'Any tile it can also move to (dark tiles only). Costs 1 mana.', special: 'Can only spawn on dark tile. Restricted to dark tiles permanently.' },
              { id: 'enderman', cost: '4', movement: 'CANNOT move normally at all.', attack: 'Any of 8 surrounding squares. Cannot attack same turn as Teleport.', special: 'TELEPORT (1 mana): Swap places with any minion in any lateral direction regardless of distance. Cannot target Villager.' },
              { id: 'shulker_box', cost: '4', movement: 'Cannot move freely — moves only to position of successfully attacked minion.', attack: 'Long range lateral, blocked if another minion is in the way.' },
              { id: 'wither', cost: '6', movement: 'Any of the 8 surrounding squares.', attack: 'Ranged projectile lateral range 3, damages 4 surrounding tiles on hit. Costs 2 mana.', special: 'ON SPAWN: Destroys everything in 8 surrounding squares. Friendly fire ON.' },
            ].map(m => (
              <section
                key={m.id}
                ref={el => sectionRefs.current[m.id] = el}
                className="rules-minion-section"
              >
                <div className="rules-minion-header">
                  <img
                    src={MINION_IMAGES[m.id]}
                    alt={m.id}
                    className="rules-minion-thumb"
                  />
                  <div>
                    <h4 className="rules-minion-name font-display">
                      {m.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      <span className="rules-minion-cost font-mono"> — {m.cost}</span>
                    </h4>
                  </div>
                </div>
                <p className="rules-p"><strong>Movement:</strong> {m.movement}</p>
                <p className="rules-p"><strong>Attack:</strong> {m.attack}</p>
                {m.special && <p className="rules-p rules-special"><strong>Special:</strong> {m.special}</p>}
              </section>
            ))}

            <div className="rules-ff-warning">
              <span>⚠ Friendly Fire Warning: Creeper, Puffer-Fish, and Wither can damage your own minions. Be careful.</span>
            </div>
          </div>

          {/* Right: egg display panel */}
          <div className="rules-right">
            {activeMinion ? (
              <>
                <img
                  src={MINION_IMAGES[activeMinion]}
                  alt={activeMinion}
                  className="rules-egg-img"
                />
                <p className="rules-egg-name font-display">
                  {activeMinion.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </p>
                <p className="rules-egg-cost font-mono">
                  {MINION_COSTS[activeMinion] !== undefined ? (MINION_COSTS[activeMinion] === 'FREE' ? 'FREE' : `${MINION_COSTS[activeMinion]} Mana`) : ''}
                </p>
              </>
            ) : (
              <p className="rules-egg-placeholder font-label">Scroll to see<br />minion details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
