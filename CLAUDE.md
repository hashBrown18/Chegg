# CLAUDE.md — CHEGG Online Game
## Complete Project Specification — Read Every Word Before Writing Code

---

## WHAT IS CHEGG?

CHEGG (Chess + Egg) is a turn-based, deck-building strategy game originally designed
to be played inside Minecraft. This project is a full web-based reimplementation that
allows two players to play against each other online from different devices anywhere
in the world. No Minecraft required.

The game is played on an 8-column x 10-row checkerboard (columns 1-8, rows A-J).
Players build a deck of 15 minions, take turns spawning them onto the board, and try
to eliminate the opponent's Villager (King) minion to win.

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Database | MongoDB Atlas (free tier) |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

CRITICAL: Do NOT use Python. Do NOT add any other backend language. Node.js only.

---

## PROJECT FOLDER STRUCTURE

```
chegg/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board/
│   │   │   │   ├── Board.jsx
│   │   │   │   ├── Cell.jsx
│   │   │   │   └── MinionPiece.jsx
│   │   │   ├── DeckBuilder/
│   │   │   │   ├── DeckBuilder.jsx
│   │   │   │   ├── MinionCard.jsx
│   │   │   │   └── MinionPopup.jsx
│   │   │   ├── GameUI/
│   │   │   │   ├── PlayerPanel.jsx
│   │   │   │   ├── ManaDisplay.jsx
│   │   │   │   ├── Hand.jsx
│   │   │   │   ├── TurnIndicator.jsx
│   │   │   │   ├── AbandonTimer.jsx
│   │   │   │   ├── RulesPanel.jsx
│   │   │   │   └── SideButtons.jsx
│   │   │   └── Lobby/
│   │   │       ├── Landing.jsx
│   │   │       ├── CreateRoom.jsx
│   │   │       └── JoinRoom.jsx
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LobbyPage.jsx
│   │   │   ├── DeckBuilderPage.jsx
│   │   │   └── GamePage.jsx
│   │   ├── socket.js
│   │   ├── App.jsx
│   │   └── main.jsx
├── server/
│   ├── index.js
│   ├── socket/
│   │   ├── roomHandlers.js
│   │   ├── gameHandlers.js
│   │   └── reconnectHandlers.js
│   ├── game/
│   │   ├── GameState.js
│   │   ├── MinionLogic.js
│   │   ├── MovementCalculator.js
│   │   └── TurnManager.js
│   ├── models/
│   │   └── Room.js
│   └── routes/
│       └── api.js
└── CLAUDE.md
```

---

## PAGES AND FLOW

### Page 1 — Landing Page (/)
- Big centered title: CHEGG
- Subtitle: "Chess meets Minecraft"
- Two buttons only: "Create Room" and "Join Room"
- Dark theme, nothing else on the page

### Page 2 — Create Room (/create)
SKETCH CONFIRMED: Centered card layout, title "Create Room" at top
- Input field: "Enter username" centered
- Button: "Create Room" below input
- AFTER clicking Create Room button:
  - Show generated 6-character room code in large bold text
  - Copy to clipboard button next to room code
  - Show "Waiting for opponent..." below code
  - Button and input disappear, replaced by code display
- Once opponent joins → both automatically navigate to Deck Builder

### Page 3 — Join Room (/join)
SKETCH CONFIRMED: Centered card layout, title "Join Room" at top
- Input field: "Enter code" at top
- Input field: "Enter username" below code input
- Button: "Join Room" below username input
- If code invalid → show error: "Room not found"
- If room full → show error: "Room is already full"
- On success → navigate to Deck Builder

### Page 4 — Deck Builder (/deck)
SKETCH CONFIRMED: Two sections stacked vertically
- Title "Deck Building" at top center
- TOP SECTION — "To Choose Eggs" grid:
  - Grid of all 11 available minion egg cards
  - Each card: egg image + minion name + mana cost badge
  - Clicking a card adds it to chosen section
  - Counter displayed: "X / 15 Selected"
  - Info icon on each card opens Minion Popup modal
