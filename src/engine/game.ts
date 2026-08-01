import {
  DRAFT_EVERY_MOVES,
  DRAFT_PICKS_AT_START,
  DRAFT_PICKS_TOTAL,
  draftOptionsFor,
  getAugment,
  hasAugment,
  hasRule,
  type AugmentId,
} from '../augments/catalog'
import { generateAllMoves, generateMoves, isAdjacent, type MoveGenOpts } from './moves'
import type {
  BoardSnapshot,
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
import { opposite, START_SQUARES } from './types'

function actionsForTurn(fullMove: number, rules: readonly AugmentId[]): number {
  return hasRule(rules, 'acceleration') && fullMove >= 3 ? 2 : 1
}

function picksStillNeeded(state: Pick<GameState, 'picksMade'>): {
  w: number
  b: number
} {
  return {
    w: Math.max(0, DRAFT_PICKS_TOTAL - (state.picksMade?.w ?? 0)),
    b: Math.max(0, DRAFT_PICKS_TOTAL - (state.picksMade?.b ?? 0)),
  }
}

/** One card each for players who still need cards (White first). */
function draftRoundFor(state: Pick<GameState, 'picksMade'>): DraftState | null {
  const need = picksStillNeeded(state)
  const picksLeft = {
    w: need.w > 0 ? 1 : 0,
    b: need.b > 0 ? 1 : 0,
  }
  if (picksLeft.w === 0 && picksLeft.b === 0) return null
  return {
    picker: picksLeft.w > 0 ? 'w' : 'b',
    picksLeft,
  }
}

function initialDraft(): DraftState {
  return {
    picker: 'w',
    picksLeft: { w: DRAFT_PICKS_AT_START, b: DRAFT_PICKS_AT_START },
  }
}

/** After Black completes full-moves 5, 10, … pause for one card each until both have 3. */
function maybeEnterDraft(prev: GameState, next: GameState): GameState {
  if (next.result) return next
  if (next.phase === 'draft') return next
  const blackFinishedFullMove =
    prev.turn === 'b' &&
    next.turn === 'w' &&
    prev.fullMove > 0 &&
    prev.fullMove % DRAFT_EVERY_MOVES === 0 &&
    next.fullMove === prev.fullMove + 1
  if (!blackFinishedFullMove) return next
  const draft = draftRoundFor(next)
  if (!draft) return next
  if (draftOptionsFor(next).length === 0) return next
  return {
    ...next,
    phase: 'draft',
    draft,
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

function emptyExtras(): Pick<
  GameState,
  | 'lastMovedTo'
  | 'eclipse'
  | 'echoSquare'
  | 'echoFor'
  | 'crookedFrom'
  | 'sharedPoolUsed'
  | 'borrowedTimeUsed'
  | 'prev'
> {
  return {
    lastMovedTo: null,
    eclipse: null,
    echoSquare: null,
    echoFor: null,
    crookedFrom: null,
    sharedPoolUsed: false,
    borrowedTimeUsed: { w: false, b: false },
    prev: null,
  }
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
  const kingSq = backRank * 8 + 4

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

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let s = seed + 1
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function applyOpening(
  id: AugmentId,
  color: Color,
  board: (Piece | null)[],
  castling: CastlingRights,
): { board: (Piece | null)[]; castling: CastlingRights } {
  let next = board.map((p) => (p ? { ...p } : null))
  let nextCastling = { ...castling }
  const back = color === 'w' ? 7 : 0
  const pawnRank = color === 'w' ? 6 : 1
  const third = color === 'w' ? 5 : 2
  const halfStart = color === 'w' ? 32 : 0
  const halfEnd = color === 'w' ? 64 : 32

  const clearCastling = () => {
    if (color === 'w') {
      nextCastling.wK = false
      nextCastling.wQ = false
    } else {
      nextCastling.bK = false
      nextCastling.bQ = false
    }
  }

  switch (id) {
    case 'horde':
      next = applyHordeLayout(next, color)
      clearCastling()
      break

    case 'castle-siege': {
      for (let sq = 0; sq < 64; sq++) {
        if (next[sq]?.color === color && next[sq]?.type === 'n') next[sq] = null
      }
      for (const file of [2, 5]) {
        const sq = third * 8 + file
        if (!next[sq]) next[sq] = { type: 'p', color }
      }
      break
    }

    case 'queens-gambit-denied': {
      for (let sq = 0; sq < 64; sq++) {
        if (next[sq]?.color === color && next[sq]?.type === 'q') next[sq] = null
      }
      const rank = color === 'w' ? 6 : 1
      for (const file of [3, 5]) {
        const sq = rank * 8 + file
        if (!next[sq]) next[sq] = { type: 'n', color }
      }
      break
    }

    case 'phalanx': {
      const dir = color === 'w' ? -1 : 1
      const pawns: number[] = []
      for (let sq = 0; sq < 64; sq++) {
        if (next[sq]?.color === color && next[sq]?.type === 'p') pawns.push(sq)
      }
      // Move from forward ranks first so we don't block ourselves.
      pawns.sort((a, b) => (color === 'w' ? a - b : b - a))
      for (const sq of pawns) {
        const to = sq + dir * 8
        if (to >= 0 && to < 64 && !next[to]) {
          next[to] = next[sq]
          next[sq] = null
        }
      }
      break
    }

    case 'lone-king': {
      const pawnsOnHome: number[] = []
      for (let file = 0; file < 8; file++) {
        const sq = pawnRank * 8 + file
        if (next[sq]?.color === color && next[sq]?.type === 'p') {
          pawnsOnHome.push(sq)
        }
      }
      const keepPawns = new Set(pawnsOnHome.slice(0, 4))
      for (let sq = 0; sq < 64; sq++) {
        const p = next[sq]
        if (!p || p.color !== color) continue
        if (p.type === 'k') continue
        if (p.type === 'p' && keepPawns.has(sq)) continue
        next[sq] = null
      }
      clearCastling()
      break
    }

    case 'scatter': {
      const pieces: Piece[] = []
      for (let sq = halfStart; sq < halfEnd; sq++) {
        const p = next[sq]
        if (p && p.color === color && p.type !== 'k') {
          pieces.push({ ...p })
          next[sq] = null
        }
      }
      const empties: number[] = []
      for (let sq = halfStart; sq < halfEnd; sq++) {
        if (!next[sq]) empties.push(sq)
      }
      const slots = seededShuffle(empties, pieces.length * 31 + halfStart)
      for (let i = 0; i < pieces.length && i < slots.length; i++) {
        next[slots[i]] = pieces[i]
      }
      clearCastling()
      break
    }

    case 'vault': {
      let kingSq = -1
      let queenSq = -1
      const rookSqs: number[] = []
      for (let sq = 0; sq < 64; sq++) {
        const p = next[sq]
        if (!p || p.color !== color) continue
        if (p.type === 'k') kingSq = sq
        if (p.type === 'q') queenSq = sq
        if (p.type === 'r') rookSqs.push(sq)
      }
      const swapWith = queenSq >= 0 ? queenSq : rookSqs[0] ?? -1
      if (kingSq >= 0 && swapWith >= 0) {
        const tmp = next[kingSq]
        next[kingSq] = next[swapWith]
        next[swapWith] = tmp
      }
      clearCastling()
      break
    }

    case 'nursery': {
      const pawns: Piece[] = []
      for (let sq = 0; sq < 64; sq++) {
        const p = next[sq]
        if (p?.color === color && p.type === 'p') {
          pawns.push({ ...p })
          next[sq] = null
        }
      }
      for (let file = 0; file < 8; file++) {
        next[pawnRank * 8 + file] = null
      }
      for (let i = 0; i < 8; i++) {
        next[pawnRank * 8 + i] = pawns[i] ?? { type: 'p', color }
      }
      break
    }

    case 'embassy': {
      for (const sq of [27, 28, 35, 36]) {
        if (!next[sq]) {
          next[sq] = { type: 'p', color, envoy: true }
          break
        }
      }
      break
    }

    case 'ash-start': {
      for (let sq = 0; sq < 64; sq++) {
        const p = next[sq]
        if (p && (p.type === 'b' || p.type === 'n')) next[sq] = null
      }
      break
    }

    case 'cuckoo': {
      let kingSq = -1
      for (let sq = 0; sq < 64; sq++) {
        if (next[sq]?.color === color && next[sq]?.type === 'k') {
          kingSq = sq
          break
        }
      }
      if (kingSq >= 0) {
        next[kingSq] = { type: 'q', color }
        const empties: number[] = []
        for (let file = 0; file < 8; file++) {
          const sq = back * 8 + file
          if (!next[sq]) empties.push(sq)
        }
        if (empties.length) {
          const pick = seededShuffle(empties, kingSq + 7)[0]
          next[pick] = { type: 'k', color }
        } else {
          next[kingSq] = { type: 'k', color }
        }
      }
      clearCastling()
      break
    }

    default:
      break
  }

  return { board: next, castling: nextCastling }
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

  const openings = nextAugments[color].filter(
    (id) => getAugment(id).kind === 'opening',
  )
  for (const id of openings) {
    const applied = applyOpening(id, color, nextBoard, nextCastling)
    nextBoard = applied.board
    nextCastling = applied.castling
    nextAugments[color] = nextAugments[color].filter((x) => x !== id)
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
    picksMade: { w: 0, b: 0 },
    hasMoved: { w: false, b: false },
    ...emptyExtras(),
  }
}

function snapshotOf(state: GameState): BoardSnapshot {
  return {
    board: state.board.map((p) => (p ? { ...p } : null)),
    castling: { ...state.castling },
    epSquare: state.epSquare,
    turn: state.turn,
    fullMove: state.fullMove,
    actionsRemaining: state.actionsRemaining,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    hasMoved: { ...state.hasMoved },
    lastMovedTo: state.lastMovedTo,
    eclipse: state.eclipse ? { ...state.eclipse } : null,
    echoSquare: state.echoSquare,
    echoFor: state.echoFor,
    crookedFrom: state.crookedFrom,
    sharedPoolUsed: state.sharedPoolUsed,
    borrowedTimeUsed: { ...state.borrowedTimeUsed },
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
    picksMade: {
      w: state.picksMade?.w ?? 0,
      b: state.picksMade?.b ?? 0,
    },
    hasMoved: { ...(state.hasMoved ?? { w: false, b: false }) },
    lastMovedTo: state.lastMovedTo ?? null,
    eclipse: state.eclipse ? { ...state.eclipse } : null,
    echoSquare: state.echoSquare ?? null,
    echoFor: state.echoFor ?? null,
    crookedFrom: state.crookedFrom ?? null,
    sharedPoolUsed: state.sharedPoolUsed ?? false,
    borrowedTimeUsed: {
      w: state.borrowedTimeUsed?.w ?? false,
      b: state.borrowedTimeUsed?.b ?? false,
    },
    prev: state.prev
      ? {
          ...state.prev,
          board: state.prev.board.map((p) => (p ? { ...p } : null)),
          castling: { ...state.prev.castling },
          lastMove: state.prev.lastMove ? { ...state.prev.lastMove } : null,
          hasMoved: { ...state.prev.hasMoved },
          eclipse: state.prev.eclipse ? { ...state.prev.eclipse } : null,
          borrowedTimeUsed: { ...state.prev.borrowedTimeUsed },
        }
      : null,
  }
}

export function positionKey(state: GameState): string {
  const pieces = state.board
    .map((p, i) =>
      p ? `${i}${p.color}${p.type}${p.envoy ? 'E' : ''}` : '',
    )
    .filter(Boolean)
    .join(',')
  const c = state.castling
  const castle = `${c.wK ? 'K' : ''}${c.wQ ? 'Q' : ''}${c.bK ? 'k' : ''}${c.bQ ? 'q' : ''}`
  const aug = `w:${(state.augments?.w ?? []).join(',')}|b:${(state.augments?.b ?? []).join(',')}`
  const rules = (state.rules ?? []).join(',')
  return `${pieces}|${state.turn}|${castle}|${state.epSquare ?? '-'}|${aug}|${rules}|a${state.actionsRemaining ?? 1}|e${state.echoSquare ?? '-'}|f${state.lastMovedTo ?? '-'}|c${state.crookedFrom ?? '-'}`
}

function updateCastling(
  castling: CastlingRights,
  move: Move,
  board: (Piece | null)[],
): CastlingRights {
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

  if (move.castleRookFrom != null) {
    if (move.castleRookFrom === 63) next.wK = false
    if (move.castleRookFrom === 56) next.wQ = false
    if (move.castleRookFrom === 7) next.bK = false
    if (move.castleRookFrom === 0) next.bQ = false
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
    const rookFrom =
      move.castleRookFrom ??
      (move.castle === 'K' ? row * 8 + 7 : row * 8 + 0)
    const rook = next[rookFrom]
    next[rookFrom] = null
    const rookTo =
      move.castle === 'K' ? move.to - 1 : move.to + 1
    next[rookTo] = rook
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

function moveGenOpts(state: GameState, turn: Color = state.turn): MoveGenOpts {
  return {
    owned: state.augments?.[turn] ?? [],
    opponentOwned: state.augments?.[opposite(turn)] ?? [],
    rules: state.rules ?? [],
    lastMovedTo: state.lastMovedTo ?? null,
    eclipse: state.eclipse ?? null,
    echoSquare: state.echoSquare ?? null,
    echoFor: state.echoFor ?? null,
    crookedFrom: state.crookedFrom ?? null,
    fullMove: state.fullMove,
  }
}

function tryBorrowedTime(state: GameState): GameState | null {
  const turn = state.turn
  if (!hasRule(state.rules, 'borrowed-time')) return null
  if (state.borrowedTimeUsed?.[turn]) return null

  for (let sq = 0; sq < 64; sq++) {
    const p = state.board[sq]
    if (p && p.color === turn && p.type !== 'k') {
      const next = cloneState(state)
      next.board[sq] = null
      next.borrowedTimeUsed = {
        ...(next.borrowedTimeUsed ?? { w: false, b: false }),
        [turn]: true,
      }
      return next
    }
  }
  return null
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
    moveGenOpts(next),
  )
  if (replies.length === 0) {
    const rescued = tryBorrowedTime(next)
    if (rescued) {
      const after = generateAllMoves(
        rescued.board,
        rescued.turn,
        rescued.castling,
        rescued.epSquare,
        moveGenOpts(rescued),
      )
      if (after.length === 0) {
        next.result = resolveNoMoves(next.turn)
        return next
      }
      // Replace board with sacrifice; re-check end (avoid infinite history loop).
      Object.assign(next, {
        board: rescued.board,
        borrowedTimeUsed: rescued.borrowedTimeUsed,
      })
      const again = generateAllMoves(
        next.board,
        next.turn,
        next.castling,
        next.epSquare,
        moveGenOpts(next),
      )
      if (again.length === 0) {
        next.result = resolveNoMoves(next.turn)
      }
      return next
    }
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
  | 'sharedPoolUsed'
  | 'crookedFrom'
  | 'eclipse'
  | 'echoSquare'
  | 'echoFor'
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

  let eclipse = state.eclipse ? { ...state.eclipse } : null
  if (eclipse && !keepTurn && turn === eclipse.until) {
    eclipse = null
  }

  let echoSquare = state.echoSquare
  let echoFor = state.echoFor
  if (!keepTurn && echoFor != null && turn === echoFor) {
    echoSquare = null
    echoFor = null
  }

  return {
    turn,
    fullMove,
    actionsRemaining,
    inOvertime,
    overtimeIdle,
    halfmoveClock: irreversible ? 0 : state.halfmoveClock + 1,
    sharedPoolUsed: keepTurn ? (state.sharedPoolUsed ?? false) : false,
    crookedFrom: keepTurn ? state.crookedFrom : null,
    eclipse,
    echoSquare,
    echoFor,
  }
}

function consumeCard(augments: SideAugments, color: Color, id: AugmentId): SideAugments {
  const next = {
    w: [...augments.w],
    b: [...augments.b],
  }
  const idx = next[color].indexOf(id)
  if (idx >= 0) next[color].splice(idx, 1)
  return next
}

function finishCardUse(
  state: GameState,
  board: (Piece | null)[],
  augments: SideAugments,
  irreversible: boolean,
  extra?: Partial<GameState>,
): GameState {
  const rules = [...(state.rules ?? [])]
  const clock = advanceAfterAction(state, rules, irreversible)
  const next: GameState = {
    ...cloneState(state),
    board,
    augments,
    rules,
    phase: 'playing',
    draft: null,
    result: null,
    prev: snapshotOf(state),
    ...clock,
    ...extra,
  }
  return maybeEnterDraft(state, resolveEndConditions(next))
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
    moveGenOpts(state),
  ).find(
    (m) =>
      m.to === move.to &&
      (m.promotion ?? null) === (move.promotion ?? null) &&
      !!m.castle === !!move.castle &&
      !!m.enPassant === !!move.enPassant &&
      !!m.crookedStep === !!move.crookedStep,
  )

  if (!legal) return null

  // Blood moon / filters applied in generateAllMoves; also enforce per-piece list
  // already filtered — but blood-moon filters only in generateAllMoves.
  if (hasRule(rules, 'blood-moon')) {
    const all = generateAllMoves(
      state.board,
      state.turn,
      state.castling,
      state.epSquare,
      moveGenOpts(state),
    )
    if (all.some((m) => m.captured) && !legal.captured) return null
  }

  const mover = state.turn
  const firstMove = !(state.hasMoved?.[mover] ?? false)
  const movingPiece = state.board[legal.from]
  const capturedKing = legal.captured?.type === 'k'
  const capturedEnvoy = !!legal.captured?.envoy
  const sudden =
    hasRule(rules, 'sudden-death') &&
    state.fullMove >= 20 &&
    !!legal.captured &&
    ['n', 'b', 'r', 'q'].includes(legal.captured.type)

  const prevSnap = snapshotOf(state)
  let nextBoard = applyMoveToBoard(state.board, legal)

  // Glass Queen: queen dies when she captures.
  if (
    hasAugment(owned, 'glass-queen') &&
    movingPiece?.type === 'q' &&
    legal.captured
  ) {
    nextBoard[legal.to] = null
  }

  // Seed Bishop: spawn pawn on vacated square after capture.
  if (
    hasAugment(owned, 'seed-bishop') &&
    movingPiece?.type === 'b' &&
    legal.captured &&
    !nextBoard[legal.from]
  ) {
    nextBoard[legal.from] = { type: 'p', color: mover }
  }

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
    if ((state.augments?.[mover] ?? []).some((id) => getAugment(id).kind === 'opening')) {
      epSquare = null
    }
  }

  // Crooked knight bonus: treat as +1 action before advance.
  let stateForClock = state
  let crookedFrom: number | null = state.crookedFrom ?? null
  if (legal.crookedStep) {
    crookedFrom = null
  } else if (
    movingPiece?.type === 'n' &&
    hasAugment(owned, 'crooked-knight')
  ) {
    crookedFrom = legal.to
    stateForClock = {
      ...state,
      actionsRemaining: (state.actionsRemaining ?? 1) + 1,
    }
  } else {
    crookedFrom = null
  }

  // Shared pool / envoy extra action before advance.
  if (
    (legal.captured &&
      hasRule(rules, 'shared-pool') &&
      !(state.sharedPoolUsed ?? false)) ||
    capturedEnvoy
  ) {
    stateForClock = {
      ...stateForClock,
      actionsRemaining: (stateForClock.actionsRemaining ?? 1) + 1,
      sharedPoolUsed:
        legal.captured && hasRule(rules, 'shared-pool')
          ? true
          : stateForClock.sharedPoolUsed,
    }
  }

  const clock = advanceAfterAction(stateForClock, rules, irreversible)

  // Echo Lane: leave blocker on vacated square after slider move.
  let echoSquare = clock.echoSquare
  let echoFor = clock.echoFor
  if (
    hasAugment(owned, 'echo-lane') &&
    movingPiece &&
    (movingPiece.type === 'r' ||
      movingPiece.type === 'b' ||
      movingPiece.type === 'q') &&
    !legal.castle
  ) {
    echoSquare = legal.from
    echoFor = mover
  }

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
    picksMade: {
      w: state.picksMade?.w ?? 0,
      b: state.picksMade?.b ?? 0,
    },
    hasMoved: {
      w: (state.hasMoved?.w ?? false) || mover === 'w',
      b: (state.hasMoved?.b ?? false) || mover === 'b',
    },
    lastMovedTo: legal.to,
    borrowedTimeUsed: {
      w: state.borrowedTimeUsed?.w ?? false,
      b: state.borrowedTimeUsed?.b ?? false,
    },
    prev: prevSnap,
    ...clock,
    crookedFrom: clock.turn === mover ? crookedFrom : null,
    echoSquare,
    echoFor,
  }

  if (capturedKing) {
    next.result = { winner: state.turn, reason: 'king-captured' }
    return next
  }
  if (sudden) {
    next.result = { winner: state.turn, reason: 'sudden-death' }
    return next
  }

  return maybeEnterDraft(state, resolveEndConditions(next))
}

export interface UseCardOpts {
  square?: number
  square2?: number
  promotion?: PieceType
}

function homeSquareFor(
  board: (Piece | null)[],
  square: number,
  piece: Piece,
): number | null {
  const starts = START_SQUARES[piece.color][piece.type] ?? []
  if (piece.type === 'p') {
    const file = square % 8
    const home = piece.color === 'w' ? 48 + file : 8 + file
    if (home === square || board[home]) return null
    return home
  }
  const sameFile = starts.find((sq) => sq % 8 === square % 8 && !board[sq])
  if (sameFile != null) return sameFile
  return starts.find((sq) => !board[sq]) ?? null
}

/** Use an active augment card. */
export function useActiveCard(
  state: GameState,
  cardId: AugmentId,
  opts: UseCardOpts = {},
): GameState | null {
  if (state.result) return null
  if (state.phase !== 'playing') return null

  const color = state.turn
  const owned = state.augments?.[color] ?? []
  if (!owned.includes(cardId)) return null

  const card = getAugment(cardId)
  if (card.kind !== 'active') return null

  const { square, square2, promotion } = opts
  const board = state.board.map((p) => (p ? { ...p } : null))
  let augments = {
    w: [...(state.augments?.w ?? [])],
    b: [...(state.augments?.b ?? [])],
  }

  const pieceAt = (sq: number | undefined) =>
    sq == null ? null : board[sq]

  switch (cardId) {
    case 'coronation': {
      const piece = pieceAt(square)
      if (!piece || piece.color !== color) return null
      if (piece.type === 'k' || piece.type === 'q') return null
      board[square!] = { type: 'q', color }
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'swap': {
      if (square == null || square2 == null) return null
      const a = pieceAt(square)
      const b = pieceAt(square2)
      if (!a || !b || a.color !== color || b.color !== color) return null
      if (a.type === 'k' || b.type === 'k') return null
      board[square] = b
      board[square2] = a
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'recall': {
      if (square == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color !== color) return null
      const home = homeSquareFor(board, square, piece)
      if (home == null || home === square) return null
      board[home] = piece
      board[square] = null
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'bomb': {
      if (square == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color === color || piece.type === 'k') return null
      board[square] = null
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'promote-now': {
      if (square == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color !== color || piece.type !== 'p') return null
      const to = promotion ?? 'n'
      if (to !== 'n' && to !== 'b' && to !== 'r') return null
      board[square] = { type: to, color }
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'time-skip': {
      augments = consumeCard(augments, color, cardId)
      const budget = actionsForTurn(state.fullMove, state.rules ?? [])
      const next = cloneState(state)
      next.augments = augments
      next.actionsRemaining = (next.actionsRemaining ?? 1) + budget
      next.prev = snapshotOf(state)
      return next
    }

    case 'eclipse': {
      if (square == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color === color || piece.type === 'k') return null
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true, {
        eclipse: { square, until: color },
      })
    }

    case 'rewind': {
      if (!state.prev) return null
      const snap = state.prev
      augments = consumeCard(augments, color, cardId)
      const next: GameState = {
        ...cloneState(state),
        board: snap.board.map((p) => (p ? { ...p } : null)),
        castling: { ...snap.castling },
        epSquare: snap.epSquare,
        turn: color,
        fullMove: state.fullMove,
        actionsRemaining: Math.max(1, state.actionsRemaining ?? 1),
        lastMove: snap.lastMove ? { ...snap.lastMove } : null,
        hasMoved: { ...snap.hasMoved },
        lastMovedTo: snap.lastMovedTo,
        eclipse: snap.eclipse ? { ...snap.eclipse } : null,
        echoSquare: snap.echoSquare,
        echoFor: snap.echoFor,
        crookedFrom: null,
        sharedPoolUsed: snap.sharedPoolUsed,
        borrowedTimeUsed: { ...snap.borrowedTimeUsed },
        augments,
        prev: null,
        result: null,
        phase: 'playing',
        draft: null,
      }
      return resolveEndConditions(next)
    }

    case 'smuggle': {
      if (square == null || square2 == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color !== color || piece.type === 'k') return null
      if (board[square2]) return null
      const rank = Math.floor(square2 / 8)
      const backTwo =
        color === 'w' ? rank === 7 || rank === 6 : rank === 0 || rank === 1
      if (!backTwo) return null
      board[square2] = piece
      board[square] = null
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'duel': {
      if (square == null || square2 == null) return null
      const a = pieceAt(square)
      const b = pieceAt(square2)
      if (!a || !b) return null
      if (a.color !== color || b.color === color) return null
      if (a.type === 'k' || b.type === 'k') return null
      if (!isAdjacent(square, square2)) return null
      board[square] = null
      board[square2] = null
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'crown-split': {
      if (square == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color !== color || piece.type !== 'q') return null
      const fr = Math.floor(square / 8)
      const fc = square % 8
      const adj: number[] = []
      for (const [dr, dc] of [
        [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
      ]) {
        const r = fr + dr
        const c = fc + dc
        if (r < 0 || r > 7 || c < 0 || c > 7) continue
        const sq = r * 8 + c
        if (!board[sq]) adj.push(sq)
      }
      if (!adj.length) return null
      board[square] = { type: 'n', color }
      board[adj[0]] = { type: 'n', color }
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, board, augments, true)
    }

    case 'poltergeist': {
      if (square == null || square2 == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color === color || piece.type === 'k') return null
      const enemy = piece.color
      const quiet = generateMoves(
        board,
        square,
        enemy,
        state.castling,
        state.epSquare,
        moveGenOpts({ ...state, board }, enemy),
      ).filter((m) => !m.captured && m.to === square2)
      if (!quiet.length) return null
      const moved = applyMoveToBoard(board, quiet[0])
      augments = consumeCard(augments, color, cardId)
      return finishCardUse(state, moved, augments, true)
    }

    case 'bargain': {
      if (square == null) return null
      const piece = pieceAt(square)
      if (!piece || piece.color !== color || piece.type !== 'p') return null
      board[square] = null
      augments = consumeCard(augments, color, cardId)
      const next = cloneState(state)
      next.board = board
      next.augments = augments
      next.actionsRemaining = (next.actionsRemaining ?? 1) + 1
      next.prev = snapshotOf(state)
      return resolveEndConditions(next)
    }

    default:
      return null
  }
}

/** @deprecated Prefer useActiveCard */
export function useCoronation(
  state: GameState,
  square: number,
): GameState | null {
  return useActiveCard(state, 'coronation', { square })
}

/** Draft pick: one card for the current picker, then the other side (if needed). */
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
  let board = state.board.map((p) => (p ? { ...p } : null))
  let castling = { ...state.castling }
  let augments = {
    w: [...(state.augments?.w ?? [])],
    b: [...(state.augments?.b ?? [])],
  }
  const rules = [...(state.rules ?? [])]
  const picksMade = {
    w: state.picksMade?.w ?? 0,
    b: state.picksMade?.b ?? 0,
  }

  if (card.kind === 'rule') {
    if (rules.includes(cardId)) return null
    rules.push(cardId)
  } else {
    if (augments[by].includes(cardId)) return null
    augments[by].push(cardId)
    // Openings gained mid-game resolve immediately if you've already moved.
    if (card.kind === 'opening' && (state.hasMoved?.[by] ?? false)) {
      const opened = triggerOpeningCards(by, board, augments, castling)
      board = opened.board
      augments = opened.augments
      castling = opened.castling
    }
  }

  picksMade[by] += 1

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
  } else if (picksLeft[by] > 0) {
    picker = by
    draft = { picker, picksLeft }
  } else if (picksLeft[other] > 0) {
    picker = other
    draft = { picker, picksLeft }
  } else {
    phase = 'playing'
    draft = null
  }

  return {
    ...cloneState(state),
    board,
    castling,
    augments,
    rules,
    picksMade,
    phase,
    draft,
    // Only reset the action clock when leaving the opening draft into play.
    actionsRemaining:
      phase === 'playing' && !state.lastMove
        ? actionsForTurn(state.fullMove, rules)
        : state.actionsRemaining,
  }
}

export function getLegalMoves(state: GameState, from: number): Move[] {
  if (state.result || state.phase !== 'playing') return []
  const moves = generateMoves(
    state.board,
    from,
    state.turn,
    state.castling,
    state.epSquare,
    moveGenOpts(state),
  )
  if (hasRule(state.rules, 'blood-moon')) {
    const all = generateAllMoves(
      state.board,
      state.turn,
      state.castling,
      state.epSquare,
      moveGenOpts(state),
    )
    if (all.some((m) => m.captured)) {
      return moves.filter((m) => m.captured)
    }
  }
  return moves
}

export function getAllLegalMoves(state: GameState): Move[] {
  if (state.result || state.phase !== 'playing') return []
  return generateAllMoves(
    state.board,
    state.turn,
    state.castling,
    state.epSquare,
    moveGenOpts(state),
  )
}

export function resultLabel(result: GameResult): string {
  const side = (c: Color) => (c === 'w' ? 'White' : 'Black')
  switch (result.reason) {
    case 'king-captured':
      return `${side(result.winner as Color)} wins — king captured`
    case 'no-moves':
      return `${side(result.winner as Color)} wins — opponent has no moves`
    case 'sudden-death':
      return `${side(result.winner as Color)} wins — sudden death capture`
    case 'threefold':
      return 'Draw — threefold repetition (star totals decide with cards)'
    case 'overtime':
      return 'Draw — overtime idle (star totals decide with cards)'
    default:
      return 'Game over'
  }
}

/** Valid destinations for smuggle after picking a piece. */
export function smuggleTargets(state: GameState, from: number): number[] {
  const piece = state.board[from]
  if (!piece || piece.color !== state.turn || piece.type === 'k') return []
  const out: number[] = []
  for (let sq = 0; sq < 64; sq++) {
    if (state.board[sq]) continue
    const rank = Math.floor(sq / 8)
    const ok =
      piece.color === 'w' ? rank === 7 || rank === 6 : rank === 0 || rank === 1
    if (ok) out.push(sq)
  }
  return out
}

/** Quiet destinations for poltergeist. */
export function poltergeistTargets(state: GameState, from: number): number[] {
  const piece = state.board[from]
  if (!piece || piece.color === state.turn || piece.type === 'k') return []
  return generateMoves(
    state.board,
    from,
    piece.color,
    state.castling,
    state.epSquare,
    moveGenOpts(state, piece.color),
  )
    .filter((m) => !m.captured)
    .map((m) => m.to)
}
