/**
 * Hand — the player's cards displayed at the bottom of the screen
 * Spec: horizontal scrollable row, each card shows egg image + mana cost badge
 * Server NEVER sends opponent hand cards — only shown for your own hand
 */
import './Hand.css'

const MINION_IMAGES = {
  villager:   '/images/eggs/Vilager.png',
  zombie:     '/images/eggs/Zombie.png',
  creeper:    '/images/eggs/Creeper.png',
  puffer_fish:'/images/eggs/Pufferfish.png',
  iron_golem: '/images/eggs/Iron-Golem.png',
  skeleton:   '/images/eggs/Skelton.png',
  blaze:      '/images/eggs/Blaze.png',
  phantom:    '/images/eggs/Phantom.png',
  enderman:   '/images/eggs/Enderman.png',
  shulker_box:'/images/eggs/Shulker.png',
  wither:     '/images/eggs/Wither.png',
}

const MINION_COSTS = {
  villager: 0, zombie: 1, creeper: 1, puffer_fish: 2, iron_golem: 2,
  skeleton: 3, blaze: 3, phantom: 3, enderman: 4, shulker_box: 4, wither: 6,
}

export default function Hand({ hand, selectedHandIndex, onCardSelect, yourMana, isYourTurn }) {
  if (!hand || hand.length === 0) {
    return (
      <div className="hand-container">
        <span className="hand-label font-label">Your Eggs</span>
        <div className="hand-cards">
          <p className="hand-empty font-label">No cards in hand</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hand-container">
      <span className="hand-label font-label">Your Eggs</span>
      <div className="hand-cards">
        {hand.map((minionId, index) => {
          const cost = MINION_COSTS[minionId] ?? 0
          const canAfford = yourMana >= cost
          const isSelected = index === selectedHandIndex

          return (
            <div
              key={`${minionId}-${index}`}
              id={`hand-card-${index}`}
              className={[
                'hand-card',
                isSelected ? 'hand-card-selected' : '',
                !canAfford ? 'hand-card-unaffordable' : '',
                !isYourTurn ? 'hand-card-disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => isYourTurn && onCardSelect(index)}
              role="button"
              tabIndex={isYourTurn ? 0 : -1}
              aria-label={`${minionId} card, costs ${cost} mana`}
              onKeyDown={e => e.key === 'Enter' && isYourTurn && onCardSelect(index)}
            >
              {/* Mana cost badge */}
              <span className="hand-cost-badge font-mono">{cost}</span>

              {/* Egg image */}
              <div className="hand-card-img-wrap">
                <img
                  src={MINION_IMAGES[minionId] || ''}
                  alt={minionId}
                  className="hand-card-img"
                />
              </div>

              {/* Name */}
              <span className="hand-card-name font-label">
                {minionId.replace(/_/g, ' ')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
