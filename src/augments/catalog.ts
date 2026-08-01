export type AugmentId =
  // Existing
  | 'omni-pawn'
  | 'acceleration'
  | 'highway'
  | 'coronation'
  | 'horde'
  // Piece
  | 'knightmare'
  | 'longcastle'
  | 'slippery-bishop'
  | 'iron-rook'
  | 'pawn-storm'
  | 'ghost-pawn'
  | 'crooked-knight'
  | 'glass-queen'
  | 'anchor-rook'
  | 'seed-bishop'
  | 'echo-lane'
  | 'hopping-bishop'
  | 'twin-knights'
  | 'militia'
  // Active
  | 'swap'
  | 'recall'
  | 'bomb'
  | 'promote-now'
  | 'time-skip'
  | 'eclipse'
  | 'rewind'
  | 'smuggle'
  | 'duel'
  | 'crown-split'
  | 'poltergeist'
  | 'bargain'
  | 'recruit'
  | 'teleport'
  | 'castle-now'
  // RULE
  | 'fog'
  | 'mirror'
  | 'blood-moon'
  | 'narrow-board'
  | 'shared-pool'
  | 'sudden-death'
  | 'tidal-files'
  | 'no-quiet'
  | 'symmetry-tax'
  | 'borrowed-time'
  | 'inkblot'
  | 'quiet-hours'
  | 'gravity'
  | 'king-hunt'
  // OPENING
  | 'castle-siege'
  | 'queens-gambit-denied'
  | 'phalanx'
  | 'lone-king'
  | 'scatter'
  | 'vault'
  | 'nursery'
  | 'embassy'
  | 'ash-start'
  | 'cuckoo'
  | 'fianchetto-both'
  | 'knight-out'
  | 'king-walk'

export type AugmentKind = 'piece' | 'rule' | 'active' | 'opening'

export type ActiveTarget =
  | 'none'
  | 'own-piece'
  | 'own-non-king'
  | 'own-pawn'
  | 'own-queen'
  | 'own-rook'
  | 'enemy-non-king'
  | 'empty'
  | 'empty-second-rank'
  | 'empty-back-rank'
  | 'two-own-non-king'
  | 'duel-pair'
  | 'promote-pawn'

export interface AugmentCard {
  id: AugmentId
  name: string
  kind: AugmentKind
  stars: number
  summary: string
  art: 'black'
  /** How the active is targeted in the UI (actives only). */
  target?: ActiveTarget
}

/** File indices (0=a … 7=h) with highways when the RULE is active. */
export const HIGHWAY_FILES = [1, 6] as const

