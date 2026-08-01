import type { AugmentId, Color, GameState, PieceType } from '../src/engine/types'

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

export type RematchFlags = { w: boolean; b: boolean }

/** 1:1 room messages (MQTT topic per code). `peer` is the sender id. */
export type WireMessage =
  | { type: 'host_ready'; peer: string }
  | { type: 'hello'; peer: string }
  | {
      type: 'welcome'
      peer: string
      to: string
      color: Color
      code: string
      ready: boolean
      game: GameState
      rematch: RematchFlags
    }
  | {
      type: 'state' | 'rematch'
      peer: string
      code: string
      ready: boolean
      game: GameState
      rematch: RematchFlags
    }
  | {
      type: 'move'
      peer: string
      from: number
      to: number
      promotion?: PieceType
    }
  | {
      type: 'use_card'
      peer: string
      card: AugmentId
      square?: number
      square2?: number
      promotion?: PieceType
    }
  | { type: 'pick_card'; peer: string; card: AugmentId }
  | { type: 'rematch_vote'; peer: string }
  | { type: 'leave'; peer: string; role: 'host' | 'guest' }
  | { type: 'peer_gone'; peer: string; role: 'host' | 'guest' }
  | { type: 'error'; peer: string; to?: string; message: string }
