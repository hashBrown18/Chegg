/**
 * Room identity is per-tab. sessionStorage survives a refresh but not a new tab;
 * localStorage survives everything but is shared by every tab of the browser,
 * so two players in two tabs overwrite each other's token and both sockets end
 * up claiming the same seat. Read session first, keep localStorage as the
 * fallback for a tab that was closed and reopened.
 */
const read = (key) => sessionStorage.getItem(key) || localStorage.getItem(key) || ''

const write = (key, value) => {
  if (!value) return
  sessionStorage.setItem(key, value)
  localStorage.setItem(key, value)
}

const drop = (key) => {
  sessionStorage.removeItem(key)
  localStorage.removeItem(key)
}

export const getRoomCode = () => read('chegg_room_code')
export const setRoomCode = (code) => write('chegg_room_code', code)
export const getRejoinToken = () => read('chegg_rejoin_token')
export const setRejoinToken = (token) => write('chegg_rejoin_token', token)
export const dropRejoinToken = () => drop('chegg_rejoin_token')
export const dropRoomSession = () => {
  drop('chegg_room_code')
  drop('chegg_rejoin_token')
}
