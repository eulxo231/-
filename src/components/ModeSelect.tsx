interface ModeSelectProps {
  onChoose: (mode: 'local' | 'online') => void
}

export function ModeSelect({ onChoose }: ModeSelectProps) {
  return (
    <div className="mode-select-overlay" role="presentation">
      <section
        className="mode-select-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-select-title"
      >
        <h2 id="mode-select-title">How do you want to play?</h2>
        <p>Pick a mode to start. Local begins with the card draft.</p>
        <div className="mode-select-actions">
          <button type="button" onClick={() => onChoose('local')}>
            Local
          </button>
          <button type="button" className="ghost" onClick={() => onChoose('online')}>
            Online
          </button>
        </div>
      </section>
    </div>
  )
}
