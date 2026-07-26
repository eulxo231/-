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
  enPassant?: boolean
  doublePawn?: boolean
}

export type EndReason =
  | 'king-captured'
  | 'no-moves'
  | 'threefold'
  | 'overtime'

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
  /** Active RULE cards (game-wide). */
  rules: AugmentId[]
  /** Actions left for the side to move (2 under Acceleration from turn 3). */
  actionsRemaining: number
  /** Pre-game card draft, then playing. */
  phase: 'draft' | 'playing'
  draft: DraftState | null
  /** Whether each side has made their first move (for OPENING cards). */
  hasMoved: { w: boolean; b: boolean }
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
