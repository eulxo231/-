import { generateAllMoves, generateMoves } from './moves'
import type {
  CastlingRights,
  Color,
  GameResult,
  GameState,
  Move,
  Piece,
  PieceType,
} from './types'
import { opposite } from './types'

const START_FEN_ROWS = [
  'rnbqkbnr',
  'pppppppp',
  '........',
  '........',
  '........',
  '........',
  'PPPPPPPP',
  'RNBQKBNR',
]

function parseRow(row: string): (Piece | null)[] {
  return [...row].map((ch) => {
    if (ch === '.') return null
    const lower = ch.toLowerCase() as PieceType
    const color: Color = ch === ch.toUpperCase() ? 'w' : 'b'
    return { type: lower, color }
  })
}

export function createInitialBoard(): (Piece | null)[] {
  return START_FEN_ROWS.flatMap((row) => parseRow(row))
}

export function createGame(): GameState {
  return {
    board: createInitialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epSquare: null,
    fullMove: 1,
    halfmoveClock: 0,
    overtimeIdle: 0,
    inOvertime: false,
    history: [],
    lastMove: null,
    result: null,
  }
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((p) => (p ? { ...p } : null)),
    castling: { ...state.castling },
    history: [...state.history],
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    result: state.result ? { ...state.result } : null,
  }
}

export function positionKey(state: GameState): string {
  const pieces = state.board
    .map((p, i) => (p ? `${i}${p.color}${p.type}` : ''))
    .filter(Boolean)
    .join(',')
  const c = state.castling
  const castle = `${c.wK ? 'K' : ''}${c.wQ ? 'Q' : ''}${c.bK ? 'k' : ''}${c.bQ ? 'q' : ''}`
  return `${pieces}|${state.turn}|${castle}|${state.epSquare ?? '-'}`
}

function updateCastling(castling: CastlingRights, move: Move, board: (Piece | null)[]): CastlingRights {
  const next = { ...castling }
  const piece = board[move.from]
  if (!piece) return next

  if (piece.type === 'k') {
    if (piece.color === 'w') {
      next.wK = false
      next.wQ = false
    } else {
      next.bK = false
      next.bQ = false
    }
  }

  if (piece.type === 'r') {
    if (move.from === 63) next.wK = false
    if (move.from === 56) next.wQ = false
    if (move.from === 7) next.bK = false
    if (move.from === 0) next.bQ = false
  }

  if (move.captured?.type === 'r') {
    if (move.to === 63) next.wK = false
    if (move.to === 56) next.wQ = false
    if (move.to === 7) next.bK = false
    if (move.to === 0) next.bQ = false
  }

  return next
}

function applyMoveToBoard(board: (Piece | null)[], move: Move): (Piece | null)[] {
  const next = board.map((p) => (p ? { ...p } : null))
  const piece = next[move.from]
  if (!piece) return next

  next[move.from] = null

  if (move.enPassant) {
    const capRow = Math.floor(move.from / 8)
    const capCol = move.to % 8
    next[capRow * 8 + capCol] = null
  }

  if (move.castle) {
    const row = Math.floor(move.from / 8)
    if (move.castle === 'K') {
      next[row * 8 + 5] = next[row * 8 + 7]
      next[row * 8 + 7] = null
    } else {
      next[row * 8 + 3] = next[row * 8 + 0]
      next[row * 8 + 0] = null
    }
  }

  next[move.to] = move.promotion
    ? { type: move.promotion, color: piece.color }
    : piece

  return next
}

function resolveNoMoves(turn: Color): GameResult {
  return { winner: opposite(turn), reason: 'no-moves' }
}

function countRepetitions(history: string[], key: string): number {
  return history.filter((h) => h === key).length
}

/** Apply a legal move. Returns null if illegal / game already over. */
export function makeMove(state: GameState, move: Move): GameState | null {
  if (state.result) return null

  const legal = generateMoves(
    state.board,
    move.from,
    state.turn,
    state.castling,
    state.epSquare,
  ).find(
    (m) =>
      m.to === move.to &&
      (m.promotion ?? null) === (move.promotion ?? null) &&
      !!m.castle === !!move.castle &&
      !!m.enPassant === !!move.enPassant,
  )

  if (!legal) return null

  const capturedKing = legal.captured?.type === 'k'
  const nextBoard = applyMoveToBoard(state.board, legal)
  const irreversible = !!legal.captured || state.board[legal.from]?.type === 'p'
  const nextCastling = updateCastling(state.castling, legal, state.board)

  let epSquare: number | null = null
  if (legal.doublePawn) {
    const dir = state.turn === 'w' ? 1 : -1
    epSquare = legal.to + dir * 8
  }

  const nextTurn = opposite(state.turn)
  const fullMove = state.turn === 'b' ? state.fullMove + 1 : state.fullMove
  const inOvertime = state.inOvertime || fullMove > 45
  let overtimeIdle = state.overtimeIdle
  if (inOvertime) {
    overtimeIdle = irreversible ? 0 : overtimeIdle + 1
  }

  const next: GameState = {
    board: nextBoard,
    turn: nextTurn,
    castling: nextCastling,
    epSquare,
    fullMove,
    halfmoveClock: irreversible ? 0 : state.halfmoveClock + 1,
    overtimeIdle,
    inOvertime,
    history: [...state.history],
    lastMove: legal,
    result: null,
  }

  if (capturedKing) {
    next.result = { winner: state.turn, reason: 'king-captured' }
    return next
  }

  const key = positionKey(next)
  next.history = [...state.history, key]

  if (countRepetitions(next.history, key) >= 3) {
    // Card star totals decide this once augments exist; draw for now.
    next.result = { winner: 'draw', reason: 'threefold' }
    return next
  }

  if (inOvertime && overtimeIdle >= 10) {
    next.result = { winner: 'draw', reason: 'overtime' }
    return next
  }

  const replies = generateAllMoves(
    next.board,
    next.turn,
    next.castling,
    next.epSquare,
  )
  if (replies.length === 0) {
    next.result = resolveNoMoves(next.turn)
  }

  return next
}

export function getLegalMoves(state: GameState, from: number): Move[] {
  if (state.result) return []
  return generateMoves(
    state.board,
    from,
    state.turn,
    state.castling,
    state.epSquare,
  )
}

export function getAllLegalMoves(state: GameState): Move[] {
  if (state.result) return []
  return generateAllMoves(
    state.board,
    state.turn,
    state.castling,
    state.epSquare,
  )
}

export function resultLabel(result: GameResult): string {
  const side = (c: Color) => (c === 'w' ? 'White' : 'Black')
  switch (result.reason) {
    case 'king-captured':
      return `${side(result.winner as Color)} wins — king captured`
    case 'no-moves':
      return `${side(result.winner as Color)} wins — opponent has no moves`
    case 'threefold':
      return 'Draw — threefold repetition (star totals decide with cards)'
    case 'overtime':
      return 'Draw — overtime idle (star totals decide with cards)'
    default:
      return 'Game over'
  }
}
