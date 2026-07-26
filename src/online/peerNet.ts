import type { RematchFlags, RoomSnapshot, RoomStatus, WireMessage } from '../../shared/protocol'
import {
  createGame,
  getLegalMoves,
  makeMove,
  pickDraftCard,
  useCoronation,
} from '../engine/game'
import type { AugmentId, Color, GameState, PieceType } from '../engine/types'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Public HTTP pub/sub (SSE + POST). No WebSockets, no custom server. */
const HTTP_BASE = 'https://ntfy.sh'
const TOPIC_PREFIX = 'augmentchess_'

type Role = 'host' | 'guest'

export type PeerHandlers = {
  onRoom: (room: RoomSnapshot) => void
  onLeft: () => void
  onError: (message: string) => void
  onOpen?: () => void
  onClose?: () => void
}

type HostRoom = {
  game: GameState
  rematchW: boolean
  rematchB: boolean
}

function makeCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

function makeId(): string {
  return `ac-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function rematchOf(room: HostRoom): RematchFlags {
  return { w: room.rematchW, b: room.rematchB }
}

function statusOf(ready: boolean, game: GameState | null): RoomStatus {
  if (!ready || !game) return 'waiting'
  if (game.result) return 'finished'
  return 'playing'
}

/** Drop history so HTTP payloads stay under ntfy size limits. */
function wireGame(game: GameState): GameState {
  return { ...game, history: [] }
}

function toSnapshot(
  code: string,
  ready: boolean,
  you: Color,
  game: GameState | null,
  rematch: RematchFlags,
): RoomSnapshot {
  return {
    code,
    status: statusOf(ready, game),
    you,
    whitePresent: true,
    blackPresent: ready,
    rematchVotes: Number(rematch.w) + Number(rematch.b),
    game,
  }
}

/**
 * Host-authoritative 1:1 rooms over HTTP (EventSource + POST).
 * Host = White, guest = Black.
 */
export function connectPeer(handlers: PeerHandlers) {
  let source: EventSource | null = null
  let peerId: string | null = null
  let role: Role | null = null
  let code: string | null = null
  let topic: string | null = null
  let room: HostRoom | null = null
  let ready = false
  let busy = false
  let joinTimer: ReturnType<typeof setTimeout> | null = null
  let helloTimer: ReturnType<typeof setInterval> | null = null
  let readyTimer: ReturnType<typeof setInterval> | null = null
  let live = false

  function fail(message: string) {
    busy = false
    handlers.onError(message)
  }

  function clearJoinTimer() {
    if (joinTimer) {
      clearTimeout(joinTimer)
      joinTimer = null
    }
  }

  function clearHelloTimer() {
    if (helloTimer) {
      clearInterval(helloTimer)
      helloTimer = null
    }
  }

  function clearReadyTimer() {
    if (readyTimer) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  }

  async function publish(payload: WireMessage) {
    if (!topic || !live) return
    try {
      await fetch(`${HTTP_BASE}/${topic}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    } catch {
      // transient network errors; next action can retry
    }
  }

  function publishLeaveBeacon() {
    if (!topic || !peerId || !role) return
    const body = JSON.stringify({
      type: 'leave',
      peer: peerId,
      role,
    } satisfies WireMessage)
    try {
      navigator.sendBeacon(`${HTTP_BASE}/${topic}`, body)
    } catch {
      // ignore
    }
  }

  function clearRematch() {
    if (!room) return
    room.rematchW = false
    room.rematchB = false
  }

  function teardown() {
    clearJoinTimer()
    clearHelloTimer()
    clearReadyTimer()
    window.removeEventListener('pagehide', onPageHide)
    busy = false
    live = false
    const old = source
    source = null
    peerId = null
    role = null
    code = null
    topic = null
    room = null
    ready = false
    if (old) {
      try {
        old.close()
      } catch {
        // ignore
      }
    }
  }

  function onPageHide() {
    publishLeaveBeacon()
  }

  function emitHostRoom() {
    if (!room || !code) return
    handlers.onRoom(
      toSnapshot(code, ready, 'w', ready ? room.game : null, rematchOf(room)),
    )
  }

  function broadcastState(type: 'state' | 'rematch') {
    if (!room || !code || !peerId) return
    void publish({
      type,
      peer: peerId,
      code,
      ready,
      game: wireGame(room.game),
      rematch: rematchOf(room),
    })
    emitHostRoom()
  }

  function finishRematchIfReady() {
    if (!room) return
    if (room.rematchW && room.rematchB) {
      room.game = createGame()
      clearRematch()
      broadcastState('state')
      return
    }
    broadcastState('rematch')
  }

  function reject(to: string, message: string) {
    if (!peerId) return
    void publish({ type: 'error', peer: peerId, to, message })
  }

  function applyMove(from: number, to: number, promotion: PieceType | undefined, as: Color) {
    if (!room || !ready) return false
    if (room.game.turn !== as || room.game.result) return false
    if (room.game.phase !== 'playing') return false
    const legal = getLegalMoves(room.game, from).find(
      (m) => m.to === to && (m.promotion ?? undefined) === promotion,
    )
    if (!legal) return false
    const next = makeMove(room.game, legal)
    if (!next) return false
    room.game = next
    clearRematch()
    broadcastState('state')
    return true
  }

  function applyCard(square: number, as: Color) {
    if (!room || !ready) return false
    if (room.game.turn !== as || room.game.result) return false
    if (room.game.phase !== 'playing') return false
    const next = useCoronation(room.game, square)
    if (!next) return false
    room.game = next
    clearRematch()
    broadcastState('state')
    return true
  }

  function applyPick(card: AugmentId, as: Color) {
    if (!room || !ready) return false
    if (room.game.phase !== 'draft') return false
    const next = pickDraftCard(room.game, as, card)
    if (!next) return false
    room.game = next
    broadcastState('state')
    return true
  }

  function onHostMessage(msg: WireMessage) {
    if (!msg || msg.peer === peerId || !room || !peerId || !code) return

    switch (msg.type) {
      case 'hello': {
        if (ready) {
          reject(msg.peer, 'Room is full.')
          return
        }
        ready = true
        clearReadyTimer()
        room.game = createGame()
        clearRematch()
        void publish({
          type: 'welcome',
          peer: peerId,
          to: msg.peer,
          color: 'b',
          code,
          ready: true,
          game: wireGame(room.game),
          rematch: rematchOf(room),
        })
        emitHostRoom()
        break
      }
      case 'move': {
        if (!applyMove(msg.from, msg.to, msg.promotion, 'b')) {
          reject(msg.peer, 'Illegal move.')
        }
        break
      }
      case 'use_card': {
        if (!applyCard(msg.square, 'b')) {
          reject(msg.peer, 'Cannot use that card.')
        }
        break
      }
      case 'pick_card': {
        if (!applyPick(msg.card, 'b')) {
          reject(msg.peer, 'Illegal draft pick.')
        }
        break
      }
      case 'rematch_vote': {
        if (!ready) return
        if (room.game.phase === 'playing' && !room.game.result) return
        room.rematchB = true
        finishRematchIfReady()
        break
      }
      case 'leave':
      case 'peer_gone': {
        if (!ready) return
        ready = false
        room.game = createGame()
        clearRematch()
        // Resume advertising the open seat
        readyTimer = setInterval(() => {
          if (!ready && peerId) {
            void publish({ type: 'host_ready', peer: peerId })
          }
        }, 3000)
        emitHostRoom()
        break
      }
      default:
        break
    }
  }

  function onGuestMessage(msg: WireMessage) {
    if (!msg || msg.peer === peerId) return
    if ('to' in msg && msg.to && msg.to !== peerId) return

    switch (msg.type) {
      case 'host_ready': {
        if (!ready && peerId) {
          void publish({ type: 'hello', peer: peerId })
        }
        break
      }
      case 'welcome': {
        clearJoinTimer()
        clearHelloTimer()
        busy = false
        ready = true
        handlers.onRoom(toSnapshot(msg.code, true, 'b', msg.game, msg.rematch))
        break
      }
      case 'state':
      case 'rematch': {
        handlers.onRoom(
          toSnapshot(msg.code, msg.ready, 'b', msg.game, msg.rematch),
        )
        break
      }
      case 'leave':
      case 'peer_gone': {
        handlers.onClose?.()
        handlers.onLeft()
        teardown()
        break
      }
      case 'error': {
        busy = false
        clearJoinTimer()
        clearHelloTimer()
        fail(msg.message || 'Something went wrong.')
        teardown()
        break
      }
      default:
        break
    }
  }

  function handleEnvelope(raw: string) {
    let envelope: { event?: string; message?: string }
    try {
      envelope = JSON.parse(raw) as { event?: string; message?: string }
    } catch {
      return
    }
    if (envelope.event && envelope.event !== 'message') return
    if (!envelope.message) return

    let msg: WireMessage
    try {
      msg = JSON.parse(envelope.message) as WireMessage
    } catch {
      return
    }

    if (role === 'host') onHostMessage(msg)
    else if (role === 'guest') onGuestMessage(msg)
  }

  function openChannel(onReady: () => void) {
    peerId = makeId()
    source = new EventSource(`${HTTP_BASE}/${topic}/sse`)
    window.addEventListener('pagehide', onPageHide)

    const connectTimer = setTimeout(() => {
      if (!live) {
        fail('Could not reach the room channel. Try again.')
        teardown()
      }
    }, 12_000)

    source.onopen = () => {
      clearTimeout(connectTimer)
      live = true
      handlers.onOpen?.()
      onReady()
    }

    source.onerror = () => {
      if (!live) return
      // EventSource auto-reconnects; only fail if we never connected
    }

    source.onmessage = (event) => {
      handleEnvelope(String(event.data))
    }
  }

  return {
    create() {
      if (busy) return
      teardown()
      busy = true

      code = makeCode()
      topic = TOPIC_PREFIX + code
      room = { game: createGame(), rematchW: false, rematchB: false }
      role = 'host'
      ready = false

      openChannel(() => {
        busy = false
        void publish({ type: 'host_ready', peer: peerId! })
        emitHostRoom()
        readyTimer = setInterval(() => {
          if (!ready && peerId) {
            void publish({ type: 'host_ready', peer: peerId })
          }
        }, 3000)
      })
    },

    join(rawCode: string) {
      if (busy) return
      const normalized = String(rawCode || '')
        .trim()
        .toUpperCase()
      if (!/^[A-Z0-9]{4}$/.test(normalized)) {
        fail('Enter a 4-character room code.')
        return
      }

      teardown()
      busy = true
      code = normalized
      topic = TOPIC_PREFIX + code
      role = 'guest'
      ready = false
      room = null

      openChannel(() => {
        const sendHello = () => {
          if (!ready && peerId) void publish({ type: 'hello', peer: peerId })
        }
        sendHello()
        helloTimer = setInterval(sendHello, 2000)
        joinTimer = setTimeout(() => {
          if (!ready) {
            fail('Room not found. Check the code and try again.')
            teardown()
          }
        }, 10_000)
      })
    },

    move(from: number, to: number, promotion?: PieceType) {
      if (role === 'host') {
        applyMove(from, to, promotion, 'w')
        return
      }
      if (!peerId) return
      void publish({ type: 'move', peer: peerId, from, to, promotion })
    },

    useCard(card: 'coronation', square: number) {
      if (role === 'host') {
        applyCard(square, 'w')
        return
      }
      if (!peerId) return
      void publish({ type: 'use_card', peer: peerId, card, square })
    },

    pickCard(card: AugmentId) {
      if (role === 'host') {
        applyPick(card, 'w')
        return
      }
      if (!peerId) return
      void publish({ type: 'pick_card', peer: peerId, card })
    },

    rematch() {
      if (role === 'host') {
        if (!room || !ready) return
        if (room.game.phase === 'playing' && !room.game.result) return
        room.rematchW = true
        finishRematchIfReady()
        return
      }
      if (!peerId) return
      void publish({ type: 'rematch_vote', peer: peerId })
    },

    leave() {
      if (live && peerId && role) {
        void publish({ type: 'leave', peer: peerId, role })
      }
      handlers.onLeft()
      teardown()
    },

    close() {
      teardown()
    },
  }
}

export type PeerNet = ReturnType<typeof connectPeer>