- BOTTOM SECTION — "Chosen Eggs":
  - Shows selected minions as smaller cards horizontally
  - Can click to remove from selection
  - Shows how many of each minion selected (duplicates allowed)
- CONFIRM button at bottom — only active when exactly 15 selected
- If one player confirms first → show "Waiting for opponent..."
- OPPONENT CANNOT SEE YOUR SELECTIONS EVER

### Page 5 — Game Page (/game)
SKETCH CONFIRMED: Layout as follows:
- TOP LEFT: Player names box — shows "(Name of people that are in room)" — displays both usernames e.g. "PlayerOne vs PlayerTwo"
- TOP CENTER: "Whose Turn" indicator box — shows whose turn it currently is with their username
- LEFT SIDE PANEL: Opponent's mana display
- CENTER: The Board (10x8 checkerboard)
- RIGHT SIDE PANEL: Your mana display
- BOTTOM: "Your Eggs" — your hand cards displayed horizontally
- Rules button and End Turn button also on this screen
- Background: pure black #000000

### Page 6 — Win Screen
NO dedicated page needed.
When game ends simply display fullscreen overlay:
- "[username] wins!" in large centered text
- Two buttons: "Rematch" and "Leave"
- Background: #50207A with SVG dot pattern

---

## GAME PAGE FULL LAYOUT

Based exactly on the uploaded screenshot reference:

```
[CHEGG title - top left] [• Red's Turn - top center] [Turn 3 - top right]

[BLUE PLAYER PANEL - left]     [8x10 BOARD - center]     [RED PLAYER PANEL - right]
[EGGS button - left]                                       
[RULES button - left]          

                          [YOUR HAND - bottom center]
```

---

## PLAYER PANELS

### Blue Player Panel (LEFT sidebar):
- Player name with blue dot
- Mana display: 6 dots total (filled = available, empty = spent), fraction below (e.g. 0/1)
- Cards in Deck: icon + count
- Cards in Hand: icon + count
- Active turn = colored border glow

### Red Player Panel (RIGHT sidebar):
- Same layout as Blue
- Red dot and red border glow when active
- Shows opponent mana count, deck count, hand count
- NEVER shows opponent actual hand cards, only counts

### Left Sidebar Buttons (below Blue Player Panel):
- EGGS button
- RULES button

---

## THE GAME BOARD

- 8 columns labeled 1-8 left to right
- 10 rows labeled A-J top to bottom
- Classic alternating dark and light checkerboard squares
- Blue spawn zone: rows A and B (top 2 rows), blue tint overlay
- Red spawn zone: rows I and J (bottom 2 rows), red tint overlay
- Middle rows C through H: neutral, no tint
- Minions shown as pixel art icons centered in their cell
- Every cell is clickable

### Board Flip for Player 2:
- Player 2 (Red) sees the entire board flipped 180 degrees
- Red spawn zone appears at TOP for Red player
- Blue spawn zone appears at BOTTOM for Red player
- Exactly like chess.com — both players feel they are at the bottom
- Row and column labels flip accordingly

---

## CLICK BEHAVIOR

### Clicking YOUR minion (your turn only):
- Server calculates valid movement squares and valid attack squares
- Server sends highlight data ONLY to your socket
- Opponent receives ZERO highlight information
- Green overlay on valid movement squares
- Red overlay on valid attack squares
- Click green square = move minion there
- Click red square = attack there (costs mana)
- Click anywhere else = deselect and remove highlights

### Clicking OPPONENT minion:
- Nothing happens at all
- No highlights
- No data revealed
- This is intentional and permanent

### Clicking your card in hand:
- Card becomes selected
- Valid spawn squares in YOUR spawn zone highlight green
- Click green spawn square = minion spawns there (costs mana equal to minion cost)

---

## MANA SYSTEM

- Range 0 to 6, hard cap at 6
- Turn 1: 1 mana. Turn 2: 2 mana. Turn 3: 3 mana. Turn 4: 4 mana. Turn 5: 5 mana. Turn 6+: 6 mana forever.
- Mana FULLY REFRESHES at start of every turn
- Unused mana DISCARDED, never carries over
- NO save mana button. Mana is fully automatic.
- Displayed as 6 dots: filled = available, empty = spent
- Both players see only their own mana

