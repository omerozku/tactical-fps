# SABLE CANYON — Round-Based Tactical FPS

[![make.fun badge](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun)

A tactical 5v5 round-based bomb defusal FPS built with Three.js for the make.fun threejs-fps-01 competition.

## Features
- **Round-Based Match**: CT vs T, bomb site A/B compound, buy phase, economy, win/loss rounds, first to 8 wins.
- **Gunplay**: Recoil patterns, movement spread, headshot multipliers, damage falloff, reloading, multiple weapons (Pistol, Rifle, Sniper, Shotgun) + smoke/frag grenades.
- **Tactics & AI**: Bot navigation routes, bomb plant/defuse timers, reactive combat, buy menu.
- **Engine**: Fixed 60Hz physics + render split, WebAudio procedural SFX, zero-allocation hot loops.

## Local Play & Build
```bash
node serve.ts
# or build dossier:
MAKEFUN_OUTPUT_DIR=out node main.ts
```
