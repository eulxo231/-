import type { RefObject } from 'react'
import { getAugmentArt } from '../augments/art'
import {
  DRAFT_PICKS_TOTAL,
  draftOptionsFor,
  getAugment,
  type AugmentId,
} from '../augments/catalog'
import type { Color, GameState } from '../engine/types'
import { useCardHoverTip } from './CardHoverTip'

interface DraftPanelProps {
  game: GameState
  /** Whose picks the local UI can submit (null = spectating). */
  controller: Color | null
  onPick: (card: AugmentId) => void
  onRefresh: () => void
}

function DraftCard({
  id,
  canPick,
  onPick,
}: {
  id: AugmentId
  canPick: boolean
  onPick: (card: AugmentId) => void
}) {
  const card = getAugment(id)
  const art = getAugmentArt(id)
  const { ref, tipHandlers, tipPortal } = useCardHoverTip(
    card.name,
    card.summary,
  )

  return (
    <div className="draft-card-wrap">
      <button
        ref={ref as RefObject<HTMLButtonElement>}
        type="button"
        className={`draft-card${card.kind === 'rule' ? ' rule' : ''}`}
        aria-disabled={!canPick}
        onClick={() => {
          if (!canPick) return
          onPick(id)
        }}
        {...tipHandlers}
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
      {tipPortal}
    </div>
  )
}

export function DraftPanel({
  game,
  controller,
  onPick,
  onRefresh,
}: DraftPanelProps) {
  if (game.phase !== 'draft' || !game.draft) return null

  const picker = game.draft.picker
  const options = draftOptionsFor(game)
  const canPick = controller === picker
  const side = picker === 'w' ? 'White' : 'Black'
  const made = game.picksMade?.[picker] ?? 0
  const opening = !(game.hasMoved?.w || game.hasMoved?.b) && !game.lastMove

  return (
    <div
      className={`draft-overlay draft-side-${picker}`}
      role="presentation"
    >
      <section
        className={`draft-modal draft-side-${picker}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
        aria-label={`${side} card draft`}
      >
        <div className="draft-panel-head">
          <div className="draft-panel-head-text">
            <h2 id="draft-title">{opening ? 'Opening draft' : 'Draft'}</h2>
            <p>
              {side} picks 1 card
              {canPick ? ' — your turn' : ' — waiting'}
              {' · '}
              {made}/{DRAFT_PICKS_TOTAL} cards
            </p>
          </div>
          <div className="draft-refresh-wrap">
            <button
              type="button"
              className={`draft-refresh${game.draft.refreshed ? ' used' : ''}`}
              disabled={!canPick || !!game.draft.refreshed}
              onClick={onRefresh}
              aria-label={
                game.draft.refreshed
                  ? 'Refresh already used'
                  : 'Refresh draft cards once'
              }
              title={
                game.draft.refreshed
                  ? 'Refresh already used for this pick'
                  : 'Reroll these 3 cards (once)'
              }
            >
              {game.draft.refreshed ? 'Refreshed' : 'Refresh · 1'}
            </button>
            <span className="draft-refresh-hint">
              {game.draft.refreshed ? 'Used for this pick' : 'Once per pick'}
            </span>
          </div>
        </div>

        <div className="draft-options">
          {options.map((id) => (
            <DraftCard key={id} id={id} canPick={canPick} onPick={onPick} />
          ))}
        </div>
      </section>
    </div>
  )
}
