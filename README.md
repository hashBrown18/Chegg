# Chegg

A real-time multiplayer strategy card game where players deploy Minecraft-themed minions on a grid battlefield, manage mana, and outmaneuver their opponent's Creeper eggs to win.

**Live app:** https://chegg-game.vercel.app

## What is this?

Chegg is a turn-based tactics game built on an 8x10 grid. Each player manages mana, deploys minions with unique movement and attack patterns (like the Shulker-Box, a defensive unit with a fixed cross-shaped attack range), and tries to break through to destroy the opponent's eggs.

You can play two ways:
- **Singleplayer** against an AI bot with three difficulty levels (Easy, Medium, Hard). The Hard bot uses a Minimax algorithm with Alpha-Beta pruning, running in a Web Worker so it doesn't freeze the UI while it thinks.
- **Multiplayer** against another player in real time.

## Tech stack

- **Frontend:** React + Vite, deployed on Vercel
- **Backend:** Node.js + Express + Socket.io for real-time game state sync, deployed on Railway
- **Database:** MongoDB Atlas
- **AI opponent:** Minimax with Alpha-Beta pruning (Hard mode), running in a Web Worker

## ⚠️ SINGLE-INSTANCE REQUIREMENT (Critical)

The backend **MUST run exactly ONE instance** (replica count = 1 on Railway/Render/Kubernetes).

**Why:** Game state and forfeit timers live in this process's memory. Running multiple instances will cause:
- Forfeit timers to fire on only one instance, leaving others stale
- Rejoin on another instance to fail (no in-memory gameState)
- Race conditions on finishGame()

Do NOT add Redis or other coordination — configure your host for 1 replica.

Run exactly one instance on Railway (replica count = 1). Multiple replicas break
forfeit timers, reconnection, and the atomic game-finish claim.

On startup the server logs:  
`[SINGLE-INSTANCE] CHEGG server MUST run with exactly 1 replica/process. Multiple instances will break forfeit timers and reconnection.`

## Known issues

- **Multiplayer has an active sync bug.** Real-time state between two connected players is currently unreliable and is being actively debugged. Singleplayer (vs the AI bot) is stable and fully playable — that's the recommended way to try the game right now.
- Opponent mana display can show incorrectly in some sessions.
- A few other minor UI/edge-case bugs are being tracked and fixed.

## How to play

1. Go to the live link above.
2. Choose Singleplayer and pick a bot difficulty.
3. Deploy minions using your mana, move and attack across the grid, and try to destroy the opponent's eggs before they destroy yours.
4. Check the in-app Rules panel for minion-specific movement and attack patterns.

## Status

Actively in development. Singleplayer AI, reconnection handling, and mobile layout are working. Multiplayer sync is the current priority fix.