import { useCallback, useRef, useState } from 'react'
import type { Move, Piece, PieceType } from '../engine/types'
import { pieceGlyph } from '../pieces'

export interface Arrow {
  from: number
  to: number
}

interface BoardProps {
  board: (Piece | null)[]
  turn: 'w' | 'b'
  lastMove: Move | null
  selected: number | null
  legalTargets: Set<number>
  flipped?: boolean
  disabled?: boolean
  highway?: boolean
  onSelect: (square: number) => void
  onMove: (from: number, to: number) => void
  pendingPromotion: { from: number; to: number } | null
  onPromote: (type: PieceType) => void
}

const ARROW_COLOR = 'rgba(42, 140, 98, 0.85)'

function squareCenter(sq: number, flipped: boolean, size: number) {
  const visual = flipped ? 63 - sq : sq
  const row = Math.floor(visual / 8)
  const col = visual % 8
  return {
    x: ((col + 0.5) / 8) * size,
    y: ((row + 0.5) / 8) * size,
  }
}

export function Board({
  board,
  turn,
  lastMove,
  selected,
  legalTargets,
  flipped = false,
  disabled = false,
  highway = false,
  onSelect,
  onMove,
  pendingPromotion,
  onPromote,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [highlights, setHighlights] = useState<Set<number>>(new Set())
  const [arrows, setArrows] = useState<Arrow[]>([])
  const dragFrom = useRef<number | null>(null)
  const [draftArrow, setDraftArrow] = useState<Arrow | null>(null)

  const clearMarks = useCallback(() => {
    setHighlights(new Set())
    setArrows([])
    setDraftArrow(null)
    dragFrom.current = null
  }, [])

  const squareFromEvent = (e: React.MouseEvent | React.PointerEvent) => {
    const el = boardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
    const col = Math.min(7, Math.floor((x / rect.width) * 8))
    const row = Math.min(7, Math.floor((y / rect.height) * 8))
    const visual = row * 8 + col
    return flipped ? 63 - visual : visual
  }

  const handleClick = (sq: number) => {
    if (disabled || pendingPromotion) return
    clearMarks()
    // Only legal destinations complete a move — illegal clicks never “premove”
    if (selected !== null && legalTargets.has(sq)) {
      onMove(selected, sq)
      return
    }
    onSelect(sq)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 2) return
    e.preventDefault()
    const sq = squareFromEvent(e)
    if (sq === null) return
    dragFrom.current = sq
    setDraftArrow({ from: sq, to: sq })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disabled || dragFrom.current === null) return
    const sq = squareFromEvent(e)
    if (sq === null) return
    setDraftArrow({ from: dragFrom.current, to: sq })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disabled || e.button !== 2 || dragFrom.current === null) return
    const sq = squareFromEvent(e)
    const from = dragFrom.current
    dragFrom.current = null
    setDraftArrow(null)
    if (sq === null) return

    if (from === sq) {
      setHighlights((prev) => {
        const next = new Set(prev)
        if (next.has(sq)) next.delete(sq)
        else next.add(sq)
        return next
      })
      return
    }

    setArrows((prev) => {
      const exists = prev.findIndex((a) => a.from === from && a.to === sq)
      if (exists >= 0) return prev.filter((_, i) => i !== exists)
      return [...prev, { from, to: sq }]
    })
  }

  const size = 560
  const allArrows = draftArrow && draftArrow.from !== draftArrow.to
    ? [...arrows, draftArrow]
    : arrows

  const squares = Array.from({ length: 64 }, (_, visual) => {
    const sq = flipped ? 63 - visual : visual
    const row = Math.floor(visual / 8)
    const col = visual % 8
    const light = (row + col) % 2 === 0
    const piece = board[sq]
    const isSelected = selected === sq
    const isLast =
      lastMove && (lastMove.from === sq || lastMove.to === sq)
    const isLegal = legalTargets.has(sq)
    const isHighlight = highlights.has(sq)
    const isCapture = isLegal && !!piece
    const isHighway = highway && (sq % 8 === 1 || sq % 8 === 6)

    return (
      <button
        key={sq}
        type="button"
        className={[
          'square',
          light ? 'light' : 'dark',
          isSelected ? 'selected' : '',
          isLast ? 'last-move' : '',
          isHighlight ? 'marked' : '',
          isHighway ? 'highway' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => handleClick(sq)}
        disabled={disabled}
        aria-label={`Square ${sq}`}
      >
        {isLegal && !piece && <span className="dot" />}
        {isCapture && <span className="capture-ring" />}
        {piece && (
          <span
            className={`piece ${piece.color === 'w' ? 'white' : 'black'}`}
            data-turn={piece.color === turn ? 'active' : 'idle'}
          >
            {pieceGlyph(piece)}
          </span>
        )}
      </button>
    )
  })

  return (
    <div className="board-wrap">
      <div
        ref={boardRef}
        className="board"
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragFrom.current = null
          setDraftArrow(null)
        }}
      >
        {squares}
        <svg className="overlay" viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="3.5"
              markerHeight="3.5"
              refX="3"
              refY="1.75"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L3.5,1.75 L0,3.5 Z" fill={ARROW_COLOR} />
            </marker>
          </defs>
          {allArrows.map((a) => {
            const s = squareCenter(a.from, flipped, size)
            const t = squareCenter(a.to, flipped, size)
            // Shorten so the head sits inside the target square
            const dx = t.x - s.x
            const dy = t.y - s.y
            const len = Math.hypot(dx, dy) || 1
            const cut = Math.min(18, len * 0.22)
            const x2 = t.x - (dx / len) * cut
            const y2 = t.y - (dy / len) * cut
            return (
              <line
                key={`${a.from}-${a.to}`}
                x1={s.x}
                y1={s.y}
                x2={x2}
                y2={y2}
                stroke={ARROW_COLOR}
                strokeWidth={4.5}
                strokeLinecap="round"
                markerEnd="url(#arrowhead)"
                opacity={0.88}
              />
            )
          })}
        </svg>

        {pendingPromotion && (
          <div className="promo-overlay">
            <div className="promo-panel">
              <p>Promote pawn</p>
              <div className="promo-choices">
                {(['q', 'r', 'b', 'n'] as PieceType[]).map((t) => {
                  const color = board[pendingPromotion.from]?.color ?? turn
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onPromote(t)}
                      className="promo-btn"
                    >
                      {pieceGlyph({ type: t, color })}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="board-hint">Right-click square to mark · drag to draw arrows</p>
    </div>
  )
}
