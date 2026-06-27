import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '../types'
import { JWT_SECRET } from '../config/constants'

let io: Server | null = null

// Socket.io server with JWT handshake. Clients join their personal user room
// automatically; project rooms are joined on demand (join:project / leave:project).
export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: process.env.NODE_ENV === 'production'
      ? undefined
      : { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Authentication required'))
    try {
      socket.data.user = jwt.verify(token, JWT_SECRET) as JwtPayload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload
    socket.join(`user:${user.userId}`)

    socket.on('join:project', (projectId: unknown) => {
      const id = Number(projectId)
      if (Number.isInteger(id) && id > 0) socket.join(`project:${id}`)
    })
    socket.on('leave:project', (projectId: unknown) => {
      const id = Number(projectId)
      if (Number.isInteger(id) && id > 0) socket.leave(`project:${id}`)
    })
  })

  return io
}

export function emitToUser(userId: number, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload)
}

export function emitToProject(projectId: number, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload)
}
