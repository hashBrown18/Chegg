import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LobbyPage from './pages/LobbyPage.jsx'
import DeckBuilderPage from './pages/DeckBuilderPage.jsx'
import GamePage from './pages/GamePage.jsx'
import JoinRoomRedirect from './pages/JoinRoomRedirect.jsx'
import SingleplayerPage from './pages/SingleplayerPage.jsx'
import AboutPage from './pages/AboutPage.jsx'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/create" element={<LobbyPage mode="create" />} />
          <Route path="/join" element={<LobbyPage mode="join" />} />
          <Route path="/join/:roomId" element={<JoinRoomRedirect />} />
          <Route path="/deck" element={<DeckBuilderPage />} />
          {/* Both the static /game route and /game/:roomId render the same
              GamePage. The trailing :playerToken segment is a legacy URL shape
              kept so old shared links still resolve — identity comes from the
              rejoin token in localStorage, never from the URL. */}
          <Route path="/game" element={<GamePage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
          <Route path="/game/:roomId/:playerToken" element={<GamePage />} />
          <Route path="/singleplayer" element={<SingleplayerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
