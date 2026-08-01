import { useEffect, useMemo, useState } from 'react'
import { getAugment, type AugmentId } from './augments/catalog'
import { AugmentTray } from './components/AugmentTray'
import { Board } from './components/Board'
import { DraftPanel } from './components/DraftPanel'
import { GameOverModal } from './components/GameOverModal'
import { Lobby } from './components/Lobby'
import { ModeSelect } from './components/ModeSelect'
import { RulesPanel } from './components/RulesPanel'
import {
  createGame,
  getLegalMoves,
  makeMove,
  pickDraftCard,
  poltergeistTargets,
  resultLabel,
  smuggleTargets,
  useActiveCard,
} from './engine/game'
import type { GameState, Move, PieceType } from './engine/types'
import { useOnlineGame } from './online/useOnlineGame'

type PlayMode = 'local' | 'online'

function needsPromotion(state: GameState, from: number, to: number): boolean {
  const piece = state.board[from]
  if (!piece || piece.type !== 'p') return false
  const rank = Math.floor(to / 8)
  return (
    (piece.color === 'w' && rank === 0) || (piece.color === 'b' && rank === 7)
  )
}

export default function App() {
  const [mode, setMode] = useState<PlayMode | null>(null)
  const [localGame, setLocalGame] = useState<GameState | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: number
    to: number
  } | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pendingCard, setPendingCard] = useState<AugmentId | null>(null)
  const [cardPick, setCardPick] = useState<number | null>(null)
  const [promoteCardSq, setPromoteCardSq] = useState<number | null>(null)

  const online = useOnlineGame()

  const game =
    mode === 'online'
      ? (online.room?.game ?? null)
      : mode === 'local'
        ? localGame
        : null

  const myColor = mode === 'online' ? online.room?.you : null
  const inDraft = !!game && game.phase === 'draft'
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
      : mode === 'local' && inDraft
        ? (game?.draft?.picker ?? null)
        : null

  const showDraftModal =
    mode !== null && (mode === 'local' || onlineSession) && inDraft

  const cardTargets = useMemo(() => {
    if (!game || !pendingCard || cardPick == null) return new Set<number>()
    if (pendingCard === 'smuggle') {
      return new Set(smuggleTargets(game, cardPick))
    }
    if (pendingCard === 'poltergeist') {
      return new Set(poltergeistTargets(game, cardPick))
    }
    return new Set<number>()
  }, [game, pendingCard, cardPick])

  const legal = useMemo(() => {
    if (!game || inDraft || selected === null) return [] as Move[]
    if (pendingCard) return []
    if (mode === 'online' && myColor && game.turn !== myColor) return []
    return getLegalMoves(game, selected)
  }, [game, selected, mode, myColor, inDraft, pendingCard])

  const legalTargets = useMemo(() => {
    if (cardTargets.size) return cardTargets
    return new Set(legal.map((m) => m.to))
  }, [legal, cardTargets])

  useEffect(() => {
    setSelected(null)
    setPendingPromotion(null)
    setPendingCard(null)
    setCardPick(null)
    setPromoteCardSq(null)
  }, [game?.turn, mode, online.room?.code, game?.phase, game?.draft?.picker])

  const canInteract =
    !!game &&
    !inDraft &&
    (mode === 'local'
      ? !game.result
      : onlineReady && !!myColor && game.turn === myColor && !game.result)

  const clearCardUi = () => {
    setPendingCard(null)
    setCardPick(null)
    setPromoteCardSq(null)
    setSelected(null)
  }

  const applyCard = (
    card: AugmentId,
    opts: { square?: number; square2?: number; promotion?: PieceType },
  ) => {
    if (!game || !canInteract) return
    if (mode === 'online') {
      online.sendUseCard(card, opts)
      clearCardUi()
      return
    }
    const next = useActiveCard(game, card, opts)
    if (!next) return
    setLocalGame(next)
    clearCardUi()
  }

  const tryMove = (from: number, to: number, promotion?: PieceType) => {
    if (!game || !canInteract) return

    const candidate =
      getLegalMoves(game, from).find(
        (m) => m.to === to && (m.promotion ?? undefined) === promotion,
      ) ?? null
    if (!candidate) {
      setSelected(null)
      setPendingPromotion(null)
      return
    }

    if (needsPromotion(game, from, to) && !promotion) {
      setPendingPromotion({ from, to })
      return
    }

    if (mode === 'online') {
      online.sendMove(from, to, promotion)
      setSelected(null)
      setPendingPromotion(null)
      return
    }

    const next = makeMove(game, candidate)
    if (!next) return
    setLocalGame(next)
    setSelected(null)
    setPendingPromotion(null)
  }

  const onDraftPick = (card: AugmentId) => {
    if (mode === 'online') {
      online.sendPickCard(card)
      return
    }
    if (!game) return
    const picker = game.draft?.picker
    if (!picker) return
    const next = pickDraftCard(game, picker, card)
    if (!next) return
    setLocalGame(next)
  }

  const handleCardTarget = (sq: number) => {
    if (!game || !pendingCard) return
    const target = getAugment(pendingCard).target
    const piece = game.board[sq]
    const me = game.turn

    switch (target) {
      case 'none':
        return

      case 'own-non-king': {
        if (pendingCard === 'smuggle') {
          if (cardPick == null) {
            if (piece && piece.color === me && piece.type !== 'k') {
              setCardPick(sq)
              setSelected(sq)
            }
            return
          }
          if (cardTargets.has(sq)) {
            applyCard(pendingCard, { square: cardPick, square2: sq })
          } else if (piece && piece.color === me && piece.type !== 'k') {
            setCardPick(sq)
            setSelected(sq)
          }
          return
        }
        if (piece && piece.color === me && piece.type !== 'k') {
          applyCard(pendingCard, { square: sq })
        }
        return
      }

      case 'own-piece': {
        if (piece && piece.color === me) {
          applyCard(pendingCard, { square: sq })
        }
        return
      }

      case 'own-pawn': {
        if (piece && piece.color === me && piece.type === 'p') {
          applyCard(pendingCard, { square: sq })
        }
        return
      }

      case 'own-queen': {
        if (piece && piece.color === me && piece.type === 'q') {
          applyCard(pendingCard, { square: sq })
        }
        return
      }

      case 'enemy-non-king': {
        if (pendingCard === 'poltergeist') {
          if (cardPick == null) {
            if (piece && piece.color !== me && piece.type !== 'k') {
              setCardPick(sq)
              setSelected(sq)
            }
            return
          }
          if (cardTargets.has(sq)) {
            applyCard(pendingCard, { square: cardPick, square2: sq })
          } else if (piece && piece.color !== me && piece.type !== 'k') {
            setCardPick(sq)
            setSelected(sq)
          }
          return
        }
        if (piece && piece.color !== me && piece.type !== 'k') {
          applyCard(pendingCard, { square: sq })
        }
        return
      }

      case 'two-own-non-king': {
        if (!piece || piece.color !== me || piece.type === 'k') return
        if (cardPick == null) {
          setCardPick(sq)
          setSelected(sq)
          return
        }
        if (cardPick === sq) return
        applyCard(pendingCard, { square: cardPick, square2: sq })
        return
      }

      case 'duel-pair': {
        if (cardPick == null) {
          if (piece && piece.color === me && piece.type !== 'k') {
            setCardPick(sq)
            setSelected(sq)
          }
          return
        }
        if (
          piece &&
          piece.color !== me &&
          piece.type !== 'k'
        ) {
          applyCard(pendingCard, { square: cardPick, square2: sq })
        } else if (piece && piece.color === me && piece.type !== 'k') {
          setCardPick(sq)
          setSelected(sq)
        }
        return
      }

      case 'promote-pawn': {
        if (piece && piece.color === me && piece.type === 'p') {
          setPromoteCardSq(sq)
          setSelected(sq)
        }
        return
      }

      default:
        return
    }
  }

  const onSelect = (sq: number) => {
    if (!game || !canInteract) return

    if (pendingCard) {
      handleCardTarget(sq)
      return
    }

    const piece = game.board[sq]
    const allowedColor = mode === 'online' ? myColor : game.turn
    if (piece && piece.color === allowedColor && game.turn === piece.color) {
      if (getLegalMoves(game, sq).length === 0) {
        setSelected(null)
        return
      }
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
    if (pendingCard) return
    tryMove(from, to)
  }

  const onPromote = (type: PieceType) => {
    if (promoteCardSq != null && pendingCard === 'promote-now') {
      applyCard('promote-now', { square: promoteCardSq, promotion: type })
      return
    }
    if (!pendingPromotion) return
    tryMove(pendingPromotion.from, pendingPromotion.to, type)
  }

  const resetLocal = () => {
    setLocalGame(createGame())
    clearCardUi()
    setPendingPromotion(null)
  }

  const chooseMode = (next: PlayMode) => {
    if (mode === 'online' && online.room) online.leaveRoom()
    clearCardUi()
    setPendingPromotion(null)
    if (next === 'local') {
      setLocalGame(createGame())
    } else {
      setLocalGame(null)
    }
    setMode(next)
  }

  const backToMenu = () => {
    if (mode === 'online' && online.room) online.leaveRoom()
    clearCardUi()
    setPendingPromotion(null)
    setLocalGame(null)
    setMode(null)
  }

  const onCardClick = (id: AugmentId) => {
    if (!canInteract) return
    const card = getAugment(id)
    if (card.kind !== 'active') return

    if (pendingCard === id) {
      clearCardUi()
      return
    }

    if (card.target === 'none') {
      applyCard(id, {})
      return
    }

    setPendingCard(id)
    setCardPick(null)
    setPromoteCardSq(null)
    setSelected(null)
  }

  const turnLabel = game?.turn === 'w' ? 'White' : 'Black'
  const waitingOnline =
    mode === 'online' && online.room && online.room.status === 'waiting'
  const doubleActions =
    !!game &&
    (game.rules ?? []).includes('acceleration') &&
    game.fullMove >= 3
  const actionsLeft = game?.actionsRemaining ?? (doubleActions ? 2 : 1)
  const actionLabel = doubleActions
    ? ` · action ${actionsLeft === 2 ? 1 : 2}/2`
    : ''

  const showBoard = (mode === 'local' && !!localGame) || !!online.room

  const boardPendingPromotion =
    promoteCardSq != null && pendingCard === 'promote-now'
      ? { from: promoteCardSq, to: promoteCardSq }
      : pendingPromotion

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar-row">
          <div className="brand-cluster">
            <p className="brand">Augment Chess</p>
            {mode && game && !game.result && !inDraft && (mode === 'local' || onlineReady) && (
              <p className="turn-badge" aria-live="polite">
                <span className={`turn-dot ${game.turn}`} />
                {turnLabel} to move
                {actionLabel}
                {mode === 'online' && myColor && game.turn === myColor
                  ? ' — you'
                  : ''}
                {mode === 'online' && myColor && game.turn !== myColor
                  ? ' — opponent'
                  : ''}
              </p>
            )}
            {mode && game?.result && (
              <p className="turn-badge result">Game over</p>
            )}
            {mode && inDraft && (mode === 'local' || onlineSession) && game && (
              <p className="turn-badge" aria-live="polite">
                Draft — {game.draft?.picker === 'w' ? 'White' : 'Black'}
              </p>
            )}
          </div>
          {mode && (
            <button type="button" className="ghost menu-back" onClick={backToMenu}>
              Change mode
            </button>
          )}
        </div>
      </header>

      <main className="stage">
        <div className={`play-layout${showBoard && game ? ' has-board' : ''}`}>
          {showBoard && game ? (
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
              pendingPromotion={boardPendingPromotion}
              onPromote={onPromote}
              highway={(game.rules ?? []).includes('highway')}
              promoteChoices={
                promoteCardSq != null && pendingCard === 'promote-now'
                  ? (['n', 'b', 'r'] as PieceType[])
                  : undefined
              }
            />
          ) : (
            <div className="board-placeholder" aria-hidden="true" />
          )}

          {showBoard && game && (
            <aside className="card-rail">
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
            </aside>
          )}
        </div>

        {mode === 'online' && (
          <Lobby
            mode="online"
            onModeChange={chooseMode}
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
            panelOnly
          />
        )}

        {mode && (
          <footer className="turn-bar">
            <div className="status">
              {mode === 'online' && !online.room && (
                <p>Create or join a room to play online.</p>
              )}
              {waitingOnline && (
                <p>Share your code — game starts when both seats fill.</p>
              )}
            </div>

            {game && (
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
                      {myColor === 'w'
                        ? 'White'
                        : myColor === 'b'
                          ? 'Black'
                          : '—'}
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
            )}

            {mode === 'local' && (
              <div className="actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setFlipped((f) => !f)}
                >
                  Flip board
                </button>
              </div>
            )}
          </footer>
        )}
      </main>

      {mode === null && <ModeSelect onChoose={chooseMode} />}

      {showDraftModal && game && (
        <DraftPanel
          game={game}
          controller={draftController ?? null}
          onPick={onDraftPick}
        />
      )}

      {game?.result && mode && (
        <GameOverModal
          message={resultLabel(game.result)}
          retryLabel={
            mode === 'local'
              ? 'Retry'
              : online.room && online.room.rematchVotes > 0
                ? `Rematch (${online.room.rematchVotes}/2)`
                : 'Retry'
          }
          retryDisabled={
            mode === 'online' &&
            (!online.room ||
              !online.room.whitePresent ||
              !online.room.blackPresent)
          }
          retryHint={
            mode === 'online' && online.room && online.room.rematchVotes === 1
              ? 'Waiting for opponent…'
              : null
          }
          onRetry={mode === 'local' ? resetLocal : online.rematch}
        />
      )}

      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}
