import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomSnapshot } from '../../shared/protocol'
import type { AugmentId } from '../augments/catalog'
import type { PieceType } from '../engine/types'
import { connectPeer, type PeerNet } from './peerNet'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

export function useOnlineGame() {
  const netRef = useRef<PeerNet | null>(null)
  const [connection, setConnection] = useState<ConnectionStatus>('idle')
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ensureNet = useCallback(() => {
    if (netRef.current) return netRef.current

    setConnection('connecting')
    const net = connectPeer({
      onOpen: () => {
        setConnection('connected')
        setError(null)
      },
      onClose: () => {
        setConnection('disconnected')
        setRoom(null)
        netRef.current = null
      },
      onRoom: (next) => {
        setRoom(next)
        setError(null)
        setConnection('connected')
      },
      onLeft: () => {
        setRoom(null)
        netRef.current = null
      },
      onError: (message) => {
        setConnection('disconnected')
        setError(message)
        netRef.current = null
      },
    })
    netRef.current = net
    return net
  }, [])

  useEffect(() => {
    return () => {
      netRef.current?.close()
      netRef.current = null
    }
  }, [])

  const createRoom = useCallback(() => {
    setError(null)
    ensureNet().create()
  }, [ensureNet])

  const joinRoom = useCallback(
    (code: string) => {
      setError(null)
      ensureNet().join(code)
    },
    [ensureNet],
  )

  const leaveRoom = useCallback(() => {
    setError(null)
    netRef.current?.leave()
    netRef.current = null
    setRoom(null)
    setConnection('idle')
  }, [])

  const sendMove = useCallback(
    (from: number, to: number, promotion?: PieceType) => {
      setError(null)
      ensureNet().move(from, to, promotion)
    },
    [ensureNet],
  )

  const sendUseCard = useCallback(
    (
      card: AugmentId,
      opts: { square?: number; square2?: number; promotion?: PieceType } = {},
    ) => {
      setError(null)
      ensureNet().useCard(card, opts)
    },
    [ensureNet],
  )

  const sendPickCard = useCallback(
    (card: AugmentId) => {
      setError(null)
      ensureNet().pickCard(card)
    },
    [ensureNet],
  )

  const rematch = useCallback(() => {
    setError(null)
    ensureNet().rematch()
  }, [ensureNet])

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