### Mana Costs:
- Spawn minion = that minion's listed cost
- Attack with any minion = 1 mana (Wither = 2 mana)
- Move Villager = 1 mana always (no free movement for Villager)
- Enderman Teleport = 1 mana
- Wither attack = 2 mana

---

## TURN STRUCTURE

Automatic at turn start (server-managed):
1. Mana refreshes to current turn max value
2. Player draws 1 card from deck

During turn player can do in any order:
- Spawn minions from hand to spawn zone
- Move minions on board (1 FREE move per minion per turn)
- Attack with minions (1 mana each, 2 mana for Wither)
- Use special abilities
- Click End Turn button

### Hard Rules (enforce server-side, no exceptions):
- Minions spawned this turn CANNOT act until NEXT turn
- A minion CANNOT move AND attack in the same turn
- A minion CANNOT move after attacking
- Each minion attacks maximum ONCE per turn
- Villager costs 1 mana to move always, no free movement
- Game start: each player draws 3 cards before Turn 1
- Villager placed for FREE in spawn zone at game start, not in deck

---

## HAND AND DECK

- Deck = 15 minions from deck builder
- Starting hand = 3 cards drawn before Turn 1
- Each turn start = 1 card drawn automatically
- Hand shown at bottom as card icons with mana cost badge
- Server sends ONLY each player's own hand data
- Opponent hand cards NEVER transmitted to wrong socket
- Opponent panel shows only COUNT of cards

---

## WIN CONDITION

- Eliminate opponent Villager = WIN
- Your Villager eliminated = LOSE
- Server detects Villager elimination instantly and ends game
- Show win/lose screen with Rematch and Leave buttons

---

## ALL 11 MINIONS EXACT SPECIFICATIONS

Build movement and attack calculators INDIVIDUALLY for each minion.
Do NOT use a generic movement system. Every minion is unique.
PIG IS REMOVED — do not add it under any circumstances.

### 1. VILLAGER (King)
- Cost: FREE, placed at game start, NOT in deck
- Movement: All 8 surrounding squares. Costs 1 mana always (no free movement ever).
- Attack: All 8 surrounding squares. Minion moves to the square it attacks.
- CRITICAL: Death = instant game loss for that player.

### 2. ZOMBIE
- Cost: 1 mana
- Movement: Forward only — one of the 3 squares directly ahead (relative to player side)
- Attack: 4 lateral surrounding squares only (up down left right, NOT diagonals)
- Special: None

### 3. CREEPER
- Cost: 1 mana
- Movement: Any of the 8 surrounding squares
- Attack: EXPLOSION — destroys ALL minions in all 8 surrounding squares including itself. One time use. Friendly fire ON.
- After explosion Creeper is permanently eliminated.

### 4. PUFFER-FISH
- Cost: 2 mana
- Movement: Lateral only (up down left right, NOT diagonals)
- Attack: Hits ALL 4 diagonal squares simultaneously in one attack. Friendly fire ON.
- Special: None

### 5. IRON GOLEM
- Cost: 2 mana
- Movement: Any of the 8 surrounding squares
- Attack: Sweeping — hits 3 adjacent tiles in a chosen lateral direction. Player chooses direction at attack time. Hits the square directly in that direction plus one on each side of it.
- Special: None

### 6. SKELETON
- Cost: 3 mana
- Movement: Lateral only (up down left right)
- Attack: Diagonal only, range of 3 squares
- Special: None

### 7. BLAZE
- Cost: 3 mana
- Movement: Diagonal only
- Attack: Lateral only, range of 2 squares
- Special: None (exact mirror opposite of Skeleton)

### 8. PHANTOM
- Cost: 3 mana
- Movement: ONLY dark tiles on checkerboard. Can ONLY spawn on dark tile in spawn zone.
- Attack: Any tile it can also move to (dark tiles only). Costs 1 mana.
- Special: Restricted to dark tiles permanently.

