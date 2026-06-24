import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LobbyPage from './pages/LobbyPage.jsx'
import DeckBuilderPage from './pages/DeckBuilderPage.jsx'
import GamePage from './pages/GamePage.jsx'
import JoinRoomRedirect from './pages/JoinRoomRedirect.jsx'
import SingleplayerPage from './pages/SingleplayerPage.jsx'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<LobbyPage mode="create" />} />
          <Route path="/join" element={<LobbyPage mode="join" />} />
          <Route path="/join/:roomId" element={<JoinRoomRedirect />} />
          <Route path="/deck" element={<DeckBuilderPage />} />
          {/* Both the static /game route (used during normal flow) and the
              dynamic /game/:roomId (used when joining via a shared link) render
              the same GamePage. The component reads the roomId from URL params
              when present, otherwise from sessionStorage. */}
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