export const AUGMENTS: Record<AugmentId, AugmentCard> = {
  'omni-pawn': {
    id: 'omni-pawn',
    name: 'Omni Pawn',
    kind: 'piece',
    stars: 1,
    summary: 'Your pawns can move one square left, right, up, or down.',
    art: 'black',
  },
  acceleration: {
    id: 'acceleration',
    name: 'Acceleration',
    kind: 'rule',
    stars: 0,
    summary: 'From the third turn, every player takes 2 actions per turn.',
    art: 'black',
  },
  highway: {
    id: 'highway',
    name: 'Highway',
    kind: 'rule',
    stars: 0,
    summary:
      'Install highways on the b and g files. Pieces on them can slide freely along the file.',
    art: 'black',
  },
  coronation: {
    id: 'coronation',
    name: 'Coronation',
    kind: 'active',
    stars: 2,
    summary:
      'Choose one of your pieces (except the king) and turn it into a queen. Once.',
    art: 'black',
    target: 'own-non-king',
  },
  horde: {
    id: 'horde',
    name: 'Horde',
    kind: 'opening',
    stars: 4,
    summary:
      'After your first move, remove all your pieces except the king and switch to the Horde layout.',
    art: 'black',
  },

  knightmare: {
    id: 'knightmare',
    name: 'Knightmare',
    kind: 'piece',
    stars: 2,
    summary: 'Your knights may also move one square orthogonally.',
    art: 'black',
  },
  longcastle: {
    id: 'longcastle',
    name: 'Longcastle',
    kind: 'piece',
    stars: 1,
    summary:
      'Your king may castle with any of your rooks on the back rank if the path is empty.',
    art: 'black',
  },
  'slippery-bishop': {
    id: 'slippery-bishop',
    name: 'Slippery Bishop',
    kind: 'piece',
    stars: 2,
    summary: 'Your bishops can pass through one friendly piece per move.',
    art: 'black',
  },
  'iron-rook': {
    id: 'iron-rook',
    name: 'Iron Rook',
    kind: 'piece',
    stars: 2,
    summary: 'Your rooks cannot be captured by pawns.',
    art: 'black',
  },
  'pawn-storm': {
    id: 'pawn-storm',
    name: 'Pawn Storm',
    kind: 'piece',
    stars: 1,
    summary:
      'Your pawns may always step two forward when the path is clear (no en passant from that).',
    art: 'black',
  },
  'ghost-pawn': {
    id: 'ghost-pawn',
    name: 'Ghost Pawn',
    kind: 'piece',
    stars: 2,
    summary: 'Your pawns may step forward through one friendly pawn.',
    art: 'black',
  },
  'crooked-knight': {
    id: 'crooked-knight',
    name: 'Crooked Knight',
    kind: 'piece',
    stars: 1,
    summary:
      'After a knight move, that knight may take one extra non-capturing king-step this turn.',
    art: 'black',
  },
  'glass-queen': {
    id: 'glass-queen',
    name: 'Glass Queen',
    kind: 'piece',
    stars: 3,
    summary: 'Your queen moves normally, but is also removed whenever she captures.',
    art: 'black',
  },
  'anchor-rook': {
    id: 'anchor-rook',
    name: 'Anchor Rook',
    kind: 'piece',
    stars: 2,
    summary:
      'Rooks still on their starting corner squares cannot be captured by pawns.',
    art: 'black',
  },
  'seed-bishop': {
    id: 'seed-bishop',
    name: 'Seed Bishop',
    kind: 'piece',
    stars: 2,
    summary:
      'When your bishop captures, spawn a pawn on the square it left if that square is empty.',
    art: 'black',
  },
  'echo-lane': {
    id: 'echo-lane',
    name: 'Echo Lane',
    kind: 'piece',
    stars: 2,
    summary:
      'After you slide a rook, bishop, or queen, leave an echo on the square you left that blocks enemy slides until your next turn.',
    art: 'black',
  },
  'hopping-bishop': {
    id: 'hopping-bishop',
    name: 'Hopping Bishop',
    kind: 'piece',
    stars: 2,
    summary: 'Your bishops may jump over exactly one piece per move.',
    art: 'black',
  },
  'twin-knights': {
    id: 'twin-knights',
    name: 'Twin Knights',
    kind: 'piece',
    stars: 2,
    summary:
      'After you move a knight, your other knight may make one non-capturing knight-hop this turn.',
    art: 'black',
  },
  militia: {
    id: 'militia',
    name: 'Militia',
    kind: 'piece',
    stars: 1,
    summary: 'Your knights may also capture one square diagonally forward.',
    art: 'black',
  },

  swap: {
    id: 'swap',
    name: 'Swap',
    kind: 'active',
    stars: 2,
    summary: 'Swap the positions of two of your non-king pieces. Once.',
    art: 'black',
    target: 'two-own-non-king',
  },
  recall: {
    id: 'recall',
    name: 'Recall',
    kind: 'active',
    stars: 2,
    summary:
      'Return one of your pieces to its starting square if that square is empty. Once.',
    art: 'black',
    target: 'own-piece',
  },
  bomb: {
    id: 'bomb',
    name: 'Bomb',
    kind: 'active',
    stars: 3,
    summary: 'Remove any enemy non-king piece. Once.',
    art: 'black',
    target: 'enemy-non-king',
  },
  'promote-now': {
    id: 'promote-now',
    name: 'Promote Now',
    kind: 'active',
    stars: 2,
    summary: 'Promote one of your pawns in place to a knight, bishop, or rook. Once.',
    art: 'black',
    target: 'promote-pawn',
  },
  'time-skip': {
    id: 'time-skip',
    name: 'Time Skip',
    kind: 'active',
    stars: 3,
    summary: 'Gain an extra full action budget this turn. Once.',
    art: 'black',
    target: 'none',
  },
  eclipse: {
    id: 'eclipse',
    name: 'Eclipse',
    kind: 'active',
    stars: 2,
    summary:
      'Freeze one enemy non-king piece until the start of your next turn. Once.',
    art: 'black',
    target: 'enemy-non-king',
  },
  rewind: {
    id: 'rewind',
    name: 'Rewind',
    kind: 'active',
    stars: 3,
    summary: 'Undo the last move on the board, then continue your turn. Once.',
    art: 'black',
    target: 'none',
  },
  smuggle: {
    id: 'smuggle',
    name: 'Smuggle',
    kind: 'active',
    stars: 2,
    summary:
      'Move one of your non-king pieces to any empty square on your back two ranks. Once.',
    art: 'black',
    target: 'own-non-king',
  },
  duel: {
    id: 'duel',
    name: 'Duel',
    kind: 'active',
    stars: 3,
    summary:
      'Choose one of your pieces and one enemy piece (not kings) a king-move apart; both are removed. Once.',
    art: 'black',
    target: 'duel-pair',
  },
  'crown-split': {
    id: 'crown-split',
    name: 'Crown Split',
    kind: 'active',
    stars: 4,
    summary:
      'Replace your queen with two knights on her square and one empty adjacent square. Once.',
    art: 'black',
    target: 'own-queen',
  },
  poltergeist: {
    id: 'poltergeist',
    name: 'Poltergeist',
    kind: 'active',
    stars: 3,
    summary:
      'Force one enemy non-king piece to take one of its legal non-capturing steps (you choose). Once.',
    art: 'black',
    target: 'enemy-non-king',
  },
  bargain: {
    id: 'bargain',
    name: 'Bargain',
    kind: 'active',
    stars: 2,
    summary: 'Sacrifice one of your pawns to gain an extra action this turn. Once.',
    art: 'black',
    target: 'own-pawn',
  },
  recruit: {
    id: 'recruit',
    name: 'Recruit',
    kind: 'active',
    stars: 2,
    summary: 'Place a pawn on an empty square of your second rank. Once.',
    art: 'black',
    target: 'empty-second-rank',
  },
  teleport: {
    id: 'teleport',
    name: 'Teleport',
    kind: 'active',
    stars: 3,
    summary: 'Move your king to any empty square on your back rank. Once.',
    art: 'black',
    target: 'empty-back-rank',
  },
  'castle-now': {
    id: 'castle-now',
    name: 'Castle Now',
    kind: 'active',
    stars: 2,
    summary:
      'Instantly castle with one of your rooks if the path is empty (ignores prior moves). Once.',
    art: 'black',
    target: 'own-rook',
  },

  fog: {
    id: 'fog',
    name: 'Fog',
    kind: 'rule',
    stars: 0,
    summary: 'A piece that just moved cannot capture on the following turn.',
    art: 'black',
  },
  mirror: {
    id: 'mirror',
    name: 'Mirror',
    kind: 'rule',
    stars: 0,
    summary: 'Castling is disabled for both players.',
    art: 'black',
  },
  'blood-moon': {
    id: 'blood-moon',
    name: 'Blood Moon',
    kind: 'rule',
    stars: 0,
    summary: 'If you have any capture available, you must capture.',
    art: 'black',
  },
  'narrow-board': {
    id: 'narrow-board',
    name: 'Narrow Board',
    kind: 'rule',
    stars: 0,
    summary: 'The a- and h-files cannot be moved onto.',
    art: 'black',
  },
  'shared-pool': {
    id: 'shared-pool',
    name: 'Shared Pool',
    kind: 'rule',
    stars: 0,
    summary: 'After you capture, you gain one extra action this turn (once per turn).',
    art: 'black',
  },
  'sudden-death': {
    id: 'sudden-death',
    name: 'Sudden Death',
    kind: 'rule',
    stars: 0,
    summary:
      'From move 20, capturing a knight, bishop, rook, or queen wins the game instantly.',
    art: 'black',
  },
  'tidal-files': {
    id: 'tidal-files',
    name: 'Tidal Files',
    kind: 'rule',
    stars: 0,
    summary:
      'On odd full-moves only a–d are playable; on even full-moves only e–h.',
    art: 'black',
  },
  'no-quiet': {
    id: 'no-quiet',
    name: 'No Quiet',
    kind: 'rule',
    stars: 0,
    summary:
      'After move 10, every move must capture or end next to the enemy king.',
    art: 'black',
  },
  'symmetry-tax': {
    id: 'symmetry-tax',
    name: 'Symmetry Tax',
    kind: 'rule',
    stars: 0,
    summary: 'The two kings may not stand on the same file.',
    art: 'black',
  },
  'borrowed-time': {
    id: 'borrowed-time',
    name: 'Borrowed Time',
    kind: 'rule',
    stars: 0,
    summary:
      'The first time a side has no moves, they delete one of their non-king pieces instead of losing.',
    art: 'black',
  },
  inkblot: {
    id: 'inkblot',
    name: 'Inkblot',
    kind: 'rule',
    stars: 0,
    summary:
      'You cannot move onto a square whose opposite corner twin (a1↔h8) is occupied.',
    art: 'black',
  },
  'quiet-hours': {
    id: 'quiet-hours',
    name: 'Quiet Hours',
    kind: 'rule',
    stars: 0,
    summary: 'No captures are allowed on odd full-moves.',
    art: 'black',
  },
  gravity: {
    id: 'gravity',
    name: 'Gravity',
    kind: 'rule',
    stars: 0,
    summary:
      'Pieces may not move backward toward their own back rank (except knights and kings).',
    art: 'black',
  },
  'king-hunt': {
    id: 'king-hunt',
    name: 'King Hunt',
    kind: 'rule',
    stars: 0,
    summary:
      'Capturing a piece adjacent to the enemy king grants an extra action (once per turn).',
    art: 'black',
  },

  'castle-siege': {
    id: 'castle-siege',
    name: 'Castle Siege',
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: remove your knights; place pawns on c and f of your third rank if empty.',
    art: 'black',
  },
  'queens-gambit-denied': {
    id: 'queens-gambit-denied',
    name: "Queen's Gambit Denied",
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: remove your queen; add knights on d2/d7 and f2/f7 if empty.',
    art: 'black',
  },
  phalanx: {
    id: 'phalanx',
    name: 'Phalanx',
    kind: 'opening',
    stars: 4,
    summary:
      'After your first move: all your pawns advance one rank if that square is empty.',
    art: 'black',
  },
  'lone-king': {
    id: 'lone-king',
    name: 'Lone King',
    kind: 'opening',
    stars: 5,
    summary:
      'After your first move: keep only your king and four pawns on the home rank.',
    art: 'black',
  },
  scatter: {
    id: 'scatter',
    name: 'Scatter',
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: reshuffle your non-king pieces into random empty squares in your half.',
    art: 'black',
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: swap your king with your queen, or with a rook if you have no queen.',
    art: 'black',
  },
  nursery: {
    id: 'nursery',
    name: 'Nursery',
    kind: 'opening',
    stars: 4,
    summary:
      'After your first move: clear your second rank and fill it with your pawns.',
    art: 'black',
  },
  embassy: {
    id: 'embassy',
    name: 'Embassy',
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: place an envoy pawn in the center. Whoever captures it gains an extra action.',
    art: 'black',
  },
  'ash-start': {
    id: 'ash-start',
    name: 'Ash Start',
    kind: 'opening',
    stars: 5,
    summary: 'After your first move: both sides lose all bishops and knights.',
    art: 'black',
  },
  cuckoo: {
    id: 'cuckoo',
    name: 'Cuckoo',
    kind: 'opening',
    stars: 4,
    summary:
      'After your first move: replace your king with a queen and place the king on a random empty back-rank square.',
    art: 'black',
  },
  'fianchetto-both': {
    id: 'fianchetto-both',
    name: 'Fianchetto Both',
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: clear b2/g2 (or b7/g7) and place your bishops there if empty.',
    art: 'black',
  },
  'knight-out': {
    id: 'knight-out',
    name: 'Knight Out',
    kind: 'opening',
    stars: 2,
    summary:
      'After your first move: place your knights on c3/f3 (or c6/f6) if those squares are empty.',
    art: 'black',
  },
  'king-walk': {
    id: 'king-walk',
    name: 'King Walk',
    kind: 'opening',
    stars: 3,
    summary:
      'After your first move: move king to f1/f8 and a rook to e1/e8 (artificial castle).',
    art: 'black',
  },
}

