import type { RefObject } from 'react'
import { getAugmentArt } from '../augments/art'
import { getAugment, type AugmentId } from '../augments/catalog'
import { useCardHoverTip } from './CardHoverTip'

const TARGET_HINTS: Partial<Record<AugmentId, string>> = {
  coronation: 'Select one of your pieces to crown as queen.',
  swap: 'Select two of your non-king pieces to swap.',
  recall: 'Select one of your pieces to recall home.',
  bomb: 'Select an enemy non-king piece to remove.',
  'promote-now': 'Select one of your pawns, then choose knight, bishop, or rook.',
  eclipse: 'Select an enemy non-king piece to freeze.',
  smuggle: 'Select your piece, then an empty square on your back two ranks.',
  duel: 'Select your piece, then an adjacent enemy piece (not kings).',
  'crown-split': 'Select your queen to split into two knights.',
  poltergeist: 'Select an enemy piece, then a quiet square it can step to.',
  bargain: 'Select one of your pawns to sacrifice for an extra action.',
  recruit: 'Select an empty square on your second rank to place a pawn.',
  teleport: 'Select an empty square on your back rank to teleport your king.',
  'castle-now': 'Select one of your rooks to castle with instantly.',
}

interface AugmentTrayProps {
  cards: AugmentId[]
  rules?: AugmentId[]
  label?: string
  activeCard?: AugmentId | null
  usable?: boolean
  onCardClick?: (id: AugmentId) => void
}

function CardView({
  id,
  selected,
  usable,
  onClick,
}: {
  id: AugmentId
  selected?: boolean
  usable?: boolean
  onClick?: () => void
}) {
  const card = getAugment(id)
  const art = getAugmentArt(id)
  const interactive = card.kind === 'active' && usable && onClick
  const { ref, tipHandlers, tipPortal } = useCardHoverTip(
    card.name,
    card.summary,
  )

  return (
    <>
      <article
        ref={ref as RefObject<HTMLElement>}
        className={[
          'augment-card',
          card.kind === 'rule' ? 'rule' : '',
          card.kind === 'active' ? 'active-card' : '',
          selected ? 'selected' : '',
          interactive ? 'clickable' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role={interactive ? 'button' : undefined}
        tabIndex={0}
        onClick={interactive ? onClick : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick()
                }
              }
            : undefined
        }
        {...tipHandlers}
      >
        <div className="augment-card-art" aria-hidden="true">
          {art ? <img src={art} alt="" draggable={false} /> : null}
        </div>
        <div className="augment-card-body">
          <header>
            <h3>{card.name}</h3>
            {card.kind === 'rule' ? (
              <span className="augment-kind">RULE</span>
            ) : card.kind === 'active' ? (
              <span className="augment-kind">ACTIVE</span>
            ) : card.kind === 'opening' ? (
              <span className="augment-kind">OPENING</span>
            ) : (
              <span className="augment-stars">{'★'.repeat(card.stars)}</span>
            )}
          </header>
          <p>{card.summary}</p>
        </div>
      </article>
      {tipPortal}
    </>
  )
}

export function AugmentTray({
  cards,
  rules = [],
  label = 'Your augments',
  activeCard = null,
  usable = false,
  onCardClick,
}: AugmentTrayProps) {
  const hint = activeCard ? TARGET_HINTS[activeCard] : null

  return (
    <section className="augment-tray" aria-label="Augmentation cards">
      {rules.length > 0 && (
        <div className="rule-strip">
          <div className="augment-tray-head">
            <h2>RULE</h2>
            <span>Active</span>
          </div>
          <div className="augment-slots rule-slots">
            {rules.map((id) => (
              <CardView key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      <div className="augment-tray-head">
        <h2>Augments</h2>
        <span>{label}</span>
      </div>
      {hint && <p className="augment-targeting">{hint}</p>}
      <div className="augment-slots">
        {cards.length === 0 ? (
          <div className="augment-slot empty" aria-hidden="true">
            <span className="augment-slot-label">Empty</span>
          </div>
        ) : (
          cards.map((id, i) => (
            <CardView
              key={`${id}-${i}`}
              id={id}
              selected={activeCard === id}
              usable={usable}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
            />
          ))
        )}
      </div>
    </section>
  )
}
