/**
 * FeatureCards — Bento-style feature grid for CHEGG
 * 3 stone-slab cards with gold icon borders, emerald hover glow.
 * Scroll-reveal + mouse tilt effect.
 */

import { useRef, useCallback } from 'react'
import { useScrollReveal } from './useScrollReveal'

const FEATURES = [
  {
    id: 'tactical-grid',
    icon: '⬡',
    chessIcon: '♞',
    title: 'Tactical Grid',
    subtitle: 'Chess Movement, Survival Terrain',
    desc: 'Every piece follows chess movement rules — but the board is a living Minecraft biome. Block your enemy, harvest resources, control the centre.',
    accentColor: 'var(--emerald)',
    glowColor: 'rgba(16,185,129,0.15)',
    borderHover: 'rgba(52,211,153,0.4)',
    offsetX: '-80px',
    offsetY: '0px',
    duration: '0.7s',
    delay: '0s',
  },
  {
    id: 'mana-engine',
    icon: '✦',
    chessIcon: '♛',
    title: 'Mana Engine',
    subtitle: 'The Energy of Creation',
    desc: 'Mana grows each turn up to 6 crystals. Spend wisely — summon powerful pieces, craft abilities, or hold reserves for a devastating counter-surge.',
    accentColor: 'var(--gold)',
    glowColor: 'rgba(201,168,76,0.15)',
    borderHover: 'rgba(240,192,64,0.4)',
    featured: true,
    offsetX: '0px',
    offsetY: '40px',
    duration: '0.7s',
    delay: '0.1s',
  },
  {
    id: 'protect-king',
    icon: '♚',
    chessIcon: '♔',
    title: 'Protect Your King',
    subtitle: 'Guard the Villager. Win the World.',
    desc: 'Your Villager is your king. Let it fall and the world ends. Sacrifice pieces, build defences, and hunt theirs down. One elimination. Game over.',
    accentColor: 'var(--emerald)',
    glowColor: 'rgba(16,185,129,0.15)',
    borderHover: 'rgba(52,211,153,0.4)',
    offsetX: '80px',
    offsetY: '0px',
    duration: '0.7s',
    delay: '0.2s',
  },
]

export default function FeatureCards() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '0 2rem 6rem',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Section heading */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '3rem',
          animation: 'fadeInUp 0.5s var(--ease-out) both',
        }}
      >
        <p
          className="font-label"
          style={{
            fontSize: '0.6rem',
            letterSpacing: '0.25em',
            color: 'var(--emerald)',
            marginBottom: '0.75rem',
          }}
        >
          GAME MECHANICS
        </p>
        <h2
          className="font-display"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 700,
            color: 'var(--parchment)',
            lineHeight: 1.15,
          }}
        >
          Three Systems. One Battlefield.
        </h2>
      </div>

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {FEATURES.map((f) => (
          <FeatureCard key={f.id} feature={f} />
        ))}
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

  const handleMouseLeave = (e) => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)'
    card.style.borderColor = 'rgba(74,74,82,0.35)'
    card.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)'
    card.style.background = f.featured
      ? 'rgba(26,26,30,0.85)'
      : 'rgba(17,17,20,0.75)'
  }

  const handleMouseEnter = (e) => {
    const card = cardRef.current
    if (!card) return
    card.style.borderColor = f.borderHover
    card.style.boxShadow = `0 0 32px ${f.glowColor}, 0 4px 24px rgba(0,0,0,0.4)`
    card.style.background = 'rgba(26,26,30,0.95)'
  }

  const transitionStyle = revealed
    ? 'transform 0.15s ease-out, opacity 0.28s var(--ease-out), background 0.28s var(--ease-out), border-color 0.28s var(--ease-out), box-shadow 0.28s var(--ease-out)'
    : `${revealStyle.transition}, background 0.28s var(--ease-out), border-color 0.28s var(--ease-out), box-shadow 0.28s var(--ease-out)`

  return (
    <div
      ref={setRefs}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...revealStyle,
        position: 'relative',
        background: f.featured ? 'rgba(26,26,30,0.85)' : 'rgba(17,17,20,0.75)',
        border: `1px solid ${f.featured ? 'rgba(201,168,76,0.3)' : 'rgba(74,74,82,0.35)'}`,
        borderRadius: '1rem',
        padding: '2rem 1.75rem',
        cursor: 'default',
        transition: transitionStyle,
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Featured star badge */}
      {f.featured && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            fontSize: '0.6rem',
            fontFamily: 'var(--font-label)',
            letterSpacing: '0.15em',
            color: 'var(--gold)',
            background: 'rgba(201,168,76,0.1)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '999px',
            padding: '0.2rem 0.6rem',
          }}
        >
          CORE MECHANIC
        </div>
      )}

      {/* Icon area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* Hexagon icon container */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '0.625rem',
            background: `${f.glowColor}`,
            border: `1px solid ${f.accentColor}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            color: f.accentColor,
            flexShrink: 0,
            boxShadow: `0 0 16px ${f.glowColor}`,
          }}
        >
          {f.icon}
        </div>
        <span
          style={{
            fontSize: '2rem',
            opacity: 0.12,
            color: f.accentColor,
            lineHeight: 1,
          }}
        >
          {f.chessIcon}
        </span>
      </div>

      {/* Text */}
      <h3
        className="font-display"
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: 'var(--parchment)',
          marginBottom: '0.3rem',
          lineHeight: 1.2,
        }}
      >
        {f.title}
      </h3>
      <p
        className="font-label"
        style={{
          fontSize: '0.58rem',
          letterSpacing: '0.18em',
          color: f.accentColor,
          marginBottom: '0.875rem',
          opacity: 0.85,
        }}
      >
        {f.subtitle}
      </p>
      <p
        className="font-body"
        style={{
          fontSize: '0.875rem',
          color: 'var(--stone-light)',
          lineHeight: 1.65,
        }}
      >
        {f.desc}
      </p>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${f.accentColor}60, transparent)`,
          borderRadius: '0 0 1rem 1rem',
        }}
      />
    </div>
  )
}
