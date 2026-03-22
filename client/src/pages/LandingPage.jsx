import { useNavigate } from 'react-router-dom'
import BackgroundSVG from '../components/BackgroundSVG.jsx'
import './LandingPage.css'

const FEATURES = [
  {
    icon: '⬡',
    title: 'Tactical Depth',
    desc: 'Master the positioning of your ethereal minions on the obsidian grid.',
  },
  {
    icon: '✦',
    title: 'Mana Surge',
    desc: 'Channel raw energy — mana grows each turn up to 6, spent wisely wins.',
  },
  {
    icon: '♚',
    title: 'Protect Your King',
    desc: 'Guard your Villager at all costs. One successful elimination ends the game.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      <BackgroundSVG />

      {/* Header */}
      <header className="landing-header">
        <span className="landing-logo font-display">CHEGG</span>
      </header>

      {/* Hero */}
      <main className="landing-main">
        <p className="landing-eyebrow font-label">Welcome to the Abyss</p>

        <h1 className="landing-title font-display">CHEGG</h1>
        <div className="landing-divider" />
        <p className="landing-subtitle font-body">Chess meets Minecraft</p>

        {/* Feature Cards */}
        <div className="landing-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3 className="feature-title font-label">{f.title}</h3>
              <p className="feature-desc font-body">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="landing-cta">
          <button
            id="btn-join-room"
            className="btn btn-outline landing-btn"
            onClick={() => navigate('/join')}
          >
            Join Room
          </button>
          <button
            id="btn-create-room"
            className="btn btn-outline landing-btn"
            onClick={() => navigate('/create')}
          >
            Create Room
          </button>
        </div>

        <p className="landing-online font-label">2 players per game · Online multiplayer</p>
      </main>
    </div>
  )
}
