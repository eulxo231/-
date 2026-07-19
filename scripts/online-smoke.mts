import WebSocket from 'ws'

function waitFor(
  ws: WebSocket,
  predicate: (msg: Record<string, unknown>) => boolean,
  label: string,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), 4000)
    const onMessage = (data: WebSocket.RawData) => {
      const msg = JSON.parse(String(data)) as Record<string, unknown>
      if (!predicate(msg)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(msg)
    }
    ws.on('message', onMessage)
  })
}

const a = new WebSocket('ws://localhost:3001')
await new Promise<void>((resolve) => a.on('open', () => resolve()))
await waitFor(a, (m) => m.type === 'hello', 'hello a')
a.send(JSON.stringify({ type: 'create' }))
const created = (await waitFor(a, (m) => m.type === 'room', 'create')) as {
  room: { code: string; you: string }
}
console.log('created', created.room.code, created.room.you)

const b = new WebSocket('ws://localhost:3001')
await new Promise<void>((resolve) => b.on('open', () => resolve()))
await waitFor(b, (m) => m.type === 'hello', 'hello b')

const aUpdatedP = waitFor(
  a,
  (m) =>
    m.type === 'room' &&
    !!(m.room as { blackPresent?: boolean }).blackPresent,
  'join a',
)
const bJoinedP = waitFor(b, (m) => m.type === 'room', 'join b')

b.send(JSON.stringify({ type: 'join', code: created.room.code }))

const [updatedA, joinedB] = (await Promise.all([aUpdatedP, bJoinedP])) as [
  { room: { whitePresent: boolean; blackPresent: boolean; status: string } },
  { room: { you: string; status: string } },
]
console.log(
  'joined',
  joinedB.room.you,
  joinedB.room.status,
  updatedA.room.whitePresent,
  updatedA.room.blackPresent,
)

const bMoveP = waitFor(
  b,
  (m) =>
    m.type === 'room' &&
    (m.room as { game?: { turn?: string } }).game?.turn === 'b',
  'move',
)
a.send(JSON.stringify({ type: 'move', from: 52, to: 36 }))
const afterMove = (await bMoveP) as {
  room: { game: { turn: string; lastMove: { from: number; to: number } } }
}
console.log(
  'turn',
  afterMove.room.game.turn,
  afterMove.room.game.lastMove.from,
  afterMove.room.game.lastMove.to,
)

const aWaitP = waitFor(
  a,
  (m) =>
    m.type === 'room' &&
    !(m.room as { blackPresent?: boolean }).blackPresent,
  'waiting',
)
b.send(JSON.stringify({ type: 'leave' }))
await waitFor(b, (m) => m.type === 'left', 'left')
const aWait = (await aWaitP) as {
  room: { status: string; blackPresent: boolean }
}
console.log('after leave', aWait.room.status, aWait.room.blackPresent)

a.close()
b.close()
console.log('ok')
