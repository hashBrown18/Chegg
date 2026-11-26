import { Link } from 'react-router-dom'
import CrownIcon from './CrownIcon.jsx'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link to="/" className="site-footer-brand">
          <CrownIcon size={16} />
          <span>CHEGG</span>
        </Link>
        <span className="site-footer-tag">Chess × Minecraft · Multiplayer Strategy</span>
        <nav className="site-footer-links" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
        </nav>
      </div>
      <p className="site-footer-copy">2 players per game · Built for the block</p>
    </footer>
  )
}