### 9. ENDERMAN
- Cost: 4 mana
- Movement: CANNOT move normally at all
- Attack: Any of 8 surrounding squares. Costs 1 mana. CANNOT attack same turn as Teleport.
- Special TELEPORT: Costs 1 mana. Swaps positions with ANY minion (friendly or enemy) in any lateral direction regardless of distance. CANNOT target Villager.

### 10. SHULKER-BOX
- Cost: 4 mana
- Movement: CANNOT move freely. Moves ONLY to position of successfully attacked and eliminated minion.
- Attack: Long range lateral (up down left right). BLOCKED if any minion is in the path between Shulker-Box and target.
- Special: Repositions itself only via successful attacks.

### 11. WITHER
- Cost: 6 mana
- ON SPAWN IMMEDIATELY: Destroys EVERYTHING in all 8 surrounding squares. Friendly fire ON. Happens instantly on spawn before any other action.
- Movement: Any of the 8 surrounding squares
- Attack: Shoots projectile in any lateral direction range of 3. On hit also damages all 4 lateral tiles surrounding the hit square. Costs 2 mana (not 1).
- Special: Most powerful unit in the game.

---

## MINION POPUP MODAL

Show ONLY these fields:
- Minion image large
- Minion name large
- Mana Cost
- Movement description in text
- Attack description in text
- Ability description (ONLY if minion has one: Creeper, Enderman, Shulker-Box, Wither, Phantom)

DO NOT SHOW: Health, Travel type, Range type, Type/Class, Immunities, Damaged By, Passive Abilities label

---

## MOVEMENT HIGHLIGHT SYSTEM

1. Player clicks their minion on board
2. Frontend sends request_highlights to server with minion instance ID
3. Server calculates valid move squares and valid attack squares for that specific minion
4. Server emits valid_moves back to ONLY that player's socket
5. Frontend renders green overlays on movement squares and red overlays on attack squares
6. Opponent receives nothing at all

### Boundary rules for calculator:
- No square outside 8x10 board is valid
- Cannot move to square occupied by own minion
- Cannot attack empty square or own minion (except Creeper and Puffer-Fish with friendly fire)
- Phantom can only target dark tiles
- Enderman and Shulker-Box have no movement squares
- Skeleton: lateral move, diagonal attack
- Blaze: diagonal move, lateral attack
- Zombie: only 3 forward squares for movement

---

## SOCKET EVENTS

### Client to Server:
- create_room: { username }
- join_room: { username, roomCode }
- deck_confirmed: { deck: [array of 15 minion IDs] }
- spawn_minion: { minionId, targetCell }
- move_minion: { minionInstanceId, targetCell }
- attack: { minionInstanceId, targetCell }
- use_ability: { minionInstanceId, targetCell }
- end_turn: {}
- request_highlights: { minionInstanceId }
- reconnect: { username, roomCode }

### Server to Client:
- room_created: { roomCode }
- opponent_joined: { opponentUsername }
- game_start: { boardState, yourHand, opponentCardCount, currentTurn, mana }
- your_hand: { hand: [...] }
- opponent_card_count: { count: N }
- board_update: { boardState }
- mana_update: { yourMana }
- valid_moves: { movementSquares: [...], attackSquares: [...] }
- turn_change: { currentTurn, turnNumber }
- game_over: { winner, loser }
- opponent_disconnected: { message, timeoutSeconds: 60 }
- opponent_reconnected: { message }
- abandon_win: { message }

---

## RECONNECTION SYSTEM

On disconnect:
1. Server detects socket disconnect
2. Game does NOT end
3. Server marks player as disconnected in MongoDB
4. Emits opponent_disconnected to other player
5. Starts 60 second server-side countdown

On reconnect:
1. Player enters same username + room code
2. Server matches username + roomCode in MongoDB
3. Full game state restored
4. Player rejoins socket room
5. Emits opponent_reconnected to other player
6. Countdown cancelled
7. Game resumes exactly where left off

If no reconnect in 60 seconds:
1. Emit abandon_win to waiting player
2. Mark game finished in MongoDB
3. Clean up room

---

## HOST LEAVING

- Room lives on server not on host device
- Host disconnecting uses same 60 second reconnect rules
- Host vs guest distinction only matters for room creation
- During gameplay both players are equal
- Game continues as long as server has the room in MongoDB

