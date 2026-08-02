import type { AugmentId } from './catalog'

import anchorRook from '../assets/anchor-rook.svg'
import coronation from '../assets/coronation.svg'
import crookedKnight from '../assets/crooked-knight.svg'
import echoLane from '../assets/echo-lane.svg'
import ghostPawn from '../assets/ghost-pawn.svg'
import glassQueen from '../assets/glass-queen.svg'
import hoppingBishop from '../assets/hopping-bishop.svg'
import ironRook from '../assets/iron-rook.svg'
import knightmare from '../assets/knightmare.svg'
import longcastle from '../assets/longcastle.svg'
import militia from '../assets/militia.svg'
import omniPawn from '../assets/omni-pawn.svg'
import pawnStorm from '../assets/pawn-storm.svg'
import seedBishop from '../assets/seed-bishop.svg'
import slipperyBishop from '../assets/slippery-bishop.svg'
import swap from '../assets/swap.svg'
import twinKnights from '../assets/twin-knights.svg'

const ART: Partial<Record<AugmentId, string>> = {
  'omni-pawn': omniPawn,
  knightmare,
  longcastle,
  'slippery-bishop': slipperyBishop,
  'iron-rook': ironRook,
  'pawn-storm': pawnStorm,
  'ghost-pawn': ghostPawn,
  'crooked-knight': crookedKnight,
  'glass-queen': glassQueen,
  'anchor-rook': anchorRook,
  'seed-bishop': seedBishop,
  'echo-lane': echoLane,
  'hopping-bishop': hoppingBishop,
  'twin-knights': twinKnights,
  militia,
  coronation,
  swap,
}

export function getAugmentArt(id: AugmentId): string | undefined {
  return ART[id]
}
