import { useEffect } from 'react'

interface RulesPanelProps {
  open: boolean
  onClose: () => void
}

const RULES = [
  {
    title: 'Basics',
    items: [
      'Most standard chess rules apply: movement, castling, en passant, and promotion.',
      'There is no checkmate — capturing the opponent’s king wins.',
      'If you have no legal moves (including stalemate), you lose.',
    ],
  },
  {
    title: 'Long games',
    items: [
      'After move 45, overtime begins.',
      'In overtime, 10 plies without a pawn move or capture ends the game.',
      'Threefold repetition and overtime draws are placeholders until card stars exist.',
    ],
  },
  {
    title: 'Coming later',
    items: [
      'Augmentation cards, drafts, RULE cards, and variant pieces are not in yet.',
      'Online rooms use a 4-character code; the server validates every move.',
    ],
  },
]

export function RulesPanel({ open, onClose }: RulesPanelProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="rules-overlay" role="presentation" onClick={onClose}>
      <aside
        id="rules-drawer"
        className="rules-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rules-drawer-head">
          <h2 id="rules-title">Rules</h2>
          <button type="button" className="rules-close" onClick={onClose} aria-label="Close rules">
            ×
          </button>
        </header>
        <div className="rules-drawer-body">
          {RULES.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className="rules-link">
            Full reference:{' '}
            <a href="https://augmentchess.org/rules" target="_blank" rel="noreferrer">
              augmentchess.org/rules
            </a>
          </p>
        </div>
      </aside>
    </div>
  )
}
