import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomSnapshot } from '../../shared/protocol'
import type { AugmentId } from '../augments/catalog'
import type { PieceType } from '../engine/types'
import { connectSocket, type GameSocket } from './socket'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export function useOnlineGame() {
  const socketRef = useRef<GameSocket | null>(null)
  const [connection, setConnection] = useState<ConnectionStatus>('idle')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ensureSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
      return socketRef.current
    }

    setConnection('connecting')
    const socket = connectSocket({
      onOpen: () => setConnection('connected'),
      onClose: () => {
        setConnection('disconnected')
        setRoom(null)
      },
      onError: () => setError('Could not reach the game server'),
      onMessage: (msg) => {
        switch (msg.type) {
          case 'room':
            setRoom(msg.room)
            setError(null)
            break
          case 'left':
            setRoom(null)
            break
          case 'error':
            setError(msg.message)
            break
          default:
            break
        }
      },
    })
    socketRef.current = socket
    return socket
  }, [])

  useEffect(() => {
    return () => {
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  const createRoom = useCallback(() => {
    setError(null)
    ensureSocket().send({ type: 'create' })
  }, [ensureSocket])

  const joinRoom = useCallback(
    (code: string) => {
      setError(null)
      ensureSocket().send({ type: 'join', code })
    },
    [ensureSocket],
  )

  const leaveRoom = useCallback(() => {
    setError(null)
    socketRef.current?.send({ type: 'leave' })
    setRoom(null)
  }, [])

  const sendMove = useCallback(
    (from: number, to: number, promotion?: PieceType) => {
      setError(null)
      ensureSocket().send({ type: 'move', from, to, promotion })
    },
    [ensureSocket],
  )

  const sendUseCard = useCallback(
    (card: 'coronation', square: number) => {
      setError(null)
      ensureSocket().send({ type: 'use_card', card, square })
    },
    [ensureSocket],
  )

  const sendPickCard = useCallback(
    (card: AugmentId) => {
      setError(null)
      ensureSocket().send({ type: 'pick_card', card })
    },
    [ensureSocket],
  )

  const rematch = useCallback(() => {
    setError(null)
    ensureSocket().send({ type: 'rematch' })
  }, [ensureSocket])

  const clearError = useCallback(() => setError(null), [])

  return {
    connection,
    room,
    error,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMove,
    sendUseCard,
    sendPickCard,
    rematch,
  }
}
