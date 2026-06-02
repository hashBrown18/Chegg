/**
 * JoinRoomRedirect.jsx — Handles /join/:roomId
 *
 * When a player clicks a shared link like /join/jhgf7345, this page redirects
 * to /join and stashes the code in sessionStorage so the LobbyPage can
 * pre-fill the "Room Code" field.
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export default function JoinRoomRedirect() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (roomId) {
      try {
        sessionStorage.setItem('chegg_prefill_room_code', roomId.toLowerCase())
      } catch {
        // ignore — sessionStorage unavailable
      }
    }
    navigate('/join', { replace: true })
  }, [roomId, navigate])

  return (
    <div className="gamepage-loading">
      <span className="font-label">Joining room…</span>
    </div>
  )
}
