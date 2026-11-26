import { Link, NavLink } from 'react-router-dom'

function CrownFilled() {
  return (
    <svg width="26" height="20" viewBox="0 0 32 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M2 5.5 8.6 12 15.9 1.8 23.2 12 29.8 5.5 26.6 20H5.2L2 5.5z" />
      <rect x="6.2" y="21.2" width="19.6" height="1.8" rx="0.9" />
    </svg>
  )
}

function RulesArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}

export default function LandingNavbar({ onRules }) {
  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <Link to="/" className="site-brand" aria-label="CHEGG home">
          <span className="site-brand-mark"><CrownFilled /></span>
          <span className="site-brand-name">CHEGG</span>
        </Link>

        <nav className="site-nav-links" aria-label="Primary">
          <NavLink end to="/" className={({ isActive }) => `site-nav-link${isActive ? ' is-active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `site-nav-link${isActive ? ' is-active' : ''}`}>
            About
          </NavLink>
        </nav>

        <button id="btn-rules-nav" type="button" className="site-rules-btn" onClick={onRules} aria-label="Rules">
          <span>Rules</span>
          <RulesArrow />
        </button>
      </div>
    </header>
  )
}
