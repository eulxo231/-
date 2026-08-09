import mqtt, { type MqttClient } from 'mqtt'
import type { RematchFlags, RoomSnapshot, RoomStatus, WireMessage } from '../../shared/protocol'
import {
  createGame,
  getLegalMoves,
  makeMove,
  pickDraftCard,
  useActiveCard,
  type UseCardOpts,
} from '../engine/game'
import type { AugmentId, Color, GameState, PieceType } from '../engine/types'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Same public broker pattern as omok_s — reliable on GitHub Pages. */
const BROKER = 'wss://broker.emqx.io:8084/mqtt'
const TOPIC_PREFIX = 'augment_chess/v1/'

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
 * Host-authoritative 1:1 rooms over a public MQTT broker (omok_s style).
 * Host = White, guest = Black.
 */
export function connectPeer(handlers: PeerHandlers) {
  let client: MqttClient | null = null
  let peerId: string | null = null
  let role: Role | null = null
  let code: string | null = null
  let topic: string | null = null
  let room: HostRoom | null = null
  let ready = false
  let guestPeer: string | null = null
  let busy = false
  let greeted = false
  let joinTimer: ReturnType<typeof setTimeout> | null = null

  function markGuestJoined() {
    clearJoinTimer()
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

  function publish(payload: WireMessage, opts?: { retain?: boolean; qos?: 0 | 1 | 2 }) {
    if (!client || !topic || !client.connected) return
    client.publish(topic, JSON.stringify(payload), opts ?? { qos: 0 })
  }

  function clearRetain() {
    if (!client || !topic) return
    try {
      client.publish(topic, '', { retain: true, qos: 0 })
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
    busy = false
    greeted = false
    const old = client
    client = null
    peerId = null
    role = null
    code = null
    topic = null
    room = null
    ready = false
    guestPeer = null
    if (old) {
      try {
        old.end(true)
      } catch {
        // ignore
      }
    }
  }

  function emitHostRoom() {
    if (!room || !code) return
    handlers.onRoom(
      toSnapshot(code, ready, 'w', ready ? room.game : null, rematchOf(room)),
    )
  }

  function broadcastState(type: 'state' | 'rematch') {
    if (!room || !code || !peerId) return
    publish({
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
    publish({ type: 'error', peer: peerId, to, message })
  }

  function sendWelcome(to: string) {
    if (!room || !peerId || !code) return
    publish({
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
    const toMoves = getLegalMoves(room.game, from).filter((m) => m.to === to)
    // King capture ends the game — accept any promo variant (default queen).
    const kingHit = toMoves.find((m) => m.captured?.type === 'k')
    const legal =
      kingHit ??
      toMoves.find((m) => (m.promotion ?? undefined) === promotion)
    if (!legal) return false
    const next = makeMove(room.game, legal)
    if (!next) return false
    room.game = next
    clearRematch()
    broadcastState('state')
    return true
  }

  function applyCard(card: AugmentId, opts: UseCardOpts, as: Color) {
    if (!room || !ready) return false
    if (room.game.turn !== as || room.game.result) return false
    if (room.game.phase !== 'playing') return false
    const next = useActiveCard(room.game, card, opts)
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
        if (
          !applyCard(
            msg.card,
            {
              square: msg.square,
              square2: msg.square2,
              promotion: msg.promotion,
            },
            'b',
          )
        ) {
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
        if (!greeted && !ready && peerId) {
          greeted = true
          publish({ type: 'hello', peer: peerId })
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
        fail(msg.message || 'Something went wrong.')
        teardown()
        break
      }
      default:
        break
    }
  }

  function handleMessage(raw: Buffer | string) {
    let msg: WireMessage
    try {
      msg = JSON.parse(String(raw)) as WireMessage
    } catch {
      return
    }
    if (role === 'host') onHostMessage(msg)
    else if (role === 'guest') onGuestMessage(msg)
  }

  function startClient(willRole: Role) {
    peerId = makeId()
    client = mqtt.connect(BROKER, {
      clientId: peerId,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 12_000,
      will: {
        topic: topic!,
        payload: JSON.stringify({
          type: 'peer_gone',
          peer: peerId,
          role: willRole,
        } satisfies WireMessage),
        qos: 0,
        retain: false,
      },
    })

    client.on('message', (_t, payload) => handleMessage(payload))
    client.on('error', () => {
      /* connect timeout covers user-facing errors */
    })
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

      startClient('host')
      handlers.onOpen?.()

      const createTimer = setTimeout(() => {
        if (busy && role === 'host') {
          fail('Could not create room. Try again.')
          teardown()
        }
      }, 12_000)

      client!.on('connect', () => {
        clearTimeout(createTimer)
        client!.subscribe(topic!, { qos: 0 }, (err) => {
          if (err) {
            fail('Could not create room. Try again.')
            teardown()
            return
          }
          publish(
            { type: 'host_ready', peer: peerId! },
            { retain: true, qos: 0 },
          )
          busy = false
          emitHostRoom()
        })
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
      greeted = false
      code = normalized
      topic = TOPIC_PREFIX + code
      role = 'guest'
      ready = false
      room = null

      startClient('guest')
      handlers.onOpen?.()

      const joinConnectTimer = setTimeout(() => {
        if (busy && !ready && role === 'guest') {
          fail('Could not join room. Try again.')
          teardown()
        }
      }, 12_000)

      client!.on('connect', () => {
        clearTimeout(joinConnectTimer)
        client!.subscribe(topic!, { qos: 0 }, (err) => {
          if (err) {
            fail('Could not join room. Try again.')
            teardown()
            return
          }
          // Retained host_ready arrives immediately if the room exists.
          joinTimer = setTimeout(() => {
            if (!ready) {
              fail('Room not found. Check the code and try again.')
              teardown()
            }
          }, 2_500)
        })
      })
    },

    move(from: number, to: number, promotion?: PieceType) {
      if (role === 'host') {
        applyMove(from, to, promotion, 'w')
        return
      }
      if (!peerId) return
      publish({ type: 'move', peer: peerId, from, to, promotion })
    },

    useCard(card: AugmentId, opts: UseCardOpts = {}) {
      if (role === 'host') {
        applyCard(card, opts, 'w')
        return
      }
      if (!peerId) return
      publish({
        type: 'use_card',
        peer: peerId,
        card,
        square: opts.square,
        square2: opts.square2,
        promotion: opts.promotion,
      })
    },

    pickCard(card: AugmentId) {
      if (role === 'host') {
        applyPick(card, 'w')
        return
      }
      if (!peerId) return
      publish({ type: 'pick_card', peer: peerId, card })
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
      publish({ type: 'rematch_vote', peer: peerId })
    },

    leave() {
      if (client && topic && client.connected && peerId) {
        publish({ type: 'leave', peer: peerId, role: role ?? 'guest' })
        if (role === 'host') clearRetain()
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