export function getAugment(id: AugmentId): AugmentCard {
  return AUGMENTS[id]
}

export function hasAugment(
  owned: readonly AugmentId[] | undefined,
  id: AugmentId,
): boolean {
  return !!owned?.includes(id)
}

export function hasRule(
  rules: readonly AugmentId[] | undefined,
  id: AugmentId,
): boolean {
  return !!rules?.includes(id)
}

export function isHighwaySquare(
  square: number,
  rules: readonly AugmentId[] | undefined,
): boolean {
  if (!hasRule(rules, 'highway')) return false
  const file = square % 8
  return file === 1 || file === 6
}

/** Cards players may pick during draft rounds. */
export const DRAFT_CATALOG: AugmentId[] = Object.keys(AUGMENTS) as AugmentId[]

/** Cards each player picks before the game starts. */
export const DRAFT_PICKS_AT_START = 1

/** Total cards each player ends up with (start + mid-game picks). */
export const DRAFT_PICKS_TOTAL = 3

/** Full-move interval between mid-game draft rounds (5 each side = 10 turns). */
export const DRAFT_EVERY_MOVES = 5

/** How many face-up options each draft pick shows. */
export const DRAFT_OFFER_COUNT = 6

export function draftOptionsFor(state: {
  augments: { w: AugmentId[]; b: AugmentId[] }
  rules: AugmentId[]
  fullMove?: number
  picksMade?: { w: number; b: number }
}): AugmentId[] {
  const taken = new Set<AugmentId>([
    ...state.augments.w,
    ...state.augments.b,
    ...state.rules,
  ])
  const remaining = DRAFT_CATALOG.filter((id) => !taken.has(id))
  if (remaining.length <= DRAFT_OFFER_COUNT) return remaining

  // Deterministic offer — stable across host/guest; changes each round.
  const picks = state.picksMade
  const seed =
    [...taken].join('|').length +
    remaining.length * 17 +
    (state.fullMove ?? 1) * 41 +
    ((picks?.w ?? 0) + (picks?.b ?? 0)) * 13
  const shuffled = [...remaining]
  let s = seed + 1
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, DRAFT_OFFER_COUNT)
}
