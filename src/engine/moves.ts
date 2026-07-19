import type { Color, Move, Piece, PieceType } from './types'
import { opposite } from './types'

const KNIGHT_DELTAS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
]

const KING_DELTAS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]

const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function onBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function idx(row: number, col: number): number {
  return row * 8 + col
}

function slide(
  board: (Piece | null)[],
  from: number,
  color: Color,
  dirs: number[][],
): Move[] {
  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const fc = from % 8

  for (const [dr, dc] of dirs) {
    let r = fr + dr
    let c = fc + dc
    while (onBoard(r, c)) {
      const to = idx(r, c)
      const target = board[to]
      if (!target) {
        moves.push({ from, to })
      } else {
        if (target.color !== color) {
          moves.push({ from, to, captured: target })
        }
        break
      }
      r += dr
      c += dc
    }
  }
  return moves
}

function pawnMoves(
  board: (Piece | null)[],
  from: number,
  color: Color,
  epSquare: number | null,
): Move[] {
  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const fc = from % 8
  const dir = color === 'w' ? -1 : 1
  const startRank = color === 'w' ? 6 : 1
  const promoRank = color === 'w' ? 0 : 7
  const promotions: PieceType[] = ['q', 'r', 'b', 'n']

  const pushPromo = (to: number, captured?: Piece, extra?: Partial<Move>) => {
    if (Math.floor(to / 8) === promoRank) {
      for (const promotion of promotions) {
        moves.push({ from, to, promotion, captured, ...extra })
      }
    } else {
      moves.push({ from, to, captured, ...extra })
    }
  }

  const one = idx(fr + dir, fc)
  if (onBoard(fr + dir, fc) && !board[one]) {
    pushPromo(one)
    const two = idx(fr + 2 * dir, fc)
    if (fr === startRank && !board[two]) {
      moves.push({ from, to: two, doublePawn: true })
    }
  }

  for (const dc of [-1, 1]) {
    const r = fr + dir
    const c = fc + dc
    if (!onBoard(r, c)) continue
    const to = idx(r, c)
    const target = board[to]
    if (target && target.color !== color) {
      pushPromo(to, target)
    } else if (epSquare === to) {
      const capturedSq = idx(fr, c)
      const captured = board[capturedSq]
      if (captured) {
        moves.push({ from, to, captured, enPassant: true })
      }
    }
  }

  return moves
}

function kingMoves(
  board: (Piece | null)[],
  from: number,
  color: Color,
  castling: { K: boolean; Q: boolean },
): Move[] {
  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const fc = from % 8

  for (const [dr, dc] of KING_DELTAS) {
    const r = fr + dr
    const c = fc + dc
    if (!onBoard(r, c)) continue
    const to = idx(r, c)
    const target = board[to]
    if (!target || target.color !== color) {
      moves.push({ from, to, captured: target ?? undefined })
    }
  }

  // Castling: path must be empty. Check is ignored (Augment Chess).
  const back = color === 'w' ? 7 : 0
  if (fr === back && fc === 4) {
    if (castling.K && !board[idx(back, 5)] && !board[idx(back, 6)]) {
      const rook = board[idx(back, 7)]
      if (rook?.type === 'r' && rook.color === color) {
        moves.push({ from, to: idx(back, 6), castle: 'K' })
      }
    }
    if (
      castling.Q &&
      !board[idx(back, 1)] &&
      !board[idx(back, 2)] &&
      !board[idx(back, 3)]
    ) {
      const rook = board[idx(back, 0)]
      if (rook?.type === 'r' && rook.color === color) {
        moves.push({ from, to: idx(back, 2), castle: 'Q' })
      }
    }
  }

  return moves
}

export function generateMoves(
  board: (Piece | null)[],
  from: number,
  turn: Color,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  epSquare: number | null,
): Move[] {
  const piece = board[from]
  if (!piece || piece.color !== turn) return []

  switch (piece.type) {
    case 'p':
      return pawnMoves(board, from, turn, epSquare)
    case 'n': {
      const moves: Move[] = []
      const fr = Math.floor(from / 8)
      const fc = from % 8
      for (const [dr, dc] of KNIGHT_DELTAS) {
        const r = fr + dr
        const c = fc + dc
        if (!onBoard(r, c)) continue
        const to = idx(r, c)
        const target = board[to]
        if (!target || target.color !== turn) {
          moves.push({ from, to, captured: target ?? undefined })
        }
      }
      return moves
    }
    case 'b':
      return slide(board, from, turn, BISHOP_DIRS)
    case 'r':
      return slide(board, from, turn, ROOK_DIRS)
    case 'q':
      return slide(board, from, turn, [...BISHOP_DIRS, ...ROOK_DIRS])
    case 'k':
      return kingMoves(board, from, turn, {
        K: turn === 'w' ? castlingRights.wK : castlingRights.bK,
        Q: turn === 'w' ? castlingRights.wQ : castlingRights.bQ,
      })
    default:
      return []
  }
}

export function generateAllMoves(
  board: (Piece | null)[],
  turn: Color,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  epSquare: number | null,
): Move[] {
  const moves: Move[] = []
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq]?.color === turn) {
      moves.push(...generateMoves(board, sq, turn, castlingRights, epSquare))
    }
  }
  return moves
}

export function isSquareAttacked(
  board: (Piece | null)[],
  square: number,
  by: Color,
): boolean {
  // Attack detection for UI hints only — not used to filter legality.
  const moves = generateAllMoves(
    board,
    by,
    { wK: false, wQ: false, bK: false, bQ: false },
    null,
  )
  return moves.some((m) => m.to === square)
}

export function findKing(board: (Piece | null)[], color: Color): number | null {
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (p?.type === 'k' && p.color === color) return i
  }
  return null
}

export { opposite }
