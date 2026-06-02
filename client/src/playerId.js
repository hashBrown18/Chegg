/**
 * playerId.js — Stable per-browser player identifier.
 *
 * Generated once and stored in localStorage. Used by the backend to match a
 * reconnecting socket to the correct host/guest slot in a room, even after a
 * full page reload or socket disconnect.
 *
 * Format: RFC 4122 v4 UUID (lowercase, URL-safe).
 */
const STORAGE_KEY = 'chegg_player_id'

export function getOrCreatePlayerId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length >= 16) return existing
  } catch {
    // localStorage may be disabled — fall through to a session-only id.
  }

  const id = generateUuidV4()
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // ignore — in-memory session fallback below
  }
  return id
}

function generateUuidV4() {
  // crypto.randomUUID is available in modern browsers; fall back to
  // crypto.getRandomValues if needed.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Per RFC 4122 §4.4 — set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return (
    hex.slice(0, 8) + '-' +
    hex.slice(8, 12) + '-' +
    hex.slice(12, 16) + '-' +
    hex.slice(16, 20) + '-' +
    hex.slice(20, 32)
  )
}

export const PLAYER_ID_STORAGE_KEY = STORAGE_KEY
