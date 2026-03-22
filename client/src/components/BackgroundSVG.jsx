/**
 * BackgroundSVG — Reusable full-page SVG dot pattern background
 * Used on: Landing, Create Room, Join Room, Deck Builder pages
 * NOT used on Game Page (which is pure black)
 *
 * Reads from client/public/images/UI/background.svg as specified in CLAUDE.md
 */
const BackgroundSVG = () => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
      overflow: 'hidden',
    }}
  >
    <img
      src="/images/UI/background.svg"
      alt=""
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  </div>
)

export default BackgroundSVG
