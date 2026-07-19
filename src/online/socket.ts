import type { ClientMessage, ServerMessage } from '../../shared/protocol'

function defaultWsUrl(): string {
  const env = import.meta.env.VITE_WS_URL as string | undefined
  if (env) return env
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  return `${protocol}//${host}:3001`
}

export type SocketHandlers = {
  onMessage: (msg: ServerMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: () => void
}

export function connectSocket(handlers: SocketHandlers) {
  const ws = new WebSocket(defaultWsUrl())
  const queue: ClientMessage[] = []

  ws.addEventListener('open', () => {
    for (const message of queue.splice(0)) {
      ws.send(JSON.stringify(message))
    }
    handlers.onOpen?.()
  })
  ws.addEventListener('close', () => handlers.onClose?.())
  ws.addEventListener('error', () => handlers.onError?.())
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
      ws.close()
    },
    get readyState() {
      return ws.readyState
    },
  }
}

export type GameSocket = ReturnType<typeof connectSocket>
