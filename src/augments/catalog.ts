export type AugmentId =
  | 'omni-pawn'
  | 'acceleration'
  | 'highway'
  | 'coronation'
  | 'horde'

export type AugmentKind = 'piece' | 'rule' | 'active' | 'opening'

export interface AugmentCard {
  id: AugmentId
  name: string
  kind: AugmentKind
  stars: number
  summary: string
  /** Solid black placeholder art for now */
  art: 'black'
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

/** Cards players may pick during the pre-game draft. */
export const DRAFT_CATALOG: AugmentId[] = [
  'omni-pawn',
  'coronation',
  'acceleration',
  'highway',
  'horde',
]

export const DRAFT_PICKS_PER_PLAYER = 2

export function draftOptionsFor(state: {
  augments: { w: AugmentId[]; b: AugmentId[] }
  rules: AugmentId[]
}): AugmentId[] {
  const taken = new Set<AugmentId>([
    ...state.augments.w,
    ...state.augments.b,
    ...state.rules,
  ])
  return DRAFT_CATALOG.filter((id) => !taken.has(id))
}
