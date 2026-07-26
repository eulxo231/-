import { useState } from 'react'
import type { RoomSnapshot } from '../../shared/protocol'
import type { ConnectionStatus } from '../online/useOnlineGame'

interface LobbyProps {
  mode: 'local' | 'online'
  onModeChange: (mode: 'local' | 'online') => void
  connection: ConnectionStatus
  room: RoomSnapshot | null
  error: string | null
  onCreate: () => void
  onJoin: (code: string) => void
  onLeave: () => void
}

export function Lobby({
  mode,
  onModeChange,
  connection,
  room,
  error,
  onCreate,
  onJoin,
  onLeave,
}: LobbyProps) {
  const [code, setCode] = useState('')

  return (
    <section className="lobby">
      <div className="mode-toggle" role="tablist" aria-label="Play mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'local'}
          className={mode === 'local' ? 'active' : ''}
          onClick={() => onModeChange('local')}
        >
          Local
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'online'}
          className={mode === 'online' ? 'active' : ''}
          onClick={() => onModeChange('online')}
        >
          Online
        </button>
      </div>

      {mode === 'online' && (
        <div className="online-panel">
          {!room ? (
            <>
              <p className="online-copy">
                Create a room and share the code, or join a friend’s game.
                {connection === 'connecting' &&
                  ' First connect can take a minute if the server was asleep.'}
              </p>
              <div className="online-actions">
                <button type="button" onClick={onCreate}>
                  Create room
                </button>
                <form
                  className="join-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    onJoin(code)
                  }}
                >
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    maxLength={4}
                    aria-label="Room code"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="submit" className="ghost">
                    Join
                  </button>
                </form>
              </div>
              <p className={`conn ${connection}`}>
                {connection === 'connected' && 'Connected'}
                {connection === 'connecting' && 'Connecting…'}
                {connection === 'disconnected' && 'Disconnected — retry by creating or joining'}
                {connection === 'idle' && 'Ready to connect'}
              </p>
            </>
          ) : (
            <div className="room-card">
              <div className="room-code-block">
                <span>Room code</span>
                <strong>{room.code}</strong>
              </div>
              <ul className="seats">
                <li className={room.whitePresent ? 'filled' : ''}>
                  White {room.you === 'w' ? '(you)' : ''}
                  <em>{room.whitePresent ? 'in' : 'open'}</em>
                </li>
                <li className={room.blackPresent ? 'filled' : ''}>
                  Black {room.you === 'b' ? '(you)' : ''}
                  <em>{room.blackPresent ? 'in' : 'open'}</em>
                </li>
              </ul>
              <p className="room-status">
                {room.status === 'waiting' && 'Waiting for opponent…'}
                {room.status === 'playing' && 'Game in progress'}
                {room.status === 'finished' && 'Game finished'}
              </p>
              <button type="button" className="ghost leave" onClick={onLeave}>
                Leave room
              </button>
            </div>
          )}

          {error && <p className="online-error">{error}</p>}
        </div>
      )}
    </section>
  )
}
