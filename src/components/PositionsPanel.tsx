import type { Move } from '../engine/types'
import { squareToCoord } from '../engine/types'

export interface LoggedMove {
  move: Move
  notation: string
}

interface PositionsPanelProps {
  moves: LoggedMove[]
}

export function formatMoveNotation(move: Move): string {
  const base = `${squareToCoord(move.from)}${squareToCoord(move.to)}`
  if (move.promotion) return `${base}=${move.promotion.toUpperCase()}`
  if (move.castle === 'K') return 'O-O'
  if (move.castle === 'Q') return 'O-O-O'
  return base
}

export function PositionsPanel({ moves }: PositionsPanelProps) {
  const rows: { num: number; white?: string; black?: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i]?.notation,
      black: moves[i + 1]?.notation,
    })
  }

  return (
    <section className="positions-panel" aria-label="Positions">
      <div className="side-tabs" role="tablist" aria-label="Game side tabs">
        <button type="button" role="tab" aria-selected className="active">
          Positions
        </button>
      </div>
      <div className="positions-body" role="tabpanel">
        {rows.length === 0 ? (
          <p className="positions-empty">No moves yet.</p>
        ) : (
          <ol className="positions-list">
            {rows.map((row) => (
              <li key={row.num}>
                <span className="positions-num">{row.num}.</span>
                <span className="positions-ply">{row.white ?? ''}</span>
                <span className="positions-ply">{row.black ?? ''}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
