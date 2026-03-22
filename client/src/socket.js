import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: false, // We handle reconnection manually per CHEGG spec
})

export default socket
