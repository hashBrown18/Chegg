/**
 * FeatureCards — three mechanic cards.
 * The scroll-reveal and mouse-tilt hover are the same animation the cards
 * used before, retuned to the purple palette.
 */
import { useRef, useCallback } from 'react'
import { useScrollReveal } from './useScrollReveal'
import CrownIcon from './CrownIcon.jsx'

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
    </svg>
  )
}

function ManaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 2.5 21 12l-9 9.5L3 12l9-9.5z" />
      <path d="M12 7.5 16.5 12 12 16.5 7.5 12 12 7.5z" />
    </svg>
  )
}

function KingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M3 8l4 4 5-7 5 7 4-4-2 10H5L3 8z" />
      <path d="M5 21h14" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

const FEATURES = [
  {
    id: 'tactical-grid',
    tag: 'Tactics',
    Icon: GridIcon,
    title: 'Tactical Grid',
    subtitle: 'Chess Movement, Survival Terrain',
    desc: 'Every piece follows chess movement rules — but the board is a living Minecraft biome. Block your enemy, harvest resources, control the centre.',
    offsetX: '-80px',
    offsetY: '0px',
    duration: '0.7s',
    delay: '0s',
  },
  {
    id: 'mana-engine',
    tag: 'Resource',
    Icon: ManaIcon,
    title: 'Mana Engine',
    subtitle: 'The Energy of Creation',
    desc: 'Mana grows each turn up to 6 crystals. Spend wisely — summon powerful pieces, craft abilities, or hold reserves for a devastating counter-surge.',
    offsetX: '0px',
    offsetY: '40px',
    duration: '0.7s',
    delay: '0.1s',
  },
  {
    id: 'protect-king',
    tag: 'Victory',
    Icon: KingIcon,
    title: 'Protect Your King',
    subtitle: 'Guard the Villager. Win the World.',
    desc: 'Your Villager is your king. Let it fall and the world ends. Sacrifice pieces, build defences, and hunt theirs down. One elimination. Game over.',
    offsetX: '80px',
    offsetY: '0px',
    duration: '0.7s',
    delay: '0.2s',
  },
]

export default function FeatureCards() {
  return (
    <section className="features" id="mechanics">
      <div className="features-head">
        <span className="section-label">
          <i className="section-label-line" aria-hidden="true" />
          <span>Game Mechanics</span>
          <i className="section-label-line" aria-hidden="true" />
        </span>
        <h2 className="features-title">
          Three Systems. <span>One Battlefield.</span>
        </h2>
        <p className="features-sub">
          Movement, mana, and victory — three interlocking systems that decide every match.
        </p>
      </div>

      <div className="features-grid">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>

      <div className="crown-divider" aria-hidden="true">
        <span className="crown-divider-line" />
        <span className="crown-divider-mark"><CrownIcon size={20} /></span>
        <span className="crown-divider-line" />
      </div>
    </section>
  )
}

function FeatureCard({ feature: f }) {
  const cardRef = useRef(null)
  const { ref, style: revealStyle, revealed } = useScrollReveal({
    offsetX: f.offsetX,
    offsetY: f.offsetY,
    delay: f.delay,
    duration: f.duration,
  })

  const setRefs = useCallback(
    (node) => {
      ref.current = node
      cardRef.current = node
    },
    [ref]
  )

  const handleMouseMove = (e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -8
    const rotateY = ((x - centerX) / centerX) * 8
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`
  }

  const handleMouseLeave = () => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)'
    card.style.borderColor = 'rgba(139, 61, 255, 0.18)'
    card.style.boxShadow = '0 2px 16px rgba(0, 0, 0, 0.3)'
    card.style.background = 'rgba(17, 15, 23, 0.75)'
  }

  const handleMouseEnter = () => {
    const card = cardRef.current
    if (!card) return
    card.style.borderColor = 'rgba(139, 61, 255, 0.55)'
    card.style.boxShadow = '0 0 32px rgba(139, 61, 255, 0.16), 0 4px 24px rgba(0, 0, 0, 0.4)'
    card.style.background = 'rgba(23, 19, 32, 0.95)'
  }

  const transitionStyle = revealed
    ? 'transform 0.15s ease-out, opacity 0.28s var(--ease-out), background 0.28s var(--ease-out), border-color 0.28s var(--ease-out), box-shadow 0.28s var(--ease-out)'
    : `${revealStyle.transition}, background 0.28s var(--ease-out), border-color 0.28s var(--ease-out), box-shadow 0.28s var(--ease-out)`

  return (
    <article
      ref={setRefs}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="feature-card"
      style={{
        ...revealStyle,
        position: 'relative',
        background: 'rgba(17, 15, 23, 0.75)',
        border: '1px solid rgba(139, 61, 255, 0.18)',
        borderRadius: '1rem',
        padding: '2rem 1.75rem',
        cursor: 'default',
        transition: transitionStyle,
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="feature-card-top">
        <span className="feature-icon"><f.Icon /></span>
        <span className="feature-tag">{f.tag}</span>
      </div>

      <h3 className="feature-title">{f.title}</h3>
      <p className="feature-subtitle">{f.subtitle}</p>
      <p className="feature-desc">{f.desc}</p>

      <span className="feature-arrow" aria-hidden="true"><ArrowIcon /></span>
    </article>
  )
}
