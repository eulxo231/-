# 1. About Project

This project is my version of 'Augmental Chess'(link https://augmentchess.org/) (my link https://eulxo231.github.io/-/). Augment chess is a variation of the original chess, but with augments, or ability cards that are involved in regular chess.

# 2. Tools
>(Framework & library)

The project is made with React Vite.

# 3. How to Play

The main playstyle is the same as chess, but a draft of cards pop up every 5 turns of each player. Augmental cards are divided into the following types: rules, openings, and active cards. When an augment is active, it will show up on the right side next to the chess board. There are 2 version of the game: local, and online. To play the online(2 player) version, simply create a room code or type it to join.

## Augment cards:

### RULE

### Acceleration
>From the third turn, every player takes 2 actions per turn.

### Blood Moon
>If you have any capture available, you must capture.

### Borrowed Time
>The first time a side has no moves, they delete one of their non-king pieces instead of losing.

### Fog
>A piece that just moved cannot capture on the following turn.

### Gravity
>Pieces may not move backward toward their own back rank (except knights and kings).

### Highway
>Install highways on the b and g files. Pieces on them can slide freely along the file.

### Inkblot
>You cannot move onto a square whose opposite corner twin (a1↔h8) is occupied.

### King Hunt
>Capturing a piece adjacent to the enemy king grants an extra action (once per turn).

### Mirror
>Castling is disabled for both players.

### Narrow Board
>The a- and h-files cannot be moved onto.

### No Quiet
>After move 10, every move must capture or end next to the enemy king.

### Quiet Hours
>No captures are allowed on odd full-moves.

### Shared Pool
>After you capture, you gain one extra action this turn (once per turn).

### Sudden Death
>From move 20, capturing a knight, bishop, rook, or queen wins the game instantly.

### Symmetry Tax
>The two kings may not stand on the same file.

### Tidal Files
>On odd full-moves only a–d are playable; on even full-moves only e–h.

### Piece

### Anchor Rook
>Rooks still on their starting corner squares cannot be captured by pawns.

### Crooked Knight
>After a knight move, that knight may take one extra non-capturing king-step this turn.

### Echo Lane
>After you slide a rook, bishop, or queen, leave an echo on the square you left that blocks enemy slides until your next turn.

### Ghost Pawn
>Your pawns may step forward through one friendly pawn.

### Glass Queen
>Your queen moves normally, but is also removed whenever she captures.

### Hopping Bishop
>Your bishops may jump over exactly one piece per move.

### Iron Rook
>Your rooks cannot be captured by pawns.

### Knightmare
>Your knights may also move one square orthogonally.

### Longcastle
>Your king may castle with any of your rooks on the back rank if the path is empty.

### Militia
>Your knights may also capture one square diagonally forward.

### Omni Pawn
>Your pawns can move one square left, right, up, or down.

### Pawn Storm
>Your pawns may always step two forward when the path is clear (no en passant from that).

### Reckless Charge
>When your knight jumps over an orthogonally adjacent enemy, that piece is captured automatically.

### Seed Bishop
>When your bishop captures, spawn a pawn on the square it left if that square is empty.

### Slippery Bishop
>Your bishops can pass through one friendly piece per move.

### Twin Knights
>After you move a knight, your other knight may make one non-capturing knight-hop this turn.

### Active

### Bargain
>Sacrifice one of your pawns to gain an extra action this turn. Once.

### Bomb
>Remove any enemy non-king piece. Once.

### Castle Now
>Instantly castle with one of your rooks if the path is empty (ignores prior moves). Once.

### Coronation
>Choose one of your pieces (except the king) and turn it into a queen. Once.

### Crown Split
>Replace your queen with two knights on her square and one empty adjacent square. Once.

### Duel
>Choose one of your pieces and one enemy piece (not kings) a king-move apart; both are removed. Once.

### Eclipse
>Freeze one enemy non-king piece until the start of your next turn. Once.

### Glacier
>Enemy bishops, rooks, and queens may only move to their maximum range for their next 3 actions. Once.

### Long Stride
>Choose one of your pieces (not a queen). It may move one square farther than usual. Once.

### Poltergeist
>Force one enemy non-king piece to take one of its legal non-capturing steps (you choose). Once.

### Promote Now
>Promote one of your pawns in place to a knight, bishop, or rook. Once.

### Recall
>Return one of your pieces to its starting square if that square is empty. Once.

### Recruit
>Place a pawn on an empty square of your second rank. Once.

### Rewind
>Undo the last move on the board, then continue your turn. Once.

### Smuggle
>Move one of your non-king pieces to any empty square on your back two ranks. Once.

### Suicide Bomber
>Give one of your pawns a suicide charge. When it is captured, it explodes in a 3×3 area, removing every piece there (including yours). Once.

### Swap
>Swap the positions of two of your non-king pieces. Once.

### Teleport
>Move your king to any empty square on your back rank. Once.

### Time Skip
>Gain an extra full action budget this turn. Once.

### Upheaval
>Randomly shuffle the positions of every piece on the board (yours and theirs). Once.

### Opening

### Ash Start
>After your first move: both sides lose all bishops and knights.

### Castle Siege
>After your first move: remove your knights; place pawns on c and f of your third rank if empty.

### Cuckoo
>After your first move: replace your king with a queen and place the king on a random empty back-rank square.

### Embassy
>After your first move: place an envoy pawn in the center. Whoever captures it gains an extra action.

### Fianchetto Both
>After your first move: clear b2/g2 (or b7/g7) and place your bishops there if empty.

### Horde
>After your first move, remove all your pieces except the king and switch to the Horde layout.

### King Walk
>After your first move: move king to f1/f8 and a rook to e1/e8 (artificial castle).

### Knight Out
>After your first move: place your knights on c3/f3 (or c6/f6) if those squares are empty.

### Lone King
>After your first move: keep only your king and four pawns on the home rank.

### Nursery
>After your first move: clear your second rank and fill it with your pawns.

### Phalanx
>After your first move: all your pawns advance one rank if that square is empty.

### Queen's Gambit Denied
>After your first move: remove your queen; add knights on d2/d7 and f2/f7 if empty.

### Scatter
>After your first move: reshuffle your non-king pieces into random empty squares in your half.

### Vault
>After your first move: swap your king with your queen, or with a rook if you have no queen.

# 4. Update Note
>(feedback list)

#### version 1.0
- can't see full explanations of cards (expand when hovered)
- opening cards didn't pop up on the first card draw
- putting in a random code says connected
- Pawn cannot move beyond the 2nd last row
