import { hasAugment, hasRule, type AugmentId } from '../augments/catalog'
import type { Color, Move, Piece, PieceType } from './types'
import { opposite } from './types'

const ORTHO_DELTAS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

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

/** Extra knight leaps when Long Stride is on the piece. */
const KNIGHT_STRIDE_DELTAS = [
  [-3, -1],
  [-3, 1],
  [-1, -3],
  [-1, 3],
  [1, -3],
  [1, 3],
  [3, -1],
  [3, 1],
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

export interface MoveGenOpts {
  owned?: readonly AugmentId[]
  opponentOwned?: readonly AugmentId[]
  rules?: readonly AugmentId[]
  lastMovedTo?: number | null
  eclipse?: { square: number; until: Color } | null
  glacier?: { against: Color; remaining: number } | null
  echoSquare?: number | null
  echoFor?: Color | null
  crookedFrom?: number | null
  twinFrom?: number | null
  fullMove?: number
}

function onBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function idx(row: number, col: number): number {
  return row * 8 + col
}

function twin(sq: number): number {
  return 63 - sq
}

function isAdjacent(a: number, b: number): boolean {
  const ar = Math.floor(a / 8)
  const ac = a % 8
  const br = Math.floor(b / 8)
  const bc = b % 8
  return Math.max(Math.abs(ar - br), Math.abs(ac - bc)) === 1
}

function findKing(board: (Piece | null)[], color: Color): number | null {
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (p?.type === 'k' && p.color === color) return i
  }
  return null
}

function rookImmuneToPawn(
  target: Piece,
  to: number,
  opponentOwned: readonly AugmentId[],
): boolean {
  if (target.type !== 'r') return false
  if (hasAugment(opponentOwned, 'iron-rook')) return true
  if (
    hasAugment(opponentOwned, 'anchor-rook') &&
    (to === 0 || to === 7 || to === 56 || to === 63)
  ) {
    return true
  }
  return false
}

function slide(
  board: (Piece | null)[],
  from: number,
  color: Color,
  dirs: number[][],
  opts: {
    passFriendlyOnce?: boolean
    hopAnyOnce?: boolean
    blockSquare?: number | null
  } = {},
): Move[] {
  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const fc = from % 8

  for (const [dr, dc] of dirs) {
    let r = fr + dr
    let c = fc + dc
    let passedFriendly = false
    let hopped = false
    while (onBoard(r, c)) {
      const to = idx(r, c)
      if (opts.blockSquare === to) break
      const target = board[to]
      if (!target) {
        moves.push({ from, to })
      } else if (opts.hopAnyOnce && !hopped) {
        hopped = true
      } else if (target.color === color) {
        if (opts.passFriendlyOnce && !passedFriendly && !hopped) {
          passedFriendly = true
        } else {
          break
        }
      } else {
        moves.push({ from, to, captured: target })
        break
      }
      r += dr
      c += dc
    }
  }
  return moves
}

function moveKey(m: Move): string {
  return `${m.from}-${m.to}-${m.promotion ?? ''}-${m.enPassant ? 'e' : ''}-${m.castle ?? ''}-${m.doublePawn ? 'd' : ''}-${m.castleRookFrom ?? ''}-${m.crookedStep ? 'c' : ''}-${m.twinStep ? 't' : ''}-${m.leapSquare ?? ''}`
}

function isCaptureMove(m: Move): boolean {
  return !!m.captured || !!m.leapCaptured
}

/** Mid-square on a knight's 2-step orthogonal leg (null if not an L-move). */
function knightLeapSquare(from: number, to: number): number | null {
  const fr = Math.floor(from / 8)
  const fc = from % 8
  const tr = Math.floor(to / 8)
  const tc = to % 8
  const dr = tr - fr
  const dc = tc - fc
  const adr = Math.abs(dr)
  const adc = Math.abs(dc)
  if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return null
  if (adr === 2) return idx(fr + Math.sign(dr), fc)
  return idx(fr, fc + Math.sign(dc))
}

