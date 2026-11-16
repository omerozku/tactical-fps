# SABLE CANYON - Round-Based Tactical FPS

[![make.fun badge](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun)
[![rank badge](https://make.fun/badge/threejs-fps-02/omerozku/tactical-fps/rank.svg)](https://make.fun)
[![reward badge](https://make.fun/badge/threejs-fps-02/omerozku/tactical-fps/reward.svg)](https://make.fun)

A tactical 5v5 round-based bomb defusal FPS built with Three.js for the make.fun threejs-fps-02 competition.

Command the Canyon Guard across Foundry 07. Hold sites A and B, break the Ashen Hand assault, manage a round economy, and defuse the charge before it detonates.

## Features

- **Round-based 5v5**: five Ashen Hand attackers against four Canyon Guard bot teammates plus the player. First to 8 rounds wins, with a 15-round cap.
- **Bomb defusal**: attackers plant at site A or B; defenders secure the site or defuse before the 40-second fuse expires.
- **Buy phase and economy**: spend credits on pistol, rifle, sniper, shotgun, kevlar, and frag charges. Survive to keep your loadout; losses build a bonus.
- **Gunplay**: per-weapon recoil and spread, movement and airborne accuracy penalties, headshots, falloff, reloads, ADS scope, and hit feedback.
- **Bot tactics**: route selection, site holds, sight and field-of-view checks, hearing, combat strafing, burst fire, carrier transfers, plants, defuses, and post-plant defense.
- **HUD and feedback**: live scoreboard, timers, bomb state, killfeed, minimap, buy grid, objective prompts, hitmarkers, damage direction, and round banners.
- **Self-contained**: static ES modules, vendored Three.js, procedural WebAudio effects, no external assets or network requests.

## Controls

| Input | Action |
| --- | --- |
| `WASD` | Move |
| Mouse | Aim |
| Left mouse | Fire |
| Right mouse | Scope with the sniper |
| `R` | Reload |
| `Ctrl` | Crouch |
| `Shift` | Walk |
| `Space` | Jump |
| `G` | Throw frag charge |
| `E` | Defuse the charge |
| `B` | Open or close the buy menu |
| `1`-`4` | Select a weapon |
| `M` | Mute audio |

## Local Play And Build

```bash
node serve.ts
```

Open `http://localhost:8080/`.

Build the submission dossier:

```bash
# Linux / macOS
MAKEFUN_OUTPUT_DIR=out node main.ts

# Windows PowerShell
$env:MAKEFUN_OUTPUT_DIR="out"; node main.ts
```
