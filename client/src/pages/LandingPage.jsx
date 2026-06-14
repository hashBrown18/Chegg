import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlowBackground from '../components/Landing/GlowBackground.jsx'
import LandingNavbar from '../components/Landing/LandingNavbar.jsx'
import HeroSection from '../components/Landing/HeroSection.jsx'
import FeatureCards from '../components/Landing/FeatureCards.jsx'
import RulesPanel from '../components/GameUI/RulesPanel.jsx'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)

  return (
    <div className="landing-v2">
      {/* Animated obsidian + glow background */}
      <GlowBackground />

      {/* Glassmorphic navbar */}
      <LandingNavbar onRules={() => setShowRules(true)} />

      {/* Hero section */}
      <HeroSection
        onJoin={() => navigate('/join')}
        onCreate={() => navigate('/create')}
      />

      {/* Feature cards section */}
      <FeatureCards />

      {/* Footer strip */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="font-display landing-footer-logo">♔ CHEGG</span>
          <span className="font-label landing-footer-tag">
            Chess × Minecraft · Multiplayer Strategy
          </span>
          <button
            id="btn-rules-landing"
            className="landing-footer-rules"
            onClick={() => setShowRules(true)}
          >
            📖 How to Play
          </button>
        </div>
        <div className="landing-footer-line" />
        <p className="font-label landing-footer-copy">
          2 players per game · Created with obsidian & enderpearls
        </p>
      </footer>

      {/* Rules overlay */}
      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
    </div>
  )
}
