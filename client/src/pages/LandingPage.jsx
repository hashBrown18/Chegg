import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlowBackground from '../components/Landing/GlowBackground.jsx'
import LandingNavbar from '../components/Landing/LandingNavbar.jsx'
import HeroSection from '../components/Landing/HeroSection.jsx'
import FeatureCards from '../components/Landing/FeatureCards.jsx'
import SiteFooter from '../components/Landing/SiteFooter.jsx'
import RulesPanel from '../components/GameUI/RulesPanel.jsx'
import './LandingPage.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const [showRules, setShowRules] = useState(false)

  return (
    <div className="site-page">
      <GlowBackground />

      <LandingNavbar onRules={() => setShowRules(true)} />

      <main className="site-main">
        <HeroSection
          onJoin={() => navigate('/join')}
          onCreate={() => navigate('/create')}
          onSingleplayer={() => navigate('/singleplayer')}
        />

        <FeatureCards />
      </main>

      <SiteFooter />

      {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
    </div>
  )
}
