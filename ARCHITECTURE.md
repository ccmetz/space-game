# Project architecture

Starbound is a browser game built with TypeScript, Three.js, React, and Vite.
Three.js renders the world and runs alongside the gameplay modules. React renders
the interface and subscribes to state owned by the game.

The current game supports character creation, station exploration, free flight, ship selection, navigation jumps, and world
discovery. Landing, planet exploration, resource gathering, quests, and progression
are planned features. The structure below describes the current implementation
and the conventions to follow as those features are added.

## Module ownership

| Location                     | Responsibility                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/main.tsx`               | Creates the game controller and mounts React in Strict Mode.                                                       |
| `src/game.ts`                | Connects the modules, owns session state and game actions, and coordinates the frame loop and runtime cleanup.     |
| `src/station/station.ts`     | Owns station layout, collision, walking input, crew dialogue, room state, rendering, and cleanup.                  |
| `src/character/model.ts`     | Builds the shared character model, hairstyles, facial features, and animation limbs for registration and gameplay. |
| `src/character/character.ts` | Owns character appearance and class catalogs, registration state, validation, and local storage.                   |
| `src/state.ts`               | Provides cached snapshots, change notifications, and subscription cleanup without importing React.                 |
| `src/ships/catalog.ts`       | Defines ship identities and paint schemes with stable IDs.                                                         |
| `src/ships/ship.ts`          | Builds ship models and owns shared materials, paint changes, model banking, and engine effects.                    |
| `src/ships/selection.ts`     | Owns draft and confirmed ship choices and browser storage.                                                         |
| `src/worlds/catalog.ts`      | Defines world identities, navigation descriptions, positions, sizes, and appearance settings.                      |
| `src/worlds/worlds.ts`       | Builds the world layout, tracks discovery, checks proximity, and animates planets.                                 |
| `src/worlds/planets.ts`      | Builds planet surfaces, shaders, atmospheres, and rings.                                                           |
| `src/flight/flight.ts`       | Owns speed, orientation, steering, trip distance, reset, jump, and surface-stop behavior.                          |
| `src/flight/input.ts`        | Reads keyboard input, accepts touch-control presses and releases, and handles focus loss.                          |
| `src/flight/camera.ts`       | Positions the follow camera and the ship-preview camera.                                                           |
| `src/flight/telemetry.ts`    | Reads simulation values into the snapshot displayed by the HUD.                                                    |
| `src/graphics/renderer.ts`   | Sets up the scene, renderer, lights, postprocessing, resizing, and graphics cleanup.                               |
| `src/graphics/sky.ts`        | Builds the seeded starfield and nebula and makes them follow the player.                                           |
| `src/graphics/glow.ts`       | Creates the glow texture shared by the sky, star, and ship engines.                                                |
| `src/ui/`                    | Contains React views, event handlers, focus management, and the root-element lookup helper.                        |
| `src/style.css`              | Styles the interface and its responsive layouts.                                                                   |

Keep behavior and its state together. For example, changing a ship's paint goes
through the ship module, which updates the shared materials and engine effects.
Callers work through module methods instead of reaching into individual meshes.

Behavior involving several modules belongs in `game.ts`. Entering ship preview,
for example, changes world visibility, lighting, model rotation, camera placement,
and session state. The controller coordinates these changes so the modules can
stay independent of one another.

## State and React

Game state has one authoritative owner. React reads snapshots and calls actions
on the game controller or selection module.

```text
Keyboard / React controls → game actions → owning game module
                                                ↓
