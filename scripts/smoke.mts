import {
  createGame,
  getAllLegalMoves,
  getLegalMoves,
  makeMove,
} from '../src/engine/game.ts'

let g = createGame()
const e2 = 52
const e4 = 36
const e7 = 12
const e5 = 28
let m = getLegalMoves(g, e2).find((x) => x.to === e4)
if (!m) throw new Error('e2e4 missing')
g = makeMove(g, m)!
m = getLegalMoves(g, e7).find((x) => x.to === e5)
if (!m) throw new Error('e7e5 missing')
g = makeMove(g, m)!
console.log('after e4 e5', g.turn, g.fullMove)

g = createGame()
g.board = Array(64).fill(null)
g.board[4] = { type: 'k', color: 'b' }
g.board[60] = { type: 'k', color: 'w' }
g.board[12] = { type: 'q', color: 'w' }
g.history = []
const cap = getLegalMoves(g, 12).find((x) => x.to === 4)
if (!cap) throw new Error('queen cannot take king')
g = makeMove(g, cap)!
console.log('king capture result', g.result)

g = createGame()
g.board = Array(64).fill(null)
g.board[60] = { type: 'k', color: 'w' }
g.turn = 'b'
console.log('black no pieces moves', getAllLegalMoves(g).length)

// Moving into "check" allowed: white king steps next to black queen
g = createGame()
g.board = Array(64).fill(null)
g.board[60] = { type: 'k', color: 'w' } // e1
g.board[4] = { type: 'k', color: 'b' }
g.board[52] = { type: 'q', color: 'b' } // e2
const step = getLegalMoves(g, 60).find((x) => x.to === 59) // d1
if (!step) throw new Error('king should move freely')
g = makeMove(g, step)!
console.log('moved beside enemy queen ok', g.turn, g.result)

console.log('ok')
