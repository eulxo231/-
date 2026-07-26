import {
  DRAFT_PICKS_PER_PLAYER,
  draftOptionsFor,
  getAugment,
  hasRule,
  type AugmentId,
} from '../augments/catalog'
import { generateAllMoves, generateMoves } from './moves'
import type {
  CastlingRights,
  Color,
  DraftState,
  GameResult,
  GameState,
  Move,
  Piece,
  PieceType,
  SideAugments,
} from './types'
import { opposite } from './types'

function actionsForTurn(fullMove: number, rules: readonly AugmentId[]): number {
  return hasRule(rules, 'acceleration') && fullMove >= 3 ? 2 : 1
}

function initialDraft(): DraftState {
  return {
    picker: 'w',
    picksLeft: { w: DRAFT_PICKS_PER_PLAYER, b: DRAFT_PICKS_PER_PLAYER },
  }
}

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

/**
 * Horde layout from the card art: four home ranks filled with pawns,
 * king on the e-file of the back rank (white e1 / black e8).
 */
export function applyHordeLayout(
  board: (Piece | null)[],
  color: Color,
): (Piece | null)[] {
  const next = board.map((p) => {
    if (!p) return null
    if (p.color === color) return null
    return { ...p }
  })

  const backRank = color === 'w' ? 7 : 0
  const forward = color === 'w' ? -1 : 1
  const kingSq = backRank * 8 + 4 // e-file

  for (let i = 0; i < 4; i++) {
    const row = backRank + forward * i
    for (let col = 0; col < 8; col++) {
      const sq = row * 8 + col
      if (sq === kingSq) {
        next[sq] = { type: 'k', color }
      } else {
        next[sq] = { type: 'p', color }
      }
    }
  }

  return next
}

function triggerOpeningCards(
  color: Color,
  board: (Piece | null)[],
  augments: SideAugments,
  castling: CastlingRights,
): {
  board: (Piece | null)[]
  augments: SideAugments
  castling: CastlingRights
} {
  let nextBoard = board
  const nextAugments = {
    w: [...augments.w],
    b: [...augments.b],
  }
  let nextCastling = { ...castling }

  const owned = nextAugments[color]
  if (owned.includes('horde')) {
    nextBoard = applyHordeLayout(nextBoard, color)
    nextAugments[color] = owned.filter((id) => id !== 'horde')
    if (color === 'w') {
      nextCastling.wK = false
      nextCastling.wQ = false
    } else {
      nextCastling.bK = false
      nextCastling.bQ = false
    }
  }

  return { board: nextBoard, augments: nextAugments, castling: nextCastling }
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
    augments: { w: [], b: [] },
    rules: [],
    actionsRemaining: 1,
    phase: 'draft',
    draft: initialDraft(),
    hasMoved: { w: false, b: false },
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
    augments: {
      w: [...(state.augments?.w ?? [])],
      b: [...(state.augments?.b ?? [])],
    },
    rules: [...(state.rules ?? [])],
    draft: state.draft
      ? {
          picker: state.draft.picker,
          picksLeft: { ...state.draft.picksLeft },
        }
      : null,
    hasMoved: { ...(state.hasMoved ?? { w: false, b: false }) },
  }
}

