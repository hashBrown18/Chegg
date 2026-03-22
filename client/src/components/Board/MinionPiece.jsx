/**
 * MinionPiece — renders a minion's egg image in the cell
 * Uses actual image files from /images/eggs/
 */
import './MinionPiece.css'

// Map minion type IDs to their egg image filenames
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

export default function MinionPiece({ minion, isSelected, yourRole, isYourTurn }) {
  const imgSrc = MINION_IMAGES[minion.type] || ''
  const isYours = minion.owner === yourRole
  const isOwnedByHost = minion.owner === 'host'

  return (
    <div
      className={[
        'minion-piece',
        isYours ? 'piece-yours' : 'piece-opponent',
        isOwnedByHost ? 'piece-host' : 'piece-guest',
        isSelected ? 'piece-selected' : '',
        isYours && isYourTurn ? 'piece-active' : '',
      ].filter(Boolean).join(' ')}
      title={minion.type.replace(/_/g, ' ')}
    >
      <img
        src={imgSrc}
        alt={minion.type}
        className="piece-img"
        draggable="false"
      />
      <div className={`piece-indicator ${isOwnedByHost ? 'indicator-host' : 'indicator-guest'}`} />
    </div>
  )
}
