/** AbandonTimer — countdown shown when opponent disconnects (only appears on disconnect per spec) */
import { useEffect, useState } from 'react'
import './AbandonTimer.css'

export default function AbandonTimer({ initialSeconds = 60, message }) {
  const [secs, setSecs] = useState(initialSeconds)

  useEffect(() => {
    if (secs <= 0) return
    const id = setInterval(() => setSecs(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [secs])

  return (
    <div className="abandon-timer">
      <span className="timer-icon">⚠</span>
      <span className="timer-msg font-body">{message || 'Opponent disconnected'}</span>
      <span className="timer-count font-mono">{secs}s</span>
    </div>
  )
}
