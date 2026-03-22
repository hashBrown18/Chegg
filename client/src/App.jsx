import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LobbyPage from './pages/LobbyPage.jsx'
import DeckBuilderPage from './pages/DeckBuilderPage.jsx'
import GamePage from './pages/GamePage.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<LobbyPage mode="create" />} />
        <Route path="/join" element={<LobbyPage mode="join" />} />
        <Route path="/deck" element={<DeckBuilderPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
