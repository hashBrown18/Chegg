import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GlowBackground from '../components/Landing/GlowBackground.jsx'
import LandingNavbar from '../components/Landing/LandingNavbar.jsx'
import SiteFooter from '../components/Landing/SiteFooter.jsx'
import CrownIcon from '../components/Landing/CrownIcon.jsx'
import RulesPanel from '../components/GameUI/RulesPanel.jsx'
import './LandingPage.css'

const PILLARS = [
  {
    tag: '01',
    title: 'Build your deck',
    body: 'Fifteen minions, eleven species, duplicates allowed. What you bring decides how you fight. Your opponent never sees it coming.',
  },
  {
    tag: '02',
    title: 'Control the board',
    body: 'Spawn behind your lines, then push into neutral ground. Mana caps at six and refills every turn — spend it all or lose it.',
  },
  {
    tag: '03',
    title: 'Hunt the Villager',
    body: 'One elimination ends the world. Protect your king, break the enemy formation, and take the square that matters.',
  },
]

export default function AboutPage() {
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)

  return (
    <div className="site-page about-page">
      <GlowBackground />

      <LandingNavbar onRules={() => setShowRules(true)} />

      <main className="site-main">
        <section className="about-hero">
          <span className="hero-eyebrow">About Chegg</span>
          <h1 className="about-title">
            Chess, rebuilt <span>for the block.</span>
          </h1>
          <p className="about-lead">
            CHEGG is a turn-based, deck-building strategy game for two players.
            Build a deck of fifteen minions, summon them to an 8×10 board, and
            outmanoeuvre your opponent before they reach your Villager.
          </p>
          <div className="about-actions">
            <button type="button" className="cta cta-filled" onClick={() => navigate('/join')}>
              Join Room
            </button>
            <button type="button" className="cta cta-outline" onClick={() => navigate('/singleplayer')}>
              Play Solo
            </button>
          </div>
        </section>

        <section className="about-pillars" aria-label="How CHEGG plays">
          {PILLARS.map((p) => (
            <div className="about-pillar" key={p.tag}>
              <span className="about-pillar-tag">{p.tag}</span>
              <h2>{p.title}</h2>
              <p>{p.body}</p>
            </div>
          ))}
        </section>

        <section className="about-note">
          <span className="about-note-icon"><CrownIcon size={22} /></span>
          <div>
            <h2>One board. Two minds. No second chances.</h2>
            <p>
              Every minion moves differently, every attack costs mana, and a
              single misstep can expose your king. Learn the pieces in the
              Rule Book, then take the board.
            </p>
          </div>
          <button type="button" className="cta cta-outline" onClick={() => setShowRules(true)}>
            Open Rules
          </button>
        </section>

        <div className="crown-divider" aria-hidden="true">
          <span className="crown-divider-line" />
          <span className="crown-divider-mark"><CrownIcon size={20} /></span>
          <span className="crown-divider-line" />
        </div>

        <p className="about-back">
          <Link to="/">← Back to home</Link>
        </p>
      </main>

      <SiteFooter />

      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
    </div>
  )
}
