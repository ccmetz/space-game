import * as THREE from 'three';
import { createStation } from './station/station.ts';
import { createCharacter } from './character/character.ts';
import { createCameraController } from './flight/camera.ts';
import { createFlight } from './flight/flight.ts';
import { createInput, type InputCommand } from './flight/input.ts';
import { initialTelemetry, readTelemetry } from './flight/telemetry.ts';
import { createGlow } from './graphics/glow.ts';
import { createRenderer } from './graphics/renderer.ts';
import { createSky } from './graphics/sky.ts';
import { createShip } from './ships/ship.ts';
import { createShipSelection } from './ships/selection.ts';
import { createStore } from './state.ts';
import { createWorlds } from './worlds/worlds.ts';
import type { WorldId } from './worlds/catalog.ts';

export interface Session {
  ready: boolean;
  started: boolean;
  paused: boolean;
  choosingShip: boolean;
  helpVisible: boolean;
  targetId: WorldId;
  notice: string;
  error: string | null;
}

export interface TargetMarker {
  hidden: boolean;
  x: number;
  y: number;
}

interface GameRuntime {
  launch: () => void;
  clearInput: () => void;
  setPreview: (active: boolean) => void;
  reset: (started: boolean) => void;
  jump: (id: WorldId) => string;
  press: (key: string) => void;
  release: (key: string) => void;
}

const initialSession: Session = {
  ready: false,
  started: false,
  paused: false,
  choosingShip: false,
  helpVisible: false,
  targetId: 'pelagos',
  notice: '',
  error: null,
};