---

## RULES PANEL CONTENT

## RULES PANEL LAYOUT

SKETCH CONFIRMED: Two panel side by side layout.

Title at top center: "Rule Book"

LEFT PANEL — Rules text:
- Scrollable text content
- Shows all game rules and minion descriptions
- When user scrolls to a minion section, right panel updates to show that minion

RIGHT PANEL — Egg display:
- Shows the egg image of whichever minion is currently being read in left panel
- Large egg image centered in panel
- Minion name below image
- Mana cost below name
- Updates dynamically as user scrolls through left panel

Both panels same height, side by side.
Background: #50207A
Border: #838CE5 outline on both panels
Close X button at top right corner of entire rulebook overlay.

The rules panel must display EXACTLY this content in order:

---

### CHEGG — HOW TO PLAY

**OBJECTIVE**
Eliminate your opponent's Villager to win the game. If your Villager is eliminated, you lose.

**THE BOARD**
CHEGG is played on a 10x8 checkerboard. The last 2 columns on your side are your Spawn Zone — the only place you can place new minions. Once spawned, minions can move anywhere on the board.

**MANA**
Each player has a mana pool that grows each turn:
- Turn 1: 1 mana
- Turn 2: 2 mana
- Turn 3: 3 mana
- Turn 4: 4 mana
- Turn 5: 5 mana
- Turn 6 and beyond: 6 mana (maximum)
Unused mana is discarded at the end of your turn. It never carries over.

**YOUR TURN**
Each turn you automatically draw 1 card. You can then:
- Spawn minions from your hand into your spawn zone (costs mana equal to minion cost)
- Move minions already on the board (1 free move per minion)
- Attack with minions (costs 1 mana per attack)
- Use special abilities (cost listed per minion)
- Click End Turn when done

**IMPORTANT RULES**
- Minions spawned this turn cannot act until next turn
- A minion cannot both move AND attack in the same turn
- A minion cannot move after attacking
- Each minion can only attack once per turn
- The Villager costs 1 mana to move (no free movement)

**DECK**
Before the game starts you choose 15 minions for your deck. You draw 3 cards at the start. Duplicates are allowed. Your opponent cannot see your deck or hand.

**CLICKING MINIONS**
Click your own minion to see valid moves (green) and attack range (red). Opponent's minion ranges are hidden.

---

**MINIONS**

**VILLAGER (King) — FREE**
Your most important minion. Loses the game if eliminated. Moves and attacks all 8 surrounding squares. Costs 1 mana to move always.

**ZOMBIE — Cost 1**
Basic unit. Attacks the 4 lateral squares around it. Moves forward only to one of the 3 squares ahead.

**CREEPER — Cost 1**
Risky but devastating. Moves to any of 8 surrounding squares. Attack triggers an explosion destroying all 8 surrounding squares including itself. One time use. Friendly fire ON.

**PUFFER-FISH — Cost 2**
Offensive unit. Moves laterally only. Attack hits all 4 diagonal squares simultaneously. Friendly fire ON.

**IRON GOLEM — Cost 2**
Sweeping attacker. Moves to any of 8 surrounding squares. Attack hits 3 adjacent tiles in a chosen lateral direction.

**SKELETON — Cost 3**
Ranged unit. Moves laterally only. Attacks diagonally up to 3 squares range.

**BLAZE — Cost 3**
Opposite of Skeleton. Moves diagonally only. Attacks laterally up to 2 squares range.

**PHANTOM — Cost 3**
Dark tile specialist. Can only spawn on, move to, or attack dark tiles. Highly mobile but restricted.

**ENDERMAN — Cost 4**
Cannot move normally. Special ability TELEPORT (1 mana): swap places with any minion in a lateral direction regardless of distance. Cannot target Villager. Can also attack any of 8 surrounding squares but not same turn as Teleport.

**SHULKER-BOX — Cost 4**
Defensive unit. Cannot move freely — moves only to position of successfully attacked minion. Long range lateral attack blocked if another minion is in the way.

