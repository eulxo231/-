import { getAugment, type AugmentId } from '../augments/catalog'

const SLOT_COUNT = 3

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
  const interactive = card.kind === 'active' && usable && onClick

  return (
    <article
      className={[
        'augment-card',
        card.kind === 'rule' ? 'rule' : '',
        card.kind === 'active' ? 'active-card' : '',
        selected ? 'selected' : '',
        interactive ? 'clickable' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={card.summary}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
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
    >
      <div className="augment-card-art" aria-hidden="true" />
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
  const slots: (AugmentId | null)[] = Array.from(
    { length: SLOT_COUNT },
    (_, i) => cards[i] ?? null,
  )

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
      {activeCard === 'coronation' && (
        <p className="augment-targeting">Select one of your pieces to crown as queen.</p>
      )}
      <div className="augment-slots">
        {slots.map((id, i) => {
          if (!id) {
            return (
              <div key={`empty-${i}`} className="augment-slot empty" aria-hidden="true">
                <span className="augment-slot-label">Empty</span>
              </div>
            )
          }
          return (
            <CardView
              key={`${id}-${i}`}
              id={id}
              selected={activeCard === id}
              usable={usable}
              onClick={onCardClick ? () => onCardClick(id) : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}