export function positionKey(state: GameState): string {
  const pieces = state.board
    .map((p, i) => (p ? `${i}${p.color}${p.type}` : ''))
    .filter(Boolean)
    .join(',')
  const c = state.castling
  const castle = `${c.wK ? 'K' : ''}${c.wQ ? 'Q' : ''}${c.bK ? 'k' : ''}${c.bQ ? 'q' : ''}`
  const aug = `w:${(state.augments?.w ?? []).join(',')}|b:${(state.augments?.b ?? []).join(',')}`
  const rules = (state.rules ?? []).join(',')
  return `${pieces}|${state.turn}|${castle}|${state.epSquare ?? '-'}|${aug}|${rules}|a${state.actionsRemaining ?? 1}`
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

function resolveEndConditions(next: GameState): GameState {
  const key = positionKey(next)
  next.history = [...next.history, key]

  if (countRepetitions(next.history, key) >= 3) {
    next.result = { winner: 'draw', reason: 'threefold' }
    return next
  }

  if (next.inOvertime && next.overtimeIdle >= 10) {
    next.result = { winner: 'draw', reason: 'overtime' }
    return next
  }

  const replies = generateAllMoves(
    next.board,
    next.turn,
    next.castling,
    next.epSquare,
    next.augments?.[next.turn] ?? [],
    next.rules ?? [],
  )
  if (replies.length === 0) {
    next.result = resolveNoMoves(next.turn)
  }

  return next
}

function advanceAfterAction(
  state: GameState,
  rules: AugmentId[],
  irreversible: boolean,
): Pick<
  GameState,
  | 'turn'
  | 'fullMove'
  | 'actionsRemaining'
  | 'inOvertime'
  | 'overtimeIdle'
  | 'halfmoveClock'
> {
  const turnBudget = actionsForTurn(state.fullMove, rules)
  const actionsLeft = Math.max(1, state.actionsRemaining ?? turnBudget)
  const keepTurn = actionsLeft > 1

  const turn = keepTurn ? state.turn : opposite(state.turn)
  const fullMove =
    keepTurn || state.turn === 'w' ? state.fullMove : state.fullMove + 1
  const actionsRemaining = keepTurn
    ? actionsLeft - 1
    : actionsForTurn(fullMove, rules)

  const inOvertime = state.inOvertime || fullMove > 45
  let overtimeIdle = state.overtimeIdle
  if (inOvertime) {
    overtimeIdle = irreversible ? 0 : overtimeIdle + 1
  }

  return {
    turn,
    fullMove,
    actionsRemaining,
    inOvertime,
    overtimeIdle,
    halfmoveClock: irreversible ? 0 : state.halfmoveClock + 1,
  }
}

/** Apply a legal move. Returns null if illegal / game already over. */
export function makeMove(state: GameState, move: Move): GameState | null {
  if (state.result) return null
  if (state.phase !== 'playing') return null

  const owned = state.augments?.[state.turn] ?? []
  const rules = [...(state.rules ?? [])]
  const legal = generateMoves(
    state.board,
    move.from,
    state.turn,
    state.castling,
    state.epSquare,
    owned,
    rules,
  ).find(
    (m) =>
      m.to === move.to &&
      (m.promotion ?? null) === (move.promotion ?? null) &&
      !!m.castle === !!move.castle &&
      !!m.enPassant === !!move.enPassant,
  )

  if (!legal) return null

  const mover = state.turn
  const firstMove = !(state.hasMoved?.[mover] ?? false)
  const capturedKing = legal.captured?.type === 'k'
  let nextBoard = applyMoveToBoard(state.board, legal)
  const irreversible = !!legal.captured || state.board[legal.from]?.type === 'p'
  let nextCastling = updateCastling(state.castling, legal, state.board)

  let epSquare: number | null = null
  if (legal.doublePawn) {
    const dir = state.turn === 'w' ? 1 : -1
    epSquare = legal.to + dir * 8
  }

  let nextAugments = {
    w: [...(state.augments?.w ?? [])],
    b: [...(state.augments?.b ?? [])],
  }

  if (firstMove) {
    const opened = triggerOpeningCards(
      mover,
      nextBoard,
      nextAugments,
      nextCastling,
    )
    nextBoard = opened.board
    nextAugments = opened.augments
    nextCastling = opened.castling
    // Horde wipes the file; clear en passant from the first move.
    if ((state.augments?.[mover] ?? []).includes('horde')) {
      epSquare = null
    }
  }

  const clock = advanceAfterAction(state, rules, irreversible)

  const next: GameState = {
    board: nextBoard,
    castling: nextCastling,
    epSquare,
    history: [...state.history],
    lastMove: legal,
    result: null,
    augments: nextAugments,
    rules,
    phase: 'playing',
    draft: null,
    hasMoved: {
      w: (state.hasMoved?.w ?? false) || mover === 'w',
      b: (state.hasMoved?.b ?? false) || mover === 'b',
    },
    ...clock,
  }

  if (capturedKing) {
    next.result = { winner: state.turn, reason: 'king-captured' }
    return next
  }

  return resolveEndConditions(next)
}

/** Active card: turn one of your non-king pieces into a queen (once). */
export function useCoronation(
  state: GameState,
  square: number,
): GameState | null {
  if (state.result) return null
  if (state.phase !== 'playing') return null
  const color = state.turn
  const owned = state.augments?.[color] ?? []
  if (!owned.includes('coronation')) return null

  const piece = state.board[square]
  if (!piece || piece.color !== color) return null
  if (piece.type === 'k' || piece.type === 'q') return null

  const rules = [...(state.rules ?? [])]
  const board = state.board.map((p) => (p ? { ...p } : null))
  board[square] = { type: 'q', color }

  const nextAugments = {
    w: [...(state.augments?.w ?? [])],
    b: [...(state.augments?.b ?? [])],
  }
  const idx = nextAugments[color].indexOf('coronation')
  if (idx >= 0) nextAugments[color].splice(idx, 1)

  // Card use is irreversible for overtime (matches augmentchess rules).
  const clock = advanceAfterAction(state, rules, true)

  const next: GameState = {
    board,
    castling: { ...state.castling },
    epSquare: state.epSquare,
    history: [...state.history],
    lastMove: state.lastMove,
    result: null,
    augments: nextAugments,
    rules,
    phase: 'playing',
    draft: null,
    hasMoved: { ...(state.hasMoved ?? { w: false, b: false }) },
    ...clock,
  }

  return resolveEndConditions(next)
}

/** Pre-game draft: picker claims a card, then turn passes. */
export function pickDraftCard(
  state: GameState,
  by: Color,
  cardId: AugmentId,
): GameState | null {
  if (state.phase !== 'draft' || !state.draft) return null
  if (state.draft.picker !== by) return null
  if (state.draft.picksLeft[by] <= 0) return null

  const options = draftOptionsFor(state)
  if (!options.includes(cardId)) return null

  const card = getAugment(cardId)
  const augments = {
    w: [...(state.augments?.w ?? [])],
    b: [...(state.augments?.b ?? [])],
  }
  const rules = [...(state.rules ?? [])]

  if (card.kind === 'rule') {
    if (rules.includes(cardId)) return null
    rules.push(cardId)
  } else {
    if (augments[by].includes(cardId)) return null
    augments[by].push(cardId)
  }

  const picksLeft = {
    w: state.draft.picksLeft.w,
    b: state.draft.picksLeft.b,
  }
  picksLeft[by] -= 1

  const other = opposite(by)
  let picker: Color = by
  let phase: GameState['phase'] = 'draft'
  let draft: DraftState | null = { picker, picksLeft }

  if (picksLeft.w <= 0 && picksLeft.b <= 0) {
    phase = 'playing'
    draft = null
  } else if (picksLeft[other] > 0) {
    picker = other
    draft = { picker, picksLeft }
  } else if (picksLeft[by] > 0) {
    picker = by
    draft = { picker, picksLeft }
  } else {
    phase = 'playing'
    draft = null
  }

  return {
    ...state,
    board: state.board.map((p) => (p ? { ...p } : null)),
    castling: { ...state.castling },
    history: [...state.history],
    lastMove: state.lastMove,
    result: null,
    augments,
    rules,
    phase,
    draft,
    hasMoved: { ...(state.hasMoved ?? { w: false, b: false }) },
    actionsRemaining:
      phase === 'playing' ? actionsForTurn(state.fullMove, rules) : state.actionsRemaining,
  }
}

export function getLegalMoves(state: GameState, from: number): Move[] {
  if (state.result || state.phase !== 'playing') return []
  return generateMoves(
    state.board,
    from,
    state.turn,
    state.castling,
    state.epSquare,
    state.augments?.[state.turn] ?? [],
    state.rules ?? [],
  )
}

export function getAllLegalMoves(state: GameState): Move[] {
  if (state.result || state.phase !== 'playing') return []
  return generateAllMoves(
    state.board,
    state.turn,
    state.castling,
    state.epSquare,
    state.augments?.[state.turn] ?? [],
    state.rules ?? [],
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
