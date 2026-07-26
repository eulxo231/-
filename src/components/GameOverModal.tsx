interface GameOverModalProps {
  message: string
  retryLabel: string
  retryDisabled?: boolean
  retryHint?: string | null
  onRetry: () => void
}

export function GameOverModal({
  message,
  retryLabel,
  retryDisabled = false,
  retryHint = null,
  onRetry,
}: GameOverModalProps) {
  return (
    <div className="game-over-overlay" role="presentation">
      <section
        className="game-over-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
      >
        <h2 id="game-over-title">Game ended</h2>
        <p className="game-over-result">{message}</p>
        {retryHint && <p className="game-over-hint">{retryHint}</p>}
        <div className="game-over-actions">
          <button type="button" onClick={onRetry} disabled={retryDisabled}>
            {retryLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
