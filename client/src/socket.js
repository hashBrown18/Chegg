import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
})

// Server liveness probe. Only a tab that is still running answers, which lets
// the server tell a duplicated tab (alive) from a refresh's leftover socket.
socket.on('__alive', (_payload, ack) => {
  if (typeof ack === 'function') ack()
})

export default socket