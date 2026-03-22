import './MinionPopup.css'

export default function MinionPopup({ minion, onClose }) {
  return (
    <div className="popup-overlay animate-fade-in" onClick={onClose}>
      <div
        className="popup-card card-glass animate-fade-in-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${minion.name} details`}
      >
        <button
          id="popup-close-btn"
          className="popup-close"
          onClick={onClose}
          aria-label="Close popup"
        >
          ✕
        </button>

        <div className="popup-body">
          {/* Image */}
          <div className="popup-img-wrap">
            <img src={minion.image} alt={minion.name} className="popup-img" />
          </div>

          {/* Info */}
          <div className="popup-info">
            <h2 className="popup-name font-display">{minion.name}</h2>
            <div className="popup-cost-badge font-mono">
              {minion.cost === 0 ? 'FREE' : `${minion.cost} Mana`}
            </div>

            <div className="popup-stats">
              <div className="popup-stat">
                <span className="popup-stat-label font-label">Movement</span>
                <p className="popup-stat-value font-body">{minion.movement}</p>
              </div>
              <div className="popup-stat">
                <span className="popup-stat-label font-label">Attack</span>
                <p className="popup-stat-value font-body">{minion.attack}</p>
              </div>
              {minion.ability && (
                <div className="popup-stat popup-stat-special">
                  <span className="popup-stat-label font-label">Special Ability</span>
                  <p className="popup-stat-value font-body">{minion.ability}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