function dedupeMoves(moves: Move[]): Move[] {
  const seen = new Set<string>()
  return moves.filter((m) => {
    const key = moveKey(m)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Keep only the furthest landing square on each ray (Glacier). */
function keepMaxRangeOnly(from: number, moves: Move[]): Move[] {
  const fr = Math.floor(from / 8)
  const fc = from % 8
  const byDir = new Map<string, Move>()
  const passthrough: Move[] = []

  for (const m of moves) {
    if (m.castle || m.enPassant || m.crookedStep || m.twinStep) {
      passthrough.push(m)
      continue
    }
    const tr = Math.floor(m.to / 8)
    const tc = m.to % 8
    const dr = Math.sign(tr - fr)
    const dc = Math.sign(tc - fc)
    const key = `${dr},${dc}`
    const dist = Math.max(Math.abs(tr - fr), Math.abs(tc - fc))
    const prev = byDir.get(key)
    if (!prev) {
      byDir.set(key, m)
      continue
    }
    const prevDist = Math.max(
      Math.abs(Math.floor(prev.to / 8) - fr),
      Math.abs((prev.to % 8) - fc),
    )
    if (dist > prevDist) byDir.set(key, m)
  }

  return [...byDir.values(), ...passthrough]
}

function pawnMoves(
  board: (Piece | null)[],
  from: number,
  color: Color,
  epSquare: number | null,
  owned: readonly AugmentId[],
  opponentOwned: readonly AugmentId[],
): Move[] {
  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const fc = from % 8
  const dir = color === 'w' ? -1 : 1
  const startRank = color === 'w' ? 6 : 1
  const promoRank = color === 'w' ? 0 : 7
  const promotions: PieceType[] = ['q', 'r', 'b', 'n']
  const storm = hasAugment(owned, 'pawn-storm')
  const ghost = hasAugment(owned, 'ghost-pawn')
  const stride = !!board[from]?.stride

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
  if (onBoard(fr + dir, fc)) {
    if (!board[one]) {
      pushPromo(one)
      const twoR = fr + 2 * dir
      const two = idx(twoR, fc)
      if (onBoard(twoR, fc) && !board[two]) {
        if (fr === startRank) {
          moves.push({ from, to: two, doublePawn: !storm })
          // Long Stride: one more step from the home rank.
          if (stride) {
            const threeR = fr + 3 * dir
            const three = idx(threeR, fc)
            if (onBoard(threeR, fc) && !board[three]) {
              pushPromo(three)
            }
          }
        } else if (storm || stride) {
          moves.push({ from, to: two })
        }
      }
    } else if (
      ghost &&
      board[one]?.type === 'p' &&
      board[one]?.color === color
    ) {
      const twoR = fr + 2 * dir
      const two = idx(twoR, fc)
      if (onBoard(twoR, fc) && !board[two]) {
        pushPromo(two)
      }
    }
  }

  for (const dc of [-1, 1]) {
    const r = fr + dir
    const c = fc + dc
    if (!onBoard(r, c)) continue
    const to = idx(r, c)
    const target = board[to]
    if (target && target.color !== color) {
      if (
        target.type === 'r' &&
        rookImmuneToPawn(target, to, opponentOwned)
      ) {
        continue
      }
      pushPromo(to, target)
    } else if (epSquare === to) {
      const capturedSq = idx(fr, c)
      const captured = board[capturedSq]
      if (captured) {
        if (
          captured.type === 'r' &&
          rookImmuneToPawn(captured, capturedSq, opponentOwned)
        ) {
          continue
        }
        moves.push({ from, to, captured, enPassant: true })
      }
    }
  }

  if (hasAugment(owned, 'omni-pawn')) {
    for (const [dr, dc] of ORTHO_DELTAS) {
      const r = fr + dr
      const c = fc + dc
      if (!onBoard(r, c)) continue
      const to = idx(r, c)
      const target = board[to]
      if (!target) {
        pushPromo(to)
      } else if (target.color !== color) {
        if (
          target.type === 'r' &&
          rookImmuneToPawn(target, to, opponentOwned)
        ) {
          continue
        }
        pushPromo(to, target)
      }
    }
  }

  return dedupeMoves(moves)
}

function longCastleMoves(
  board: (Piece | null)[],
  from: number,
  color: Color,
): Move[] {
  const moves: Move[] = []
  const back = color === 'w' ? 7 : 0
  const fr = Math.floor(from / 8)
  const fc = from % 8
  if (fr !== back || fc !== 4) return moves

  for (let file = 0; file < 8; file++) {
    if (file === fc) continue
    const rookSq = idx(back, file)
    const rook = board[rookSq]
    if (rook?.type !== 'r' || rook.color !== color) continue

    const dir = file > fc ? 1 : -1
    let clear = true
    for (let c = fc + dir; c !== file; c += dir) {
      if (board[idx(back, c)]) {
        clear = false
        break
      }
    }
    if (!clear) continue

    const kingToFile = fc + 2 * dir
    if (!onBoard(back, kingToFile)) continue
    if (dir > 0 && kingToFile > file) continue
    if (dir < 0 && kingToFile < file) continue
    const kingTo = idx(back, kingToFile)
    if (kingTo !== rookSq && board[kingTo]) continue

    moves.push({
      from,
      to: kingTo,
      castle: dir > 0 ? 'K' : 'Q',
      castleRookFrom: rookSq,
    })
  }

  return moves
}

function kingMoves(
  board: (Piece | null)[],
  from: number,
  color: Color,
  castling: { K: boolean; Q: boolean },
  owned: readonly AugmentId[],
  rules: readonly AugmentId[],
): Move[] {
  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const fc = from % 8
  const stride = !!board[from]?.stride

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

  // Long Stride: also step two squares in each king direction if the path is clear.
  if (stride) {
    for (const [dr, dc] of KING_DELTAS) {
      const midR = fr + dr
      const midC = fc + dc
      const r = fr + 2 * dr
      const c = fc + 2 * dc
      if (!onBoard(midR, midC) || !onBoard(r, c)) continue
      if (board[idx(midR, midC)]) continue
      const to = idx(r, c)
      const target = board[to]
      if (!target || target.color !== color) {
        moves.push({ from, to, captured: target ?? undefined })
      }
    }
  }

  if (hasRule(rules, 'mirror')) return moves

  const back = color === 'w' ? 7 : 0
  if (fr === back && fc === 4) {
    if (castling.K && !board[idx(back, 5)] && !board[idx(back, 6)]) {
      const rook = board[idx(back, 7)]
      if (rook?.type === 'r' && rook.color === color) {
        moves.push({ from, to: idx(back, 6), castle: 'K', castleRookFrom: idx(back, 7) })
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
        moves.push({ from, to: idx(back, 2), castle: 'Q', castleRookFrom: idx(back, 0) })
      }
    }
  }

  if (hasAugment(owned, 'longcastle')) {
    moves.push(...longCastleMoves(board, from, color))
  }

  return dedupeMoves(moves)
}

function highwayFileMoves(
  board: (Piece | null)[],
  from: number,
  color: Color,
  pieceType: PieceType,
  blockSquare: number | null,
): Move[] {
  const fc = from % 8
  if (fc !== 1 && fc !== 6) return []

  const moves: Move[] = []
  const fr = Math.floor(from / 8)
  const promoRank = color === 'w' ? 0 : 7
  const promotions: PieceType[] = ['q', 'r', 'b', 'n']

  const push = (to: number, captured?: Piece) => {
    const toRank = Math.floor(to / 8)
    if (pieceType === 'p' && toRank === promoRank) {
      for (const promotion of promotions) {
        moves.push({ from, to, promotion, captured })
      }
    } else {
      moves.push({ from, to, captured })
    }
  }

  for (const dr of [-1, 1]) {
    let r = fr + dr
    while (onBoard(r, fc)) {
      const to = idx(r, fc)
      if (blockSquare === to) break
      const target = board[to]
      if (!target) {
        push(to)
      } else {
        if (target.color !== color) push(to, target)
        break
      }
      r += dr
    }
  }

  return moves
}

function filterRuleConstraints(
  board: (Piece | null)[],
  turn: Color,
  moves: Move[],
  rules: readonly AugmentId[],
  fullMove: number,
  lastMovedTo: number | null,
): Move[] {
  let out = moves

  if (hasRule(rules, 'fog') && lastMovedTo != null) {
    out = out.filter((m) => !(m.from === lastMovedTo && isCaptureMove(m)))
  }

  if (hasRule(rules, 'narrow-board')) {
    out = out.filter((m) => {
      const f = m.to % 8
      return f !== 0 && f !== 7
    })
  }

  if (hasRule(rules, 'tidal-files')) {
    const odd = fullMove % 2 === 1
    out = out.filter((m) => {
      const f = m.to % 8
      return odd ? f <= 3 : f >= 4
    })
  }

  if (hasRule(rules, 'inkblot')) {
    out = out.filter((m) => {
      const t = twin(m.to)
      if (t === m.from) return true
      return !board[t]
    })
  }

  if (hasRule(rules, 'symmetry-tax')) {
    const enemyKing = findKing(board, opposite(turn))
    out = out.filter((m) => {
      const piece = board[m.from]
      if (!piece) return false
      let kingFile: number
      if (piece.type === 'k') {
        kingFile = m.to % 8
      } else {
        const myKing = findKing(board, turn)
        if (myKing == null) return true
        kingFile = myKing % 8
      }
      if (enemyKing == null) return true
      return kingFile !== (enemyKing % 8)
    })
  }

  if (hasRule(rules, 'no-quiet') && fullMove > 10) {
    const enemyKing = findKing(board, opposite(turn))
    out = out.filter((m) => {
      if (isCaptureMove(m)) return true
      if (enemyKing == null) return false
      return isAdjacent(m.to, enemyKing)
    })
  }

  if (hasRule(rules, 'quiet-hours') && fullMove % 2 === 1) {
    out = out.filter((m) => !isCaptureMove(m))
  }

  if (hasRule(rules, 'gravity')) {
    out = out.filter((m) => {
      const p = board[m.from]
      if (!p || p.type === 'n' || p.type === 'k') return true
      const fromR = Math.floor(m.from / 8)
      const toR = Math.floor(m.to / 8)
      // White back is row 7 (backward = higher row); black back is row 0.
      if (turn === 'w') return toR <= fromR
      return toR >= fromR
    })
  }

  return out
}

function applyBloodMoon(moves: Move[], rules: readonly AugmentId[]): Move[] {
  if (!hasRule(rules, 'blood-moon')) return moves
  if (moves.some((m) => isCaptureMove(m))) {
    return moves.filter((m) => isCaptureMove(m))
  }
  return moves
}

function normalizeOpts(
  opts: MoveGenOpts | readonly AugmentId[] = [],
  rulesArg: readonly AugmentId[] = [],
): MoveGenOpts {
  if (Array.isArray(opts)) {
    return { owned: opts as readonly AugmentId[], rules: rulesArg }
  }
  return opts as MoveGenOpts
}

export function generateMoves(
  board: (Piece | null)[],
  from: number,
  turn: Color,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  epSquare: number | null,
  opts: MoveGenOpts | readonly AugmentId[] = [],
  rulesArg: readonly AugmentId[] = [],
): Move[] {
  const options = normalizeOpts(opts, rulesArg)

  const owned = options.owned ?? []
  const opponentOwned = options.opponentOwned ?? []
  const rules = options.rules ?? []
  const lastMovedTo = options.lastMovedTo ?? null
  const eclipse = options.eclipse ?? null
  const glacier = options.glacier ?? null
  const echoSquare = options.echoSquare ?? null
  const echoFor = options.echoFor ?? null
  const crookedFrom = options.crookedFrom ?? null
  const twinFrom = options.twinFrom ?? null
  const fullMove = options.fullMove ?? 1

  const piece = board[from]
  if (!piece || piece.color !== turn) return []

  if (eclipse && eclipse.square === from) return []

  // Crooked Knight bonus: only non-capturing king-steps from that square.
  if (crookedFrom === from && hasAugment(owned, 'crooked-knight')) {
    const fr = Math.floor(from / 8)
    const fc = from % 8
    const steps: Move[] = []
    for (const [dr, dc] of KING_DELTAS) {
      const r = fr + dr
      const c = fc + dc
      if (!onBoard(r, c)) continue
      const to = idx(r, c)
      if (!board[to]) {
        steps.push({ from, to, crookedStep: true })
      }
    }
    return filterRuleConstraints(board, turn, steps, rules, fullMove, lastMovedTo)
  }

  // Twin Knights bonus: quiet knight-hops from the other knight.
  if (twinFrom === from && hasAugment(owned, 'twin-knights')) {
    const fr = Math.floor(from / 8)
    const fc = from % 8
    const reckless = hasAugment(owned, 'reckless-charge')
    const steps: Move[] = []
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const r = fr + dr
      const c = fc + dc
      if (!onBoard(r, c)) continue
      const to = idx(r, c)
      if (board[to]) continue
      const move: Move = { from, to, twinStep: true }
      if (reckless) {
        const leap = knightLeapSquare(from, to)
        if (leap != null) {
          const mid = board[leap]
          if (mid && mid.color !== turn) {
            move.leapSquare = leap
            move.leapCaptured = mid
          }
        }
      }
      steps.push(move)
    }
    return filterRuleConstraints(board, turn, steps, rules, fullMove, lastMovedTo)
  }

  const echoBlocks =
    echoSquare != null && echoFor != null && echoFor !== turn
      ? echoSquare
      : null

  let moves: Move[]
  switch (piece.type) {
    case 'p':
      moves = pawnMoves(board, from, turn, epSquare, owned, opponentOwned)
      break
    case 'n': {
      moves = []
      const fr = Math.floor(from / 8)
      const fc = from % 8
      const reckless = hasAugment(owned, 'reckless-charge')
      const deltas = piece.stride
        ? [...KNIGHT_DELTAS, ...KNIGHT_STRIDE_DELTAS]
        : KNIGHT_DELTAS
      for (const [dr, dc] of deltas) {
        const r = fr + dr
        const c = fc + dc
        if (!onBoard(r, c)) continue
        const to = idx(r, c)
        const target = board[to]
        if (target && target.color === turn) continue
        const move: Move = { from, to, captured: target ?? undefined }
        if (reckless) {
          const leap = knightLeapSquare(from, to)
          if (leap != null) {
            const mid = board[leap]
            if (mid && mid.color !== turn) {
              move.leapSquare = leap
              move.leapCaptured = mid
            }
          }
        }
        moves.push(move)
      }
      if (hasAugment(owned, 'knightmare')) {
        for (const [dr, dc] of ORTHO_DELTAS) {
          const r = fr + dr
          const c = fc + dc
          if (!onBoard(r, c)) continue
          const to = idx(r, c)
          const target = board[to]
          if (!target || target.color !== turn) {
            moves.push({ from, to, captured: target ?? undefined })
          }
        }
      }
      if (hasAugment(owned, 'militia')) {
        const dir = turn === 'w' ? -1 : 1
        for (const dc of [-1, 1]) {
          const r = fr + dir
          const c = fc + dc
          if (!onBoard(r, c)) continue
          const to = idx(r, c)
          const target = board[to]
          if (target && target.color !== turn) {
            moves.push({ from, to, captured: target })
          }
        }
      }
      break
    }
    case 'b':
      moves = slide(board, from, turn, BISHOP_DIRS, {
        passFriendlyOnce: hasAugment(owned, 'slippery-bishop'),
        hopAnyOnce:
          hasAugment(owned, 'hopping-bishop') || !!piece.stride,
        blockSquare: echoBlocks,
      })
      break
    case 'r':
      moves = slide(board, from, turn, ROOK_DIRS, {
        hopAnyOnce: !!piece.stride,
        blockSquare: echoBlocks,
      })
      break
    case 'q':
      moves = slide(board, from, turn, [...BISHOP_DIRS, ...ROOK_DIRS], {
        blockSquare: echoBlocks,
      })
      break
    case 'k':
      moves = kingMoves(board, from, turn, {
        K: turn === 'w' ? castlingRights.wK : castlingRights.bK,
        Q: turn === 'w' ? castlingRights.wQ : castlingRights.bQ,
      }, owned, rules)
      break
    default:
      return []
  }

  // Non-pawn captures of iron/anchor rooks are allowed; only pawns blocked above.
  // Filter pawn-like omni already handled. Also filter any remaining pawn hits:
  if (piece.type === 'p') {
    moves = moves.filter((m) => {
      if (!m.captured || m.captured.type !== 'r') return true
      const capSq = m.enPassant
        ? Math.floor(m.from / 8) * 8 + (m.to % 8)
        : m.to
      return !rookImmuneToPawn(m.captured, capSq, opponentOwned)
    })
  }

  if (hasRule(rules, 'highway')) {
    moves = dedupeMoves([
      ...moves,
      ...highwayFileMoves(board, from, turn, piece.type, echoBlocks),
    ])
  }

  moves = filterRuleConstraints(
    board,
    turn,
    dedupeMoves(moves),
    rules,
    fullMove,
    lastMovedTo,
  )

  // Glacier: affected side's long-range pieces may only travel max range.
  if (
    glacier &&
    glacier.against === turn &&
    glacier.remaining > 0 &&
    (piece.type === 'b' || piece.type === 'r' || piece.type === 'q')
  ) {
    moves = keepMaxRangeOnly(from, moves)
  }

  return moves
}

export function generateAllMoves(
  board: (Piece | null)[],
  turn: Color,
  castlingRights: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean },
  epSquare: number | null,
  opts: MoveGenOpts | readonly AugmentId[] = [],
  rulesArg: readonly AugmentId[] = [],
): Move[] {
  const options = normalizeOpts(opts, rulesArg)

  const moves: Move[] = []
  for (let sq = 0; sq < 64; sq++) {
    if (board[sq]?.color === turn) {
      moves.push(
        ...generateMoves(board, sq, turn, castlingRights, epSquare, options),
      )
    }
  }
  return applyBloodMoon(moves, options.rules ?? [])
}

export function isSquareAttacked(
  board: (Piece | null)[],
  square: number,
  by: Color,
  owned: readonly AugmentId[] = [],
  rules: readonly AugmentId[] = [],
): boolean {
  const moves = generateAllMoves(
    board,
    by,
    { wK: false, wQ: false, bK: false, bQ: false },
    null,
    { owned, rules },
  )
  return moves.some((m) => m.to === square)
}

export { findKing, opposite, isAdjacent }
