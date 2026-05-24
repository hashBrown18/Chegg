import React, { useEffect } from 'react'
import './MoveErrorToast.css'

export default function MoveErrorToast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="move-error-toast" role="alert">
      <div className="toast-content">
        <span className="toast-icon">⚠️</span>
        <span className="toast-message font-label">{message}</span>
      </div>
      <button 
        className="toast-close" 
        onClick={onClose}
        aria-label="Dismiss"
      >
        ×
      </button>
      <div className="toast-progress-bar" />
    </div>
  )
}
