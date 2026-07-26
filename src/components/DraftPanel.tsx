import {
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

  return (
    <section className="draft-panel" aria-label="Card draft">
      <div className="draft-panel-head">
        <h2>Draft</h2>
        <p>
          {picker === 'w' ? 'White' : 'Black'} picks
          {canPick ? ' — your turn' : ' — waiting'}
          {' · '}
          White {game.draft.picksLeft.w} left · Black {game.draft.picksLeft.b} left
        </p>
      </div>

      <div className="draft-sides">
        <div>
          <h3>White</h3>
          <ul>
            {game.augments.w.length === 0 && <li className="muted">No cards yet</li>}
            {game.augments.w.map((id) => (
              <li key={`w-${id}`}>{getAugment(id).name}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Black</h3>
          <ul>
            {game.augments.b.length === 0 && <li className="muted">No cards yet</li>}
            {game.augments.b.map((id) => (
              <li key={`b-${id}`}>{getAugment(id).name}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>RULE</h3>
          <ul>
            {game.rules.length === 0 && <li className="muted">None</li>}
            {game.rules.map((id) => (
              <li key={`r-${id}`}>{getAugment(id).name}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="draft-options">
        {options.map((id) => {
          const card = getAugment(id)
          return (
            <button
              key={id}
              type="button"
              className={`draft-card${card.kind === 'rule' ? ' rule' : ''}`}
              disabled={!canPick}
              onClick={() => onPick(id)}
            >
              <div className="augment-card-art" aria-hidden="true" />
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
  )
}