React views ← useSyncExternalStore ← snapshot and notification
```

There are separate subscriptions:

- **Location and station:** the controller owns the station/flight scene choice; the station owns the current room, pause state, nearby crew, and dialogue.
- **Character:** name, appearance, class, registration confirmation, and storage status.
  The character module owns this data; React renders a rotatable 3D preview of the same model used in the station. Class
  specialties are narrative choices for now, without gameplay modifiers.

- **Session:** readiness, flight and pause state, ship-preview state, help,
  navigation target, notifications, and errors. The controller owns this state.
- **Ship selection:** the current ship and paint IDs. The selection module also
  keeps the last confirmed choice so cancelling a preview can restore it.
- **Telemetry:** speed, attitude, trip distance, boost/brake status, target
  distance, and discovery readouts. These values are derived from the simulation.

`createStore` returns the same snapshot until a value changes. An update replaces
the snapshot and notifies subscribers; updates with unchanged values do nothing.
Snapshots are shallow frozen. Replace changed nested values if they are introduced
later, and keep mutable Three.js objects in their owning runtime modules.

React uses `useSyncExternalStore` to read these snapshots. Its subscription cleanup
removes listeners when views unmount. Separate telemetry subscriptions let the HUD
update without rerendering the menus at the same rate.

Use React-local state for view-only details such as a selected tab or search text.
`App.tsx` owns the interface theme preference, saves it in browser storage, and
applies it to the root element so menus and flight instruments share one palette.
Inventory contents, quest progress, and other gameplay data should belong to their
game modules and be exposed through snapshots and actions as those systems arrive.

Ship choices are saved only when confirmed. Storage failures leave selection
usable for the current session. World discovery and flight progress currently
reset when the runtime restarts or the page reloads.

## Rendering and lifecycle

`App.tsx` shows character registration first, prefilled with the last saved character.
Confirming registration mounts `Station`, which owns its canvas and starts the player in their quarters.
The station has an enclosed circular promenade with four radial passages leading to furnished rooms.
Its floor footprint and furniture bounds control collision; crew and objects offer nearby interactions.
A bunk, welcome terminal, navigation table, dispenser, and shuttle boarding point are usable.
Keyboard and touch movement follow camera direction. Dragging the canvas or using Q/R rotates the camera.
Interacting with the nearby shuttle boarding point switches to `FlightApp` and the existing ship selection/flight flow.
The flight introduction can return to the station. Each scene unmount cleans up its own runtime.
Station position and conversations reset when leaving the scene or reloading.
The station uses a third-person orbit camera with raycast obstruction checks against walls, ceilings, and furniture.
Its frame loop animates walking and crew, checks interaction reach, and publishes map/room snapshots ten times a second.
Station labels own canvas textures, which are disposed alongside input listeners and graphics on cleanup.
Character registration renders its shared character model on demand when appearance, rotation, or size changes.
Its preview owns and disposes its renderer, resize observer, model resources, and pointer listeners.
Returning to character editing unmounts flight and cleans up its runtime.
Character choices persist only on confirmation; blocked storage keeps them usable
for the current session and displays a warning in the flight menu.

`FlightApp` Its effect calls `game.start` and returns the
cleanup function provided by the controller. This pairs every runtime start with
cleanup during unmounts, Strict Mode development remounts, and Fast Refresh.

Each frame follows this sequence:

1. Read input and cap elapsed time at 0.05 seconds after a slow frame.
2. During active flight, update movement, check discovery and surface limits,
   and move the sky and follow camera.
3. When unpaused, animate planets, the ship preview, and engine effects.
4. Project the selected target into screen coordinates.
5. Publish HUD telemetry about ten times a second during flight.
6. Render the scene with postprocessing. Reveal the interface after the first frame.

Movement, camera transforms, and scene animation remain in the Three.js loop.
The target marker moves every frame through a React ref supplied by the interface.
This keeps the marker smooth without publishing every frame to React state.

The worlds module owns discovery and proximity calculations. The controller passes
surface contacts to flight, which repositions the ship and stops it. This keeps
world knowledge with worlds and movement responses with flight.

Runtime cleanup stops the render loop, removes window and canvas listeners,
disposes input handlers, clears notification timers, unsubscribes from selection,
and releases scene geometry, materials, postprocessing resources, and the shared
glow texture. Shared geometry and materials are disposed once per cleanup.

## Conventions for changes

- Organize code by gameplay feature and keep each module's state private to its
  implementation where possible.
- Use stable ship, paint, and world IDs across catalogs, controls, and storage.
- Keep React imports and DOM rendering in `ui/` and the application entry point.
  Browser input and graphics setup remain in their dedicated modules.
- Use Three.js types directly where they make the implementation clear.
- Extract shared helpers when there is real reuse. Keep feature-specific logic
  beside the feature that owns it.
- Add future gameplay modules when implementing their behavior, following the
  same ownership and subscription model.

## Tests and verification

Vitest uses the shared Vite configuration and currently runs in a Node environment.
Keep tests for one module beside that module, with the same base filename and a
`.test.ts` or `.test.tsx` suffix. Keep general tests and scenarios involving several
modules in `tests/`; `tests/exploration.test.ts` exercises discovery and flight's
response to surface contact together.

Test important behavior through module methods. Preserve coverage of flight,
selection confirmation and cancellation, storage failures, snapshot subscriptions,
and input cleanup. UI tests should focus on user-visible behavior.

Use `npm test` for one run and `npm run test:watch` during development. The full
verification commands are listed in [AGENTS.md](AGENTS.md). TypeScript checks both
application code and tests.
