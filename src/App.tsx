import { useEffect, useMemo, useState } from 'react'
import type { AugmentId } from './augments/catalog'
import { AugmentTray } from './components/AugmentTray'
import { Board } from './components/Board'
import { DraftPanel } from './components/DraftPanel'
import { Lobby } from './components/Lobby'
import { RulesPanel } from './components/RulesPanel'
import {
  createGame,
  getLegalMoves,
  makeMove,
  pickDraftCard,
  resultLabel,
  useCoronation,
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
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pendingCard, setPendingCard] = useState<AugmentId | null>(null)

  const online = useOnlineGame()

  const game = mode === 'online' ? (online.room?.game ?? createGame()) : localGame
  const myColor = mode === 'online' ? online.room?.you : null
  const inDraft = game.phase === 'draft'
  const onlineSession =
    mode === 'online' &&
    !!online.room &&
    online.room.whitePresent &&
    online.room.blackPresent &&
    !!online.room.game
  const onlineReady =
    onlineSession && online.room!.status === 'playing' && !inDraft

  const boardFlipped = mode === 'online' ? myColor === 'b' : flipped

  const draftController: 'w' | 'b' | null =
    mode === 'online'
      ? (myColor ?? null)
      : inDraft
        ? (game.draft?.picker ?? null)
        : null

  const showDraftModal =
    (mode === 'local' || onlineSession) && inDraft

  const legal = useMemo(() => {
    if (inDraft || selected === null) return [] as Move[]
    if (mode === 'online' && myColor && game.turn !== myColor) return []
    return getLegalMoves(game, selected)
  }, [game, selected, mode, myColor, inDraft])

  const legalTargets = useMemo(
    () => new Set(legal.map((m) => m.to)),
    [legal],
  )

  useEffect(() => {
    setSelected(null)
    setPendingPromotion(null)
    setPendingCard(null)
  }, [game.turn, mode, online.room?.code, game.phase, game.draft?.picker])

  const canInteract =
    !inDraft &&
    (mode === 'local'
      ? !game.result
      : onlineReady && !!myColor && game.turn === myColor && !game.result)

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

  const tryCoronation = (square: number) => {
    if (!canInteract) return
    if (mode === 'online') {
      online.sendUseCard('coronation', square)
      setPendingCard(null)
      setSelected(null)
      return
    }
    const next = useCoronation(game, square)
    if (!next) return
    setLocalGame(next)
    setPendingCard(null)
    setSelected(null)
  }

  const onDraftPick = (card: AugmentId) => {
    if (mode === 'online') {
      online.sendPickCard(card)
      return
    }
    const picker = game.draft?.picker
    if (!picker) return
    const next = pickDraftCard(game, picker, card)
    if (!next) return
    setLocalGame(next)
  }

  const onSelect = (sq: number) => {
    if (!canInteract) return

    if (pendingCard === 'coronation') {
      tryCoronation(sq)
      return
    }

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
    setPendingCard(null)
  }

  const handleModeChange = (next: 'local' | 'online') => {
    if (next === mode) return
    if (mode === 'online' && online.room) online.leaveRoom()
    setSelected(null)
    setPendingPromotion(null)
    setPendingCard(null)
    setMode(next)
  }

  const onCardClick = (id: AugmentId) => {
    if (!canInteract) return
    if (id !== 'coronation') return
    setPendingCard((cur) => (cur === id ? null : id))
    setSelected(null)
  }

  const turnLabel = game.turn === 'w' ? 'White' : 'Black'
  const waitingOnline =
    mode === 'online' && online.room && online.room.status === 'waiting'
  const doubleActions =
    (game.rules ?? []).includes('acceleration') && game.fullMove >= 3
  const actionsLeft = game.actionsRemaining ?? (doubleActions ? 2 : 1)
  const actionLabel = doubleActions
    ? ` · action ${actionsLeft === 2 ? 1 : 2}/2`
    : ''

  const showBoard = mode === 'local' || !!online.room

  const lobbyProps = {
    mode,
    onModeChange: handleModeChange,
    connection: online.connection,
    room: online.room,
    error: online.error,
    onCreate: online.createRoom,
    onJoin: online.joinRoom,
    onLeave: () => {
      online.leaveRoom()
      setSelected(null)
      setPendingPromotion(null)
    },
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-row">
          <p className="brand">Augment Chess</p>
          <Lobby {...lobbyProps} modeOnly />
        </div>
      </header>

      <main className="stage">
        {showBoard ? (
          <Board
            board={game.board}
            turn={game.turn}
            lastMove={game.lastMove}
            selected={selected}
            legalTargets={legalTargets}
            flipped={boardFlipped}
            disabled={
              inDraft ||
              (mode === 'online'
                ? !onlineReady || !!game.result || game.turn !== myColor
                : !!game.result)
            }
            onSelect={onSelect}
            onMove={onMove}
            pendingPromotion={pendingPromotion}
            onPromote={onPromote}
            highway={(game.rules ?? []).includes('highway')}
          />
        ) : (
          <div className="board-placeholder" aria-hidden="true" />
        )}

        {showBoard && (
          <div className="below-board">
            <div className="below-board-tools">
              <button
                type="button"
                className={`rules-inline${rulesOpen ? ' active' : ''}`}
                aria-expanded={rulesOpen}
                aria-controls="rules-drawer"
                onClick={() => setRulesOpen(true)}
              >
                Rules
              </button>
            </div>
            <AugmentTray
              cards={
                mode === 'online' && myColor
                  ? (game.augments?.[myColor] ?? [])
                  : inDraft
                    ? (game.augments?.[game.draft?.picker ?? 'w'] ?? [])
                    : (game.augments?.[game.turn] ?? [])
              }
              rules={game.rules ?? []}
              activeCard={pendingCard}
              usable={canInteract}
              onCardClick={onCardClick}
              label={
                inDraft
                  ? 'Drafting…'
                  : mode === 'online'
                    ? myColor === 'w'
                      ? 'Your augments · White'
                      : myColor === 'b'
                        ? 'Your augments · Black'
                        : 'Augments'
                    : `${game.turn === 'w' ? 'White' : 'Black'} · to move`
              }
            />
          </div>
        )}

        {mode === 'online' && <Lobby {...lobbyProps} panelOnly />}

        <footer className="turn-bar">
          <div className="status">
            {mode === 'online' && !online.room && (
              <p>Create or join a room to play online.</p>
            )}
            {waitingOnline && (
              <p>Share your code — game starts when both seats fill.</p>
            )}
            {inDraft && (mode === 'local' || onlineSession) && (
              <p>
                Card draft —{' '}
                {game.draft?.picker === 'w' ? 'White' : 'Black'} to pick
              </p>
            )}
            {(mode === 'local' ||
              onlineReady ||
              online.room?.status === 'finished') &&
              game.result && (
                <p className="result">{resultLabel(game.result)}</p>
              )}
            {(mode === 'local' || onlineReady) && !game.result && !inDraft && (
              <p>
                <span className={`turn-dot ${game.turn}`} />
                {turnLabel} to move
                {actionLabel}
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
                <dd>
                  {myColor === 'w' ? 'White' : myColor === 'b' ? 'Black' : '—'}
                </dd>
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
        </footer>
      </main>

      {showDraftModal && (
        <DraftPanel
          game={game}
          controller={draftController ?? null}
          onPick={onDraftPick}
        />
      )}

      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
