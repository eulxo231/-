import type { ClientMessage, ServerMessage } from '../../shared/protocol'

// Free hosts (e.g. Render) can take ~1 min to wake from sleep
const CONNECT_TIMEOUT_MS = 60_000

function defaultWsUrl(): string | null {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env

  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    return `ws://${host}:3001`
  }

  // GitHub Pages (and other static hosts) have no game server on :3001
  return null
}

export type SocketHandlers = {
  onMessage: (msg: ServerMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (message: string) => void
}

export function connectSocket(handlers: SocketHandlers) {
  const url = defaultWsUrl()
  if (!url) {
    handlers.onError?.(
      'Online play needs a game server. Deploy the WebSocket server and set VITE_WS_URL (see README).',
    )
    return {
      send(_message: ClientMessage) {},
      close() {},
      get readyState() {
        return WebSocket.CLOSED
      },
    }
  }

  const ws = new WebSocket(url)
  const queue: ClientMessage[] = []
  let settled = false

  const fail = (message: string) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    handlers.onError?.(message)
    try {
      ws.close()
    } catch {
      // ignore
    }
  }

  const timer = window.setTimeout(() => {
    fail('Timed out connecting to the game server')
  }, CONNECT_TIMEOUT_MS)

  ws.addEventListener('open', () => {
    settled = true
    clearTimeout(timer)
    for (const message of queue.splice(0)) {
      ws.send(JSON.stringify(message))
    }
    handlers.onOpen?.()
  })
  ws.addEventListener('close', () => {
    clearTimeout(timer)
    handlers.onClose?.()
  })
  ws.addEventListener('error', () => {
    fail(`Could not reach the game server (${url})`)
  })
  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(String(event.data)) as ServerMessage
      handlers.onMessage(msg)
    } catch {
      // ignore malformed payloads
    }
  })

  return {
    send(message: ClientMessage) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
        return
      }
      if (ws.readyState === WebSocket.CONNECTING) {
        queue.push(message)
      }
    },
    close() {
      queue.length = 0
      clearTimeout(timer)
      ws.close()
    },
    get readyState() {
      return ws.readyState
    },
  }
}

export type GameSocket = ReturnType<typeof connectSocket>
