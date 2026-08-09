import { getAugmentArt } from '../augments/art'
import {
  DRAFT_PICKS_TOTAL,
  draftOptionsFor,
  getAugment,
  type AugmentId,
} from '../augments/catalog'
import type { Color, GameState } from '../engine/types'

interface DraftPanelProps {
  game: GameState
  /** Whose picks the local UI can submit (null = spectating). */
  controller: Color | null
  onPick: (card: AugmentId) => void
}

export function DraftPanel({ game, controller, onPick }: DraftPanelProps) {
  if (game.phase !== 'draft' || !game.draft) return null

  const picker = game.draft.picker
  const options = draftOptionsFor(game)
  const canPick = controller === picker
  const side = picker === 'w' ? 'White' : 'Black'
  const made = game.picksMade?.[picker] ?? 0
  const opening = !(game.hasMoved?.w || game.hasMoved?.b) && !game.lastMove

  return (
    <div className="draft-overlay" role="presentation">
      <section
        className="draft-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
        aria-label="Card draft"
      >
        <div className="draft-panel-head">
          <h2 id="draft-title">{opening ? 'Opening draft' : 'Draft'}</h2>
          <p>
            {side} picks 1 card
            {canPick ? ' — your turn' : ' — waiting'}
            {' · '}
            {made}/{DRAFT_PICKS_TOTAL} cards
          </p>
        </div>

        <div className="draft-options">
          {options.map((id) => {
            const card = getAugment(id)
            const art = getAugmentArt(id)
            return (
              <button
                key={id}
                type="button"
                className={`draft-card${card.kind === 'rule' ? ' rule' : ''}`}
                disabled={!canPick}
                title={card.summary}
                onClick={() => onPick(id)}
              >
                <div className="augment-card-art" aria-hidden="true">
                  {art ? <img src={art} alt="" draggable={false} /> : null}
                </div>
                <div className="augment-card-body">
                  <header>
                    <h3>{card.name}</h3>
                    <span className="augment-kind">
                      {card.kind === 'rule'
                        ? 'RULE'
                        : card.kind === 'active'
                          ? 'ACTIVE'
                          : card.kind === 'opening'
                            ? 'OPENING'
                            : '★'.repeat(Math.max(1, card.stars))}
                    </span>
                  </header>
                  <p>{card.summary}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
