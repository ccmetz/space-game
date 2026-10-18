# Starbound (working title)

> **Disclaimer**: The development of this game will be heavily AI-assisted. Mostly just a fun side project.

## Game Description

A small, open-ended space flight game built with Three.js, React, TypeScript, and Vite.
Choose a starfighter, interceptor, or explorer and fly past three planets and a
star. No missions or combat yet — just a place to explore.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. A browser with WebGL 2 support and hardware
acceleration is required. To check types and create a production build:

```sh
npm run build
```

Lint with `npm run lint`, format with `npm run format`, or check formatting
without changing files with `npm run format:check`.

Before beginning flight, open **Choose Ship** to preview the Pathfinder
starfighter, Arrow interceptor, or Atlas explorer. Each has Ivory, Graphite,
Cobalt, and Crimson paint schemes. **Use This Ship** confirms your selection;
**Back** or Escape restores your previous choice. Confirmed choices are saved
in this browser when browser storage is available. All ships share the same
flight controls and handling for now.

## Controls

| Key        | Action                         |
| ---------- | ------------------------------ |
| W / S      | Pitch up / down                |
| A / D      | Turn left / right              |
| Q / E      | Roll left / right              |
| Shift      | Hold to boost                  |
| Space      | Hold to brake                  |
| P / Escape | Pause / resume                 |
| R          | Return to starting coordinates |
| ?          | Show / hide controls           |

Choose a world in Navigation, then use **Jump to vicinity** to get there quickly.
Worlds are discovered when you fly close. Planet and star surfaces gently stop
your ship; turn away to keep exploring. Touch controls appear on small screens.
Flight automatically pauses when the window loses focus.

The ship, planets, atmosphere, starfield, and engine glow are generated in code.
The interface uses Google Fonts with local system font fallbacks. Exploration
progress is kept for the current session and resets on reload.

## Project structure

- `src/main.tsx` mounts the React interface in Strict Mode.
- `src/game.ts` connects the modules, owns game state, and runs the Three.js frame loop.
- `src/ships/` owns ship definitions, selection/persistence, models, paint materials, and engine effects.
- `src/worlds/` builds planets and the star, animates surfaces, and tracks discovery and proximity.
- `src/flight/` owns movement, keyboard/touch input, and follow/preview cameras.
- `src/graphics/` sets up rendering, lights, the sky, and shared glow resources.
- `src/ui/` contains the React menus, HUD, navigation, ship selection, and touch controls.
- `src/state.ts` provides immutable snapshots and subscriptions for the game and interface.

Modules keep their own state. `game.ts` coordinates behavior that affects several
modules, such as entering the ship preview or stopping flight near a surface.
Ship, paint, and world controls use stable IDs instead of array positions.

React reads game-owned snapshots with `useSyncExternalStore` and calls game actions
from event handlers. Session state, HUD telemetry, and ship selection have separate
subscriptions, so instrument updates do not rerender the menus. Ship transforms,
camera motion, and animations stay in Three.js. HUD readouts update about ten times
a second; the target marker moves through a React ref every frame.

The canvas starts in a React effect. Cleanup stops the render loop, removes input
and window listeners, clears notification timers, and disposes graphics resources.
This supports Strict Mode remounts and Vite Fast Refresh without duplicate games.