**WITHER — Cost 6**
Most powerful unit. On spawn immediately destroys everything in 8 surrounding squares. Moves to any of 8 surrounding squares. Ranged attack costs 2 mana — shoots laterally up to 3 squares and damages 4 surrounding tiles on hit. Friendly fire ON.

---

**FRIENDLY FIRE WARNING**
Creeper, Puffer-Fish, and Wither can damage your own minions. Be careful.

---

## FRIENDLY FIRE

These minions hit your own pieces — enforce server-side always:
- Creeper: explosion hits all 8 squares including friendlies
- Puffer-Fish: diagonal attack hits all 4 diagonals including friendly minions
- Wither: spawn explosion and attack splash hits friendlies

---

## VISUAL DESIGN

### BACKGROUNDS

Two background styles used across different pages:

**Pages using SVG dot pattern background:**
- Landing Page
- Create Room Page
- Join Room Page
- Deck Builder Page

Use this EXACT SVG as a full-page background on these pages.
Place it as an absolutely positioned element behind all content with z-index: -1.
Set it to width: 100%, height: 100%, position: fixed so it covers the entire viewport.

```jsx
// BackgroundSVG.jsx — reusable component
const BackgroundSVG = () => (
  <div style={{
    position: 'fixed',
    top: 0, left: 0,
    width: '100%', height: '100%',
    zIndex: -1,
    overflow: 'hidden'
  }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 896 504" preserveAspectRatio="xMidYMid slice">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk&display=swap');
          text font-family: 'Space Grotesk', sans-serif;
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#000000" />
      <g>
        [PASTE FULL SVG CIRCLE ELEMENTS HERE FROM THE SVG FILE IN chegg-design/background.svg]
      </g>
    </svg>
  </div>
);
export default BackgroundSVG;
```

The full SVG file is saved at: client/public/images/ui/background.svg
Import and use BackgroundSVG component at the top of:
- LandingPage.jsx
- CreateRoom.jsx
- JoinRoom.jsx
- DeckBuilderPage.jsx
DO NOT use it in GamePage.jsx

**Game Page background:**
- Pure solid black: #000000
- No pattern, no texture, nothing at all
- Full black so board and UI elements pop visually

---

## COLOR PALETTE — USE THESE EXACT COLORS EVERYWHERE

| Color | Hex | Usage |
|---|---|---|
| Deep Purple | #50207A | Primary background, cards, panels |
| Light Lavender | #D6B9FC | Buttons, highlights, active elements, accents |
| Periwinkle Blue | #838CE5 | Secondary accents, hover states, borders |
| Pure Black | #000000 | Game page background ONLY |
| White | #FFFFFF | Primary text |
| Light Grey | #A0A0B0 | Secondary text, labels |

CRITICAL COLOR RULES:
- These 3 purple colors are the ENTIRE color identity of this app
- Do NOT use blue or navy anywhere
- Buttons = #D6B9FC with dark text OR outlined in #D6B9FC
- Hover states = #838CE5
- Backgrounds on non-game pages = #50207A with SVG dot pattern on top
- Game page background = #000000 pure black only, no purple at all
- Mana dots filled = #D6B9FC, empty = dark grey
- Blue spawn zone tint = #838CE5 overlay
- Red spawn zone tint = keep red for gameplay clarity
- Board dark squares: dark slate around #1e2130
- Board light squares: slightly lighter around #2a2f45
- Blue spawn zone rows A-B: blue tint overlay
- Red spawn zone rows I-J: red tint overlay
- Blue player accent: bright blue
- Red player accent: bright red
- Mana dots filled: bright blue. Empty: dark grey
- Text: white or light grey

Board:
- Column headers 1-8 at top
- Row headers A-J on left
- Subtle grid lines
- Minion pieces pixel art centered in cells
- Selected minion: bright border
- Movement squares: green semi-transparent overlay
- Attack squares: red semi-transparent overlay

Player Panels:
- Rounded rectangle
- Active player: colored border glow
- Inactive player: dim

Top Bar:
- CHEGG title top left
- Turn indicator center with colored dot and player name
- Turn number top right

Hand Display:
- Bottom center
- Small card icons with mana cost badge top right of each card
- Label YOUR HAND above cards
- Horizontal scroll if many cards

