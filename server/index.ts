import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts'
import {
  applyPlayerMove,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  type PlayerSocket,
  type Room,
  requestRematch,
  roomSockets,
  snapshotFor,
} from './rooms.ts'

const PORT = Number(process.env.PORT ?? 3001)
const wss = new WebSocketServer({ port: PORT })

function send(socket: PlayerSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function broadcastRoom(room: Room) {
  for (const socket of roomSockets(room)) {
    send(socket, { type: 'room', room: snapshotFor(room, socket.playerId) })
  }
}

wss.on('connection', (raw) => {
  const socket = raw as PlayerSocket
  socket.playerId = randomUUID()
  socket.roomCode = null
  send(socket, { type: 'hello', playerId: socket.playerId })

  socket.on('message', (data) => {
    let msg: ClientMessage
    try {
      msg = JSON.parse(String(data)) as ClientMessage
    } catch {
      send(socket, { type: 'error', message: 'Invalid message' })
      return
    }

    try {
      switch (msg.type) {
        case 'create': {
          const room = createRoom(socket)
          send(socket, { type: 'room', room: snapshotFor(room, socket.playerId) })
          break
        }
        case 'join': {
          const room = joinRoom(socket, msg.code)
          broadcastRoom(room)
          break
        }
        case 'leave': {
          const room = leaveRoom(socket)
          send(socket, { type: 'left' })
          if (room) broadcastRoom(room)
          break
        }
        case 'move': {
          const code = socket.roomCode
          if (!code) throw new Error('You are not in a room')
          const room = getRoom(code)
          if (!room) throw new Error('Room not found')
          applyPlayerMove(room, socket.playerId, msg.from, msg.to, msg.promotion)
          broadcastRoom(room)
          break
        }
        case 'rematch': {
          const code = socket.roomCode
          if (!code) throw new Error('You are not in a room')
          const room = getRoom(code)
          if (!room) throw new Error('Room not found')
          requestRematch(room, socket.playerId)
          broadcastRoom(room)
          break
        }
        default:
          send(socket, { type: 'error', message: 'Unknown message type' })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed'
      send(socket, { type: 'error', message })
    }
  })

  socket.on('close', () => {
    const room = leaveRoom(socket)
    if (room) broadcastRoom(room)
  })
})

console.log(`Augment Chess WebSocket server on ws://localhost:${PORT}`)
