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
/** Public HTTP pub/sub (SSE + POST). Keep traffic low — ntfy rate-limits bursts. */
const HTTP_BASE = 'https://ntfy.sh'
const TOPIC_PREFIX = 'augmentchess_'
const HELLO_RETRY_MS = 12_000
const JOIN_TIMEOUT_MS = 36_000
const RATE_LIMIT_MSG =
  'Online channel is busy (rate limited). Wait about a minute, then try again.'

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
  let guestPeer: string | null = null
  let busy = false
  let joinTimer: ReturnType<typeof setTimeout> | null = null
  let helloTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let live = false
  let closed = false
  let publishBlockedUntil = 0
  let lastWelcomeAt = 0
  let greeted = false

  function markGuestJoined() {
    clearJoinTimer()
    clearHelloTimer()
    busy = false
    ready = true
    greeted = true
  }

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

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  async function publish(payload: WireMessage): Promise<boolean> {
    if (!topic || !live || closed) return false
    if (Date.now() < publishBlockedUntil) return false
    try {
      const res = await fetch(`${HTTP_BASE}/${topic}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.status === 429) {
        publishBlockedUntil = Date.now() + 60_000
        fail(RATE_LIMIT_MSG)
        return false
      }
      return res.ok
    } catch {
      return false
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
    closed = true
    clearJoinTimer()
    clearHelloTimer()
    clearReconnectTimer()
    window.removeEventListener('pagehide', onPageHide)
    busy = false
    live = false
    greeted = false
    const old = source
    source = null
    peerId = null
    role = null
    code = null
    topic = null
    room = null
    ready = false
    guestPeer = null
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

  function sendWelcome(to: string) {
    if (!room || !peerId || !code) return
    const now = Date.now()
    if (now - lastWelcomeAt < 8_000) return
    lastWelcomeAt = now
    void publish({
      type: 'welcome',
      peer: peerId,
      to,
      color: 'b',
      code,
      ready: true,
      game: wireGame(room.game),
      rematch: rematchOf(room),
    })
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
        if (ready && guestPeer === msg.peer) {
          sendWelcome(msg.peer)
          return
        }
        if (ready) {
          reject(msg.peer, 'Room is full.')
          return
        }
        ready = true
        guestPeer = msg.peer
        room.game = createGame()
        clearRematch()
        sendWelcome(msg.peer)
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
        guestPeer = null
        room.game = createGame()
        clearRematch()
        // Single ping so a late joiner can find the open seat — no spam loop
        if (peerId) void publish({ type: 'host_ready', peer: peerId })
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
        if (!ready && !greeted && peerId) {
          greeted = true
          void publish({ type: 'hello', peer: peerId })
        }
        break
      }
      case 'welcome': {
        markGuestJoined()
        handlers.onRoom(toSnapshot(msg.code, true, 'b', msg.game, msg.rematch))
        break
      }
      case 'state':
      case 'rematch': {
        if (msg.ready) markGuestJoined()
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
        if (ready) return
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

  function attachSource(onReady: () => void) {
    if (!topic || closed) return

    const es = new EventSource(`${HTTP_BASE}/${topic}/sse`)
    source = es

    const connectTimer = setTimeout(() => {
      if (!live && !closed) {
        fail(RATE_LIMIT_MSG)
        teardown()
      }
    }, 15_000)

    es.onopen = () => {
      clearTimeout(connectTimer)
      live = true
      handlers.onOpen?.()
      onReady()
    }

    es.onerror = () => {
      // Stop the browser's aggressive reconnect loop (it triggers 429s).
      try {
        es.close()
      } catch {
        // ignore
      }
      if (source === es) source = null

      if (closed) return

      if (!live) {
        clearTimeout(connectTimer)
        fail(RATE_LIMIT_MSG)
        teardown()
        return
      }

      // Dropped mid-session: wait, then reconnect once slowly
      live = false
      clearReconnectTimer()
      reconnectTimer = setTimeout(() => {
        if (closed || !topic) return
        attachSource(() => {
          if (role === 'host' && !ready && peerId) {
            void publish({ type: 'host_ready', peer: peerId })
          }
          if (role === 'guest' && !ready && peerId) {
            void publish({ type: 'hello', peer: peerId })
          }
        })
      }, 20_000)
    }

    es.onmessage = (event) => {
      handleEnvelope(String(event.data))
    }
  }

  function openChannel(onReady: () => void) {
    peerId = makeId()
    closed = false
    window.addEventListener('pagehide', onPageHide)
    attachSource(onReady)
  }

  return {
    create() {
      if (busy) return
      teardown()
      busy = true
      closed = false

      code = makeCode()
      topic = TOPIC_PREFIX + code
      room = { game: createGame(), rematchW: false, rematchB: false }
      role = 'host'
      ready = false

      openChannel(() => {
        busy = false
        // One announce only — guests send hello; host answers with welcome
        void publish({ type: 'host_ready', peer: peerId! })
        emitHostRoom()
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
      closed = false
      greeted = false
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
        // Slow retries only — ntfy allows ~1 request / 5s after a burst
        helloTimer = setInterval(sendHello, HELLO_RETRY_MS)
        joinTimer = setTimeout(() => {
          if (!ready) {
            fail('Room not found. Check the code and try again.')
            teardown()
          }
        }, JOIN_TIMEOUT_MS)
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