---

## WHAT DOES NOT EXIST — DO NOT BUILD

- Dash mechanic: REMOVED
- Save mana button: REMOVED
- Python backend: NOT USED
- Health points: does not exist, one hit eliminates
- Travel type label in UI: does not exist
- Range type label in UI: does not exist
- Type/Class label in UI: does not exist
- Immunities: does not exist
- Damaged By: does not exist
- Any minions beyond the 11 listed: does not exist
- Pig: REMOVED — peaceful mob, not in this game
- Opponent hand cards visible: NEVER
- Movement highlights visible to opponent: NEVER
- Countdown timer during normal gameplay: timer ONLY appears when opponent disconnects

---

## DEVELOPMENT ORDER

Build in this exact sequence:

1. Backend Express + Socket.io server skeleton
2. Backend MongoDB connection + Room model
3. Backend create_room and join_room handlers
4. Backend deck_confirmed handler
5. Backend GameState class (board, hands, mana, turn)
6. Backend TurnManager (switching, mana refresh, card draw)
7. Backend MovementCalculator for all 11 minions individually
8. Backend attack handler with friendly fire
9. Backend special ability handlers
10. Backend win condition detection
11. Backend reconnection with 60 second timeout
12. Frontend Landing page
13. Frontend Create and Join room pages
14. Frontend Deck builder with grid and popup
15. Frontend Game page layout
16. Frontend Board rendering with labels
17. Frontend Minion piece rendering
18. Frontend Click handler for your minion and highlights
19. Frontend Green and red highlight rendering
20. Frontend Move and attack click handlers
21. Frontend Hand display at bottom
22. Frontend Player panels with mana dots
23. Frontend Turn indicator
24. Frontend Board flip for Player 2
25. Frontend Rules panel
26. Frontend Minion popup modal
27. Frontend Disconnect UI and countdown
28. Frontend Win/lose screen
29. Deployment Vercel + Railway + MongoDB Atlas

---

## ENVIRONMENT VARIABLES

Frontend .env:
VITE_SOCKET_URL=https://your-railway-url.railway.app

Backend .env:
MONGODB_URI=mongodb+srv://your-atlas-connection-string
CLIENT_URL=https://your-vercel-url.vercel.app
PORT=3001

CORS on backend must allow CLIENT_URL.
Socket.io must be configured with CORS allowing Vercel URL.

---

## MONGODB SCHEMA

Room document:
{
  roomCode: "AX92KL",
  host: {
    username: "PlayerOne",
    socketId: "abc123",
    connected: true,
    deck: [...15 minion IDs...],
    hand: [...current hand...],
    deckRemaining: [...remaining cards...]
  },
  guest: {
    username: "PlayerTwo",
    socketId: "def456",
    connected: true,
    deck: [...],
    hand: [...],
    deckRemaining: [...]
  },
  gameState: {
    board: {},
    currentTurn: "host",
    turnNumber: 1,
    hostMana: 1,
    guestMana: 1,
    status: "playing"
  },
  createdAt: ISODate
}

---

## FINAL NOTES FOR AI — READ BEFORE WRITING ANY CODE

- Read this entire file before writing a single line of code
- Every minion has UNIQUE movement and attack logic, do not generalize
- Total minions = 11 (Villager, Zombie, Creeper, Skeleton, Blaze, Phantom, Iron Golem, Puffer-Fish, Enderman, Shulker-Box, Wither)
- Pig is REMOVED — do not add it
- Server is the SINGLE SOURCE OF TRUTH for all game state
- Never send opponent hand data to the wrong player socket ever
- Never send highlight data to the opponent ever
- Board is 8 columns (1-8) x 10 rows (A-J)
- Player 2 sees board flipped 180 degrees like chess.com
- Friendly fire exists for Creeper, Puffer-Fish, and Wither only
- Villager is NOT in deck, placed free at game start
- Minions spawned this turn cannot act until next turn
- No move AND attack in same turn, enforce this server-side
- Mana resets fully every turn, never carries over
- 60 second reconnection window before forfeit
- Match the uploaded screenshot UI reference exactly