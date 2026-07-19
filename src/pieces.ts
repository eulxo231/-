import type { Piece } from './engine/types'

const GLYPHS: Record<string, string> = {
  wk: '♔',
  wq: '♕',
  wr: '♖',
  wb: '♗',
  wn: '♘',
  wp: '♙',
  bk: '♚',
  bq: '♛',
  br: '♜',
  bb: '♝',
  bn: '♞',
  bp: '♟',
}

export function pieceGlyph(piece: Piece): string {
  return GLYPHS[`${piece.color}${piece.type}`]
}
