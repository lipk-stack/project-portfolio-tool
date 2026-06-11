import { io, Socket } from 'socket.io-client'

// Singleton socket shared by all components; connects lazily with the JWT
// from localStorage and reconnects automatically (socket.io default).
let socket: Socket | null = null

export function getSocket(): Socket | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  if (!socket) {
    socket = io({ auth: { token } })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
