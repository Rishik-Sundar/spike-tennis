# 🎾 Spike Tennis

A fast-paced, visually polished Roblox tennis game inspired by Neo Tennis. Two players, one court, no shops — just pure tennis mechanics.

## Features
- Full tennis scoring (15, 30, 40, Deuce, Advantage, Games, Sets, Match)
- Shot types: Flat, Topspin, Slice, Lob, Smash, Serve
- Timing-based hit system with visual ring indicator
- Neon ball with trail, bounce spark effects
- Post-processing graphics (Bloom, SunRays, Atmosphere, ColorCorrection)
- Glowing court with neon edge trim
- Smooth third-person camera that tracks the ball
- Mobile + PC input support
- 2-player multiplayer

## Controls

| Input | Action |
|-------|--------|
| WASD | Move |
| Left Shift | Sprint |
| Click / Space | Hit / Serve |
| Q (hold) | Topspin |
| E (hold) | Slice |
| R (hold) | Lob |
| F (hold) | Smash |

## Scoring
- Points: 0 → 15 → 30 → 40 → Game
- Both at 40? → **Deuce** → Win 2 consecutive → **Game**
- First to 6 games (lead by 2) = **Set**
- Best of 3 sets = **Match**

## Setup with Rojo

1. Install [Rojo](https://rojo.space/) (v7+)
2. Install the Rojo Roblox Studio plugin
3. Clone this repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/spike-tennis
   cd spike-tennis
   ```
4. Run the Rojo dev server:
   ```bash
   rojo serve
   ```
5. Open Roblox Studio → click **Rojo** plugin → **Connect**
6. Hit **Play** in Studio to test

## Manual Setup (no Rojo)

1. Open Roblox Studio with a blank baseplate
2. Copy each `.lua` file into the matching service manually:
   - `src/ServerScriptService/*.server.lua` → ServerScriptService
   - `src/ReplicatedStorage/Modules/*.lua` → ReplicatedStorage > Modules (ModuleScripts)
   - `src/StarterPlayerScripts/*.client.lua` → StarterPlayer > StarterPlayerScripts
   - `src/StarterCharacterScripts/*.client.lua` → StarterPlayer > StarterCharacterScripts
3. Create a **Folder** named `Remotes` inside ReplicatedStorage
4. Create a **Folder** named `Modules` inside ReplicatedStorage
5. Play!

## File Structure

```
spike-tennis/
├── default.project.json          Rojo project config
└── src/
    ├── ServerScriptService/
    │   ├── CourtBuilder.server.lua   Builds the court, net, lights, post-FX
    │   ├── BallController.server.lua Ball physics, bounces, trail, sparks
    │   ├── GameManager.server.lua    State machine, hit/serve validation
    │   └── MatchManager.server.lua   Score tracking, events
    ├── ReplicatedStorage/Modules/
    │   ├── Constants.lua             All tunable values
    │   ├── ShotPhysics.lua           Trajectory solver, bounce physics
    │   └── TennisScoring.lua         Scoring module (points/games/sets)
    ├── StarterPlayerScripts/
    │   ├── PlayerController.client.lua Input, aiming, shot selection
    │   └── UIController.client.lua    HUD, scoreboard, timing ring, messages
    └── StarterCharacterScripts/
        └── CameraController.client.lua Smooth tracking camera
```
