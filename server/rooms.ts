import type { WebSocket } from 'ws'
import {
  createGame,
  getLegalMoves,
  makeMove,
  pickDraftCard,
  useCoronation,
} from '../src/engine/game.ts'
import type { AugmentId, Color, GameState, PieceType } from '../src/engine/types.ts'
import type { RoomSnapshot, RoomStatus } from '../shared/protocol.ts'

export interface PlayerSocket extends WebSocket {
  playerId: string
  roomCode: string | null
}

interface Seat {
  playerId: string
  socket: PlayerSocket
}

export interface Room {
  code: string
  white: Seat | null
  black: Seat | null
  game: GameState | null
  status: RoomStatus
  rematchVotes: Set<Color>
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const rooms = new Map<string, Room>()

function generateCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    }
    if (!rooms.has(code)) return code
  }
  throw new Error('Could not allocate room code')
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase())
}

export function createRoom(socket: PlayerSocket): Room {
  leaveRoom(socket)

  const code = generateCode()
  const room: Room = {
    code,
    white: { playerId: socket.playerId, socket },
    black: null,
    game: null,
    status: 'waiting',
    rematchVotes: new Set(),
  }
  rooms.set(code, room)
  socket.roomCode = code
  return room
}

export function joinRoom(socket: PlayerSocket, rawCode: string): Room {
  const code = rawCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    throw new Error('Enter a valid 4-character room code')
  }

  const room = rooms.get(code)
  if (!room) throw new Error('Room not found')

  if (
    room.white?.playerId === socket.playerId ||
    room.black?.playerId === socket.playerId
  ) {
    return room
  }

  leaveRoom(socket)

  if (!room.white) {
    room.white = { playerId: socket.playerId, socket }
  } else if (!room.black) {
    room.black = { playerId: socket.playerId, socket }
  } else {
    throw new Error('Room is full')
  }

  socket.roomCode = code

  if (room.white && room.black && !room.game) {
    room.game = createGame()
    room.status = 'playing'
    room.rematchVotes.clear()
  } else if (room.white && room.black && room.game && !room.game.result) {
    room.status = 'playing'
  }

  return room
}

export function leaveRoom(socket: PlayerSocket): Room | null {
  const code = socket.roomCode
  if (!code) return null

  const room = rooms.get(code)
  socket.roomCode = null
  if (!room) return null

  if (room.white?.playerId === socket.playerId) room.white = null
  if (room.black?.playerId === socket.playerId) room.black = null

  room.rematchVotes.clear()

  if (!room.white && !room.black) {
    rooms.delete(code)
    return null
  }

  if (room.status === 'playing') {
    room.status = 'waiting'
  }

  return room
}

export function colorOf(room: Room, playerId: string): Color | null {
  if (room.white?.playerId === playerId) return 'w'
  if (room.black?.playerId === playerId) return 'b'
  return null
}

export function applyPlayerMove(
  room: Room,
  playerId: string,
  from: number,
  to: number,
  promotion?: PieceType,
): GameState {
  if (!room.game) throw new Error('Game has not started')
  if (!room.white || !room.black) throw new Error('Waiting for opponent')
  if (room.status !== 'playing') throw new Error('Game is paused')

  const color = colorOf(room, playerId)
  if (!color) throw new Error('You are not in this room')
  if (room.game.turn !== color) throw new Error('Not your turn')
  if (room.game.result) throw new Error('Game is already over')
  if (room.game.phase !== 'playing') throw new Error('Finish the draft first')

  const legal = getLegalMoves(room.game, from).find(
    (m) => m.to === to && (m.promotion ?? undefined) === promotion,
  )
  if (!legal) throw new Error('Illegal move')

  const next = makeMove(room.game, legal)
  if (!next) throw new Error('Illegal move')

  room.game = next
  if (next.result) room.status = 'finished'
  return next
}

export function applyPlayerCard(
  room: Room,
  playerId: string,
  card: 'coronation',
  square: number,
): GameState {
  if (!room.game) throw new Error('Game has not started')
  if (!room.white || !room.black) throw new Error('Waiting for opponent')
  if (room.status !== 'playing') throw new Error('Game is paused')
  if (room.game.phase !== 'playing') throw new Error('Finish the draft first')

  const color = colorOf(room, playerId)
  if (!color) throw new Error('You are not in this room')
  if (room.game.turn !== color) throw new Error('Not your turn')
  if (room.game.result) throw new Error('Game is already over')

  if (card !== 'coronation') throw new Error('Unknown card')
  const next = useCoronation(room.game, square)
  if (!next) throw new Error('Cannot use Coronation on that piece')

  room.game = next
  if (next.result) room.status = 'finished'
  return next
}

export function applyPlayerDraftPick(
  room: Room,
  playerId: string,
  card: AugmentId,
): GameState {
  if (!room.game) throw new Error('Game has not started')
  if (!room.white || !room.black) throw new Error('Waiting for opponent')
  if (room.game.phase !== 'draft') throw new Error('Draft is over')

  const color = colorOf(room, playerId)
  if (!color) throw new Error('You are not in this room')

  const next = pickDraftCard(room.game, color, card)
  if (!next) throw new Error('Illegal draft pick')

  room.game = next
  return next
}

export function requestRematch(room: Room, playerId: string): void {
  const color = colorOf(room, playerId)
  if (!color) throw new Error('You are not in this room')
  if (!room.white || !room.black) throw new Error('Waiting for opponent')
  if (room.status === 'playing' && !room.game?.result) {
    throw new Error('Game is still in progress')
  }

  room.rematchVotes.add(color)
  if (room.rematchVotes.size >= 2) {
    room.game = createGame()
    room.status = 'playing'
    room.rematchVotes.clear()
  }
}

export function snapshotFor(room: Room, playerId: string): RoomSnapshot {
  return {
    code: room.code,
    status: room.status,
    you: colorOf(room, playerId),
    whitePresent: !!room.white,
    blackPresent: !!room.black,
    rematchVotes: room.rematchVotes.size,
    game: room.game,
  }
}

export function roomSockets(room: Room): PlayerSocket[] {
  const list: PlayerSocket[] = []
  if (room.white) list.push(room.white.socket)
  if (room.black) list.push(room.black.socket)
  return list
}
