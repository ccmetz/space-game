# Starbound

A small, open-ended space flight game built with Three.js, TypeScript, and Vite.
Fly an X-wing-inspired starfighter past three planets and a star. No missions or
combat yet — just a place to explore.

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

## Controls

| Key | Action |
| --- | --- |
| W / S | Pitch up / down |
| A / D | Turn left / right |
| Q / E | Roll left / right |
| Shift | Hold to boost |
| Space | Hold to brake |
| P / Escape | Pause / resume |
| R | Return to starting coordinates |
| ? | Show / hide controls |

Choose a world in Navigation, then use **Jump to vicinity** to get there quickly.
Worlds are discovered when you fly close. Planet and star surfaces gently stop
your ship; turn away to keep exploring. Touch controls appear on small screens.
Flight automatically pauses when the window loses focus.

The ship, planets, atmosphere, starfield, and engine glow are generated in code.
The interface uses Google Fonts with local system font fallbacks. Exploration
progress is kept for the current session and resets on reload.
