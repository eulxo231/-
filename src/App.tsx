import { useEffect, useMemo, useState } from 'react'
import { Board } from './components/Board'
import { Lobby } from './components/Lobby'
import {
  createGame,
  getLegalMoves,
  makeMove,
  resultLabel,
} from './engine/game'
import type { GameState, Move, PieceType } from './engine/types'
import { useOnlineGame } from './online/useOnlineGame'

function needsPromotion(state: GameState, from: number, to: number): boolean {
  const piece = state.board[from]
  if (!piece || piece.type !== 'p') return false
  const rank = Math.floor(to / 8)
  return (
    (piece.color === 'w' && rank === 0) || (piece.color === 'b' && rank === 7)
  )
}

export default function App() {
  const [mode, setMode] = useState<'local' | 'online'>('local')
  const [localGame, setLocalGame] = useState<GameState>(() => createGame())
  const [selected, setSelected] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: number
    to: number
  } | null>(null)

  const online = useOnlineGame()

  const game = mode === 'online' ? online.room?.game ?? createGame() : localGame
  const myColor = mode === 'online' ? online.room?.you : null
  const onlineReady =
    mode === 'online' &&
    !!online.room &&
    online.room.whitePresent &&
    online.room.blackPresent &&
    online.room.status === 'playing' &&
    !!online.room.game

  const boardFlipped = mode === 'online' ? myColor === 'b' : flipped

  const legal = useMemo(() => {
    if (selected === null) return [] as Move[]
    if (mode === 'online' && myColor && game.turn !== myColor) return []
    return getLegalMoves(game, selected)
  }, [game, selected, mode, myColor])

  const legalTargets = useMemo(
    () => new Set(legal.map((m) => m.to)),
    [legal],
  )

  useEffect(() => {
    setSelected(null)
    setPendingPromotion(null)
  }, [game.turn, mode, online.room?.code])

  const canInteract =
    mode === 'local'
      ? !game.result
      : onlineReady && !!myColor && game.turn === myColor && !game.result

  const tryMove = (from: number, to: number, promotion?: PieceType) => {
    if (mode === 'online') {
      if (!canInteract) return
      if (needsPromotion(game, from, to) && !promotion) {
        setPendingPromotion({ from, to })
        return
      }
      online.sendMove(from, to, promotion)
      setSelected(null)
      setPendingPromotion(null)
      return
    }

    if (needsPromotion(game, from, to) && !promotion) {
      setPendingPromotion({ from, to })
      return
    }
    const candidate =
      getLegalMoves(game, from).find(
        (m) => m.to === to && (m.promotion ?? undefined) === promotion,
      ) ?? null
    if (!candidate) return
    const next = makeMove(game, candidate)
    if (!next) return
    setLocalGame(next)
    setSelected(null)
    setPendingPromotion(null)
  }

  const onSelect = (sq: number) => {
    if (!canInteract && !(mode === 'local' && !game.result)) return
    if (mode === 'online' && !canInteract) return

    const piece = game.board[sq]
    const allowedColor = mode === 'online' ? myColor : game.turn
    if (piece && piece.color === allowedColor && game.turn === piece.color) {
      setSelected(sq)
      return
    }
    if (selected !== null && legalTargets.has(sq)) {
      tryMove(selected, sq)
      return
    }
    setSelected(null)
  }

  const onMove = (from: number, to: number) => {
    tryMove(from, to)
  }

  const onPromote = (type: PieceType) => {
    if (!pendingPromotion) return
    tryMove(pendingPromotion.from, pendingPromotion.to, type)
  }

  const resetLocal = () => {
    setLocalGame(createGame())
    setSelected(null)
    setPendingPromotion(null)
  }

  const handleModeChange = (next: 'local' | 'online') => {
    if (next === mode) return
    if (mode === 'online' && online.room) online.leaveRoom()
    setSelected(null)
    setPendingPromotion(null)
    setMode(next)
  }

  const turnLabel = game.turn === 'w' ? 'White' : 'Black'
  const waitingOnline =
    mode === 'online' && online.room && online.room.status === 'waiting'

  return (
    <div className="app">
      <header className="hero">
        <p className="brand">Augment Chess</p>
        <h1>King capture. No checkmate.</h1>
        <p className="lede">
          Core rules from{' '}
          <a href="https://augmentchess.org/rules" target="_blank" rel="noreferrer">
            augmentchess.org
          </a>
          . Augmentation cards come later.
        </p>
      </header>

      <Lobby
        mode={mode}
        onModeChange={handleModeChange}
        connection={online.connection}
        room={online.room}
        error={online.error}
        onCreate={online.createRoom}
        onJoin={online.joinRoom}
        onLeave={() => {
          online.leaveRoom()
          setSelected(null)
          setPendingPromotion(null)
        }}
      />

      <main className="stage">
        <Board
          board={game.board}
          turn={game.turn}
          lastMove={game.lastMove}
          selected={selected}
          legalTargets={legalTargets}
          flipped={boardFlipped}
          disabled={
            mode === 'online'
              ? !onlineReady || !!game.result || game.turn !== myColor
              : !!game.result
          }
          onSelect={onSelect}
          onMove={onMove}
          pendingPromotion={pendingPromotion}
          onPromote={onPromote}
        />

        <aside className="panel">
          <div className="status">
            {mode === 'online' && !online.room && (
              <p>Create or join a room to play online.</p>
            )}
            {waitingOnline && (
              <p>Share your code — game starts when both seats fill.</p>
            )}
            {(mode === 'local' || onlineReady || online.room?.status === 'finished') &&
              game.result && <p className="result">{resultLabel(game.result)}</p>}
            {(mode === 'local' || onlineReady) && !game.result && (
              <p>
                <span className={`turn-dot ${game.turn}`} />
                {turnLabel} to move
                {mode === 'online' && myColor && game.turn === myColor
                  ? ' — your turn'
                  : ''}
                {mode === 'online' && myColor && game.turn !== myColor
                  ? ' — opponent'
                  : ''}
              </p>
            )}
          </div>

          <dl className="meta">
            <div>
              <dt>Move</dt>
              <dd>{game.fullMove}</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>{game.inOvertime ? 'Overtime' : 'Main'}</dd>
            </div>
            {mode === 'online' ? (
              <div>
                <dt>You</dt>
                <dd>{myColor === 'w' ? 'White' : myColor === 'b' ? 'Black' : '—'}</dd>
              </div>
            ) : (
              game.inOvertime && (
                <div>
                  <dt>Idle</dt>
                  <dd>{game.overtimeIdle}/10</dd>
                </div>
              )
            )}
          </dl>

          <ul className="rules">
            <li>Capture the king to win</li>
            <li>No moves (incl. stalemate) = loss</li>
            <li>Online rooms use a 4-character code</li>
            <li>Server validates every move</li>
          </ul>

          <div className="actions">
            {mode === 'local' ? (
              <button type="button" onClick={resetLocal}>
                New game
              </button>
            ) : (
              <button
                type="button"
                onClick={online.rematch}
                disabled={
                  !online.room ||
                  !online.room.whitePresent ||
                  !online.room.blackPresent ||
                  (online.room.status === 'playing' && !game.result)
                }
              >
                {online.room && online.room.rematchVotes > 0
                  ? `Rematch (${online.room.rematchVotes}/2)`
                  : 'Rematch'}
              </button>
            )}
            {mode === 'local' && (
              <button
                type="button"
                className="ghost"
                onClick={() => setFlipped((f) => !f)}
              >
                Flip board
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
