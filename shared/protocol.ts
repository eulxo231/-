import type { Color, GameState, PieceType } from '../src/engine/types'

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export interface RoomSnapshot {
  code: string
  status: RoomStatus
  you: Color | null
  whitePresent: boolean
  blackPresent: boolean
  rematchVotes: number
  game: GameState | null
}

export type ClientMessage =
  | { type: 'create' }
  | { type: 'join'; code: string }
  | { type: 'leave' }
  | { type: 'move'; from: number; to: number; promotion?: PieceType }
  | { type: 'rematch' }

export type ServerMessage =
  | { type: 'hello'; playerId: string }
  | { type: 'room'; room: RoomSnapshot }
  | { type: 'error'; message: string }
  | { type: 'left' }