export function createGame() {
  const location = createStore<{ scene: 'station' | 'flight' }>({ scene: 'station' });
  const station = createStation(() => location.update({ scene: 'flight' }));
  const session = createStore(initialSession);
  const telemetry = createStore(initialTelemetry);
  const selection = createShipSelection();
  const character = createCharacter();
  let runtime: GameRuntime | null = null;
  let stop: (() => void) | null = null;
  let noticeTimeout: ReturnType<typeof setTimeout> | undefined;

  function notify(message: string) {
    session.update({ notice: message });
    clearTimeout(noticeTimeout);
    noticeTimeout = setTimeout(() => session.update({ notice: '' }), 4000);
  }

  function launch() {
    if (!runtime || session.getSnapshot().started) return;
    runtime.launch();
    session.update({ started: true, helpVisible: false });
    notify('Welcome aboard. WASD to steer · Shift to boost · Space to brake.');
  }

  function setPaused(paused: boolean) {
    if (!session.getSnapshot().started) return;
    runtime?.clearInput();
    session.update({ paused });
  }

  function openShipSelection() {
    if (!runtime || session.getSnapshot().started) return;
    // Clear the planets from the preview and light the hull so the ship is the focus.
    runtime.setPreview(true);
    session.update({ choosingShip: true, helpVisible: false });
  }

  function closeShipSelection(confirm: boolean) {
    if (!session.getSnapshot().choosingShip) return;
    if (confirm) selection.confirm();
    else selection.cancel();
    runtime?.setPreview(false);
    session.update({ choosingShip: false });
  }

  function reset() {
    runtime?.reset(session.getSnapshot().started);
    notify('Returned to your starting coordinates.');
  }

  function jump() {
    if (!runtime) return;
    launch();
    setPaused(false);
    const name = runtime.jump(session.getSnapshot().targetId);
    notify(`Jump complete. Approaching ${name}.`);
  }

  function toggleHelp() {
    session.update({ helpVisible: !session.getSnapshot().helpVisible });
  }

  function handleCommand(command: InputCommand) {
    const state = session.getSnapshot();
    if (command === 'escape') {
      if (state.helpVisible) session.update({ helpVisible: false });
      else if (state.choosingShip) closeShipSelection(false);
      else setPaused(!state.paused);
    } else if (command === 'pause') setPaused(!state.paused);
    else if (command === 'help') toggleHelp();
    else if (command === 'reset') reset();
  }

  function start(canvas: HTMLCanvasElement, updateMarker: (marker: TargetMarker) => void) {
    stop?.();
    selection.cancel();
    session.update(initialSession);
    telemetry.update(initialTelemetry);
    const events = new AbortController();
    let graphics: ReturnType<typeof createRenderer> | undefined;
    let glow: ReturnType<typeof createGlow> | undefined;
    let input: ReturnType<typeof createInput> | undefined;
    let unsubscribeSelection: (() => void) | undefined;
    let disposed = false;

    function dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      clearTimeout(noticeTimeout);
      unsubscribeSelection?.();
      input?.dispose();
      graphics?.dispose();
      glow?.dispose();
      runtime = null;
      stop = null;
    }
    stop = dispose;

    try {
      const renderer = createRenderer(canvas);
      graphics = renderer;
      glow = createGlow();
      const sky = createSky(glow.createSprite);
      renderer.scene.add(sky.object);
      const worlds = createWorlds(glow.createSprite);
      renderer.scene.add(worlds.object);
      const ship = createShip(glow.createSprite);
      renderer.scene.add(ship.object);
      const flight = createFlight(ship.object);
      const camera = createCameraController(renderer.camera, ship.object);
      const controls = createInput({
        hasStarted: () => session.getSnapshot().started,
        canFly: () => {
          const state = session.getSnapshot();
          return state.started && !state.paused;
        },
        isPreviewing: () => session.getSnapshot().choosingShip,
        onCommand: handleCommand,
        onFocusLost: () => setPaused(true),
      });
      input = controls;
      const applySelection = () => ship.setSelection(selection.getSnapshot());
      applySelection();
      unsubscribeSelection = selection.subscribe(applySelection);
      camera.place(true, 0, false);

      runtime = {
        launch: () => flight.launch(),
        clearInput: controls.clear,
        // Preview changes several parts of the scene, so coordinate it here instead of
        // making the ship, worlds, camera and menus reach into each other's state.
        setPreview(active) {
          worlds.setVisible(!active);
          renderer.setPreview(active);
          ship.setPreview(active);
          camera.place(true, 0, active);
        },
        reset(started) {
          flight.reset(started);
          ship.setBank(flight.bank);
          controls.clear();
          camera.place(true, 0, session.getSnapshot().choosingShip);
        },
        jump(id) {
          const target = worlds.getTarget(id);
          flight.jump(target);
          camera.place(true, 0, false);
          return target.name;
        },
        press: controls.press,
        release: controls.release,
      };

      window.addEventListener(
        'resize',
        () => {
          renderer.resize();
          if (session.getSnapshot().choosingShip) camera.place(true, 0, true);
        },
        { signal: events.signal },
      );
      canvas.addEventListener(
        'webglcontextlost',
        (event) => {
          event.preventDefault();
          setPaused(true);
          session.update({
            error:
              'The graphics connection was interrupted. Reload the page to restart your flight.',
          });
        },
        { signal: events.signal },
      );

      let lastTime = 0;
      let hudElapsed = 0;
      let firstFrameRendered = false;
      const markerPosition = new THREE.Vector3();
      const cameraDirection = new THREE.Vector3();
      const separation = new THREE.Vector3();

      renderer.setAnimationLoop((time) => {
        // Cap elapsed time after a slow frame so the ship cannot jump through a planet.
        const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
        lastTime = time;
        const state = session.getSnapshot();
        const keys = controls.read();
        const target = worlds.getTarget(state.targetId);
        if (state.started && !state.paused) {
          flight.update(dt, keys);
          ship.setBank(flight.bank);
          worlds.checkProximity(
            ship.object.position,
            (world) => {
              notify(`${world.name} discovered.`);
            },
            (world, direction) => {
              flight.stopAtSurface(world, direction);
              notify(`${world.name} proximity limit. Turn away to continue exploring.`);
            },
          );
          sky.follow(ship.object.position);
          camera.place(false, dt, state.choosingShip);
        }
        if (!state.paused) {
          worlds.update(dt);
          const enginePower = state.started ? (keys.braking ? 0.3 : keys.boosting ? 1.8 : 1) : 0.65;
          ship.update(dt, time, enginePower, state.choosingShip);
        }

        markerPosition.copy(target.position).project(renderer.camera);
        renderer.camera.getWorldDirection(cameraDirection);
        separation.subVectors(target.position, renderer.camera.position);
        updateMarker({
          hidden:
            cameraDirection.dot(separation) <= 0 ||
            Math.abs(markerPosition.x) > 0.93 ||
            Math.abs(markerPosition.y) > 0.75,
          x: (markerPosition.x * 0.5 + 0.5) * innerWidth,
          y: (-markerPosition.y * 0.5 + 0.5) * innerHeight,
        });
        // Publish readouts ten times a second; movement and rendering keep their own pace.
        hudElapsed += dt;
        if (hudElapsed > 0.1 || !state.started) {
          hudElapsed = 0;
          telemetry.update(
            readTelemetry(flight, keys, ship.object.position, target, worlds.discoveredCount),
          );
        }
        renderer.render();
        // Show the interface only after the canvas has its first frame.
        if (!firstFrameRendered) {
          session.update({ ready: true });
          firstFrameRendered = true;
        }
      });
    } catch (cause) {
      dispose();
      session.update({
        ready: true,
        error: `Unable to start the flight. Please use a browser with WebGL 2 and hardware acceleration enabled. ${String(cause)}`,
      });
    }
    return dispose;
  }

  return {
    station,
    location: { getSnapshot: location.getSnapshot, subscribe: location.subscribe },
    boardShip: () => {
      if (station.getSnapshot().canBoard && !station.getSnapshot().paused)
        location.update({ scene: 'flight' });
    },
    returnToStation: () => location.update({ scene: 'station' }),
    session: { getSnapshot: session.getSnapshot, subscribe: session.subscribe },
    telemetry: { getSnapshot: telemetry.getSnapshot, subscribe: telemetry.subscribe },
    selection,
    character,
    start,
    launch,
    openShipSelection,
    closeShipSelection,
    toggleHelp,
    hideHelp: () => session.update({ helpVisible: false }),
    togglePause: () => setPaused(!session.getSnapshot().paused),
    resume: () => setPaused(false),
    selectTarget: (targetId: WorldId) => session.update({ targetId }),
    jump,
    pressControl: (key: string) => runtime?.press(key),
    releaseControl: (key: string) => runtime?.release(key),
  };
}

export type Game = ReturnType<typeof createGame>;
