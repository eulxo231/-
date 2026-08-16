import type { AugmentId } from './catalog'

import acceleration from '../assets/acceleration.svg'
import anchorRook from '../assets/anchor-rook.svg'
import bargain from '../assets/bargain.svg'
import bloodMoon from '../assets/blood-moon.svg'
import bomb from '../assets/bomb.svg'
import castleNow from '../assets/castle-now.svg'
import coronation from '../assets/coronation.svg'
import crookedKnight from '../assets/crooked-knight.svg'
import crownSplit from '../assets/crown-split.svg'
import duel from '../assets/duel.svg'
import echoLane from '../assets/echo-lane.svg'
import eclipse from '../assets/eclipse.svg'
import fog from '../assets/fog.svg'
import ghostPawn from '../assets/ghost-pawn.svg'
import glassQueen from '../assets/glass-queen.svg'
import glacier from '../assets/glacier.svg'
import highway from '../assets/highway.svg'
import hoppingBishop from '../assets/hopping-bishop.svg'
import ironRook from '../assets/iron-rook.svg'
import knightmare from '../assets/knightmare.svg'
import longcastle from '../assets/longcastle.svg'
import longStride from '../assets/long-stride.svg'
import militia from '../assets/militia.svg'
import mirror from '../assets/mirror.svg'
import narrowBoard from '../assets/narrow-board.svg'
import omniPawn from '../assets/omni-pawn.svg'
import pawnStorm from '../assets/pawn-storm.svg'
import poltergeist from '../assets/poltergeist.svg'
import promoteNow from '../assets/promote-now.svg'
import recall from '../assets/recall.svg'
import recklessCharge from '../assets/reckless-charge.svg'
import recruit from '../assets/recruit.svg'
import rewind from '../assets/rewind.svg'
import seedBishop from '../assets/seed-bishop.svg'
import sharedPool from '../assets/shared-pool.svg'
import slipperyBishop from '../assets/slippery-bishop.svg'
import smuggle from '../assets/smuggle.svg'
import suddenDeath from '../assets/sudden-death.svg'
import suicideBomber from '../assets/suicide-bomber.svg'
import swap from '../assets/swap.svg'
import teleport from '../assets/teleport.svg'
import timeSkip from '../assets/time-skip.svg'
import twinKnights from '../assets/twin-knights.svg'
import upheaval from '../assets/upheaval.svg'

const ART: Partial<Record<AugmentId, string>> = {
  'omni-pawn': omniPawn,
  acceleration,
  'blood-moon': bloodMoon,
  fog,
  highway,
  mirror,
  'narrow-board': narrowBoard,
  'shared-pool': sharedPool,
  'sudden-death': suddenDeath,
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
  'reckless-charge': recklessCharge,
  coronation,
  swap,
  recall,
  bomb,
  'promote-now': promoteNow,
  'time-skip': timeSkip,
  eclipse,
  glacier,
  rewind,
  smuggle,
  duel,
  'crown-split': crownSplit,
  poltergeist,
  bargain,
  recruit,
  teleport,
  'castle-now': castleNow,
  'suicide-bomber': suicideBomber,
  upheaval,
  'long-stride': longStride,
}

export function getAugmentArt(id: AugmentId): string | undefined {
  return ART[id]
}
