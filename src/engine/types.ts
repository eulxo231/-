import type { AugmentId } from '../augments/catalog'

export type Color = 'w' | 'b'
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p'

export type { AugmentId }

export interface SideAugments {
  w: AugmentId[]
  b: AugmentId[]
}

export interface Piece {
  type: PieceType
  color: Color
  /** Embassy envoy pawn — capturing it grants an extra action. */
  envoy?: boolean
}

export interface CastlingRights {
  wK: boolean
  wQ: boolean
  bK: boolean
  bQ: boolean
}

export interface Move {
  from: number
  to: number
  promotion?: PieceType
  captured?: Piece
  castle?: 'K' | 'Q'
  /** Rook square for castling (supports Longcastle). */
  castleRookFrom?: number
  enPassant?: boolean
  doublePawn?: boolean
  /** Extra king-step after Crooked Knight. */
  crookedStep?: boolean
}

export type EndReason =
  | 'king-captured'
  | 'no-moves'
  | 'threefold'
  | 'overtime'
  | 'sudden-death'

export interface GameResult {
  winner: Color | 'draw'
  reason: EndReason
}

export interface AnnotationArrow {
  from: number
  to: number
  color: string
}

export interface DraftState {
  picker: Color
  picksLeft: { w: number; b: number }
}

/** Snapshot used by Rewind. */
export interface BoardSnapshot {
  board: (Piece | null)[]
  castling: CastlingRights
  epSquare: number | null
  turn: Color
  fullMove: number
  actionsRemaining: number
  lastMove: Move | null
  hasMoved: { w: boolean; b: boolean }
  lastMovedTo: number | null
  eclipse: { square: number; until: Color } | null
  echoSquare: number | null
  echoFor: Color | null
  crookedFrom: number | null
  sharedPoolUsed: boolean
  borrowedTimeUsed: { w: boolean; b: boolean }
}

export interface GameState {
  board: (Piece | null)[]
  turn: Color
  castling: CastlingRights
  epSquare: number | null
  fullMove: number
  halfmoveClock: number
  overtimeIdle: number
  inOvertime: boolean
  history: string[]
  lastMove: Move | null
  result: GameResult | null
  augments: SideAugments
  rules: AugmentId[]
  actionsRemaining: number
  phase: 'draft' | 'playing'
  draft: DraftState | null
  hasMoved: { w: boolean; b: boolean }
  /** Square a piece moved to last action (Fog). */
  lastMovedTo: number | null
  /** Frozen enemy piece until `until`'s turn begins. */
  eclipse: { square: number; until: Color } | null
  /** Echo Lane blocker; blocks slides for `echoFor`'s opponent. */
  echoSquare: number | null
  echoFor: Color | null
  /** Crooked Knight bonus from this square. */
  crookedFrom: number | null
  /** Shared Pool extra already granted this turn. */
  sharedPoolUsed: boolean
  borrowedTimeUsed: { w: boolean; b: boolean }
  /** Previous position for Rewind. */
  prev: BoardSnapshot | null
}

export const FILES = 'abcdefgh'
export const RANKS = '87654321'

export function squareToCoord(sq: number): string {
  return FILES[sq % 8] + RANKS[Math.floor(sq / 8)]
}

export function coordToSquare(coord: string): number {
  const file = FILES.indexOf(coord[0])
  const rank = RANKS.indexOf(coord[1])
  return rank * 8 + file
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export const START_SQUARES: Record<Color, Partial<Record<PieceType, number[]>>> = {
  w: {
    r: [56, 63],
    n: [57, 62],
    b: [58, 61],
    q: [59],
    k: [60],
    p: [48, 49, 50, 51, 52, 53, 54, 55],
  },
  b: {
    r: [0, 7],
    n: [1, 6],
    b: [2, 5],
    q: [3],
    k: [4],
    p: [8, 9, 10, 11, 12, 13, 14, 15],
  },
}
