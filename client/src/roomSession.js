/**
 * Room identity is per tab. sessionStorage survives a refresh but not a new tab;
 * localStorage survives everything but is shared by every tab of the browser.
 * So:
 *   - the live token is kept in sessionStorage, per tab;
 *   - the fallback for a closed-and-reopened tab is keyed by room code AND role,
 *     so a guest in the same browser can never overwrite the host's token.
 * A fresh tab has no role of its own, so the role is passed in the URL
 * (?role=host) and read here as the last resort.
 */
const ROOM_KEY = 'chegg_room_code'
const ROLE_KEY = 'chegg_role'
const TOKEN_KEY = 'chegg_rejoin_token'
const TOKENS_KEY = 'chegg_room_tokens' // localStorage: { [roomCode]: { host, guest } }

const readTokens = () => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY)) || {}
  } catch {
    return {}
  }
}

const writeToken = (roomCode, role, token) => {
  if (!roomCode || !role || !token) return
  const all = readTokens()
  all[roomCode] = { ...(all[roomCode] || {}), [role]: token }
  localStorage.setItem(TOKENS_KEY, JSON.stringify(all))
}

const deleteToken = (roomCode, role) => {
  if (!roomCode || !role) return
  const all = readTokens()
  if (!all[roomCode]) return
  delete all[roomCode][role]
  if (Object.keys(all[roomCode]).length === 0) delete all[roomCode]
  localStorage.setItem(TOKENS_KEY, JSON.stringify(all))
}

export const getRoomCode = () =>
  sessionStorage.getItem(ROOM_KEY) || localStorage.getItem(ROOM_KEY) || ''

export const getRole = () => sessionStorage.getItem(ROLE_KEY) || ''

export const setRoomSession = (roomCode, role, token) => {
  if (!roomCode) return
  sessionStorage.setItem(ROOM_KEY, roomCode)
  if (role) sessionStorage.setItem(ROLE_KEY, role)
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROOM_KEY, roomCode)
  writeToken(roomCode, role, token)
}

export const getRejoinToken = (roomCode, role) => {
  if (!roomCode || !role) return ''
  if (sessionStorage.getItem(ROLE_KEY) === role) {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (token) return token
  }
  return readTokens()[roomCode]?.[role] || ''
}

export const dropRejoinToken = (roomCode, role) => {
  sessionStorage.removeItem(TOKEN_KEY)
  deleteToken(roomCode, role)
}

export const dropRoomSession = (roomCode, role) => {
  sessionStorage.removeItem(ROOM_KEY)
  sessionStorage.removeItem(ROLE_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  deleteToken(roomCode, role)
  if (localStorage.getItem(ROOM_KEY) === roomCode) localStorage.removeItem(ROOM_KEY)
}
