/**
 * HeroSection — reference-matched split hero.
 * Content sits left, the king fills the right side and is cropped by the
 * bottom of the first screen.
 */
function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M6 3.5v17l15-8.5-15-8.5z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M12 4v16M4 12h16" />
    </svg>
  )
}

function GamepadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 4a3 3 0 0 1-5.1 1.5L13.5 16h-3L9 17.9a3 3 0 0 1-5.1-1.5l-.8-4A4.5 4.5 0 0 1 7.5 7z" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="16" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function MouseIcon() {
  return (
    <svg width="15" height="23" viewBox="0 0 20 30" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="18" height="28" rx="9" />
      <path d="M10 6.5v4" strokeLinecap="round" />
    </svg>
  )
}

export default function HeroSection({ onJoin, onCreate, onSingleplayer }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">
          <i className="hero-eyebrow-line" aria-hidden="true" />
          <span>CHESS × MINECRAFT</span>
        </span>

        <h1 className="hero-title">
          <span>CHE</span><span className="hero-title-accent">GG</span>
        </h1>

        <p className="hero-tagline">Command your pieces. Harvest your world.</p>

        <div className="hero-actions">
          <button type="button" className="cta cta-filled" onClick={onJoin}>
            <PlayIcon />
            <span>Join Room</span>
          </button>
          <button type="button" className="cta cta-outline" onClick={onCreate}>
            <span className="cta-plus"><PlusIcon /></span>
            <span>Create Room</span>
          </button>
        </div>

        <button type="button" className="cta cta-outline cta-single" onClick={onSingleplayer}>
          <span className="cta-plus"><GamepadIcon /></span>
          <span>Singleplayer</span>
        </button>
      </div>

      <div className="hero-art" aria-hidden="true">
        <div className="hero-ring" />
        <img className="hero-king" src="/images/king-cutout.png" alt="" draggable="false" />
      </div>

      <div className="hero-scroll" aria-hidden="true">
        <i className="hero-scroll-bar" />
        <MouseIcon />
        <span>Scroll to explore</span>
      </div>
    </section>
  )
}
