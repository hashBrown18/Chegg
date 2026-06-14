/**
 * LandingNavbar — Glassmorphic obsidian nav for the landing page
 * Inspired by 21st.dev navbar-navigation components
 */
export default function LandingNavbar({ onRules }) {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        height: '64px',
        background: 'rgba(10, 10, 12, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(74, 74, 82, 0.35)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {/* Chess king icon */}
        <span
          style={{
            fontSize: '1.4rem',
            lineHeight: 1,
            background: 'linear-gradient(135deg, var(--gold), var(--emerald))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.4))',
          }}
        >
          ♔
        </span>
        <span
          className="font-display"
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            background: 'linear-gradient(90deg, var(--gold-bright) 0%, var(--parchment) 50%, var(--gold) 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'shimmer-gold 4s linear infinite',
          }}
        >
          CHEGG
        </span>
      </div>

      {/* Right: tag + rules button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span
          className="font-label"
          style={{
            fontSize: '0.6rem',
            letterSpacing: '0.2em',
            color: 'var(--stone-light)',
            display: 'none',
          }}
        >
          CHESS × MINECRAFT
        </span>
        <button
          id="btn-rules-nav"
          onClick={onRules}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 1rem',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-label)',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: 'transparent',
            color: 'var(--parchment-muted)',
            border: '1px solid rgba(74,74,82,0.5)',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--gold)'
            e.currentTarget.style.color = 'var(--gold-bright)'
            e.currentTarget.style.boxShadow = '0 0 12px rgba(201,168,76,0.2)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(74,74,82,0.5)'
            e.currentTarget.style.color = 'var(--parchment-muted)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          📖 <span>Rules</span>
        </button>
      </div>
    </header>
  )
}
