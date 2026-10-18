import { createCameraController } from './flight/camera.ts';
import { createFlight } from './flight/flight.ts';
import { createInput, type InputCommand } from './flight/input.ts';
import { createGlow } from './graphics/glow.ts';
import { createRenderer } from './graphics/renderer.ts';
import { createSky } from './graphics/sky.ts';
import { createShip } from './ships/ship.ts';
import { createHud } from './ui/hud.ts';
import { createMenus } from './ui/menus.ts';
import { createShipSelection } from './ui/ship-selection.ts';
import { createWorlds } from './worlds/worlds.ts';

export function startGame(canvas: HTMLCanvasElement) {
  const graphics = createRenderer(canvas);
  const glow = createGlow();
  const sky = createSky(glow);
  const worlds = createWorlds(glow);
  const ship = createShip(glow);
  graphics.scene.add(sky.object, worlds.object, ship.object);
  const flight = createFlight(ship.object);
  const camera = createCameraController(graphics.camera, ship.object);
  let started = false;
  let paused = false;
  let choosingShip = false;
  let target = worlds.getTarget('pelagos');
  let lastTime = 0;
  let firstFrameRendered = false;

  const menus = createMenus({
    onLaunch: launch,
    onChooseShip: openShipSelection,
    onTogglePause: () => setPaused(!paused),
    onResume: () => setPaused(false),
  });
  const selection = createShipSelection({
    onChange: (choice) => ship.setSelection(choice),
    onClose: closeShipSelection,
  });
  const hud = createHud(
    ship.object,
    graphics.camera,
    (id) => {
      target = worlds.getTarget(id);
      hud.setTarget(target);
    },
    jump,
  );
  hud.setTarget(target);
  const input = createInput({
    hasStarted: () => started,
    canFly: () => started && !paused,
    isPreviewing: () => choosingShip,
    onCommand: handleCommand,
    onFocusLost: () => setPaused(true),
  });
  camera.place(true, 0, false);

  function launch() {
    if (started) return;
    started = true;
    flight.launch();
    menus.launch();
    menus.notify('Welcome aboard. WASD to steer · Shift to boost · Space to brake.');
  }

  function setPaused(value: boolean) {
    if (!started) return;
    paused = value;
    input.clear();
    menus.setPaused(paused);
  }

  // Preview changes several parts of the scene, so coordinate it here instead of
  // making the ship, worlds, camera and menus reach into each other's state.
  function setPreview(active: boolean) {
    choosingShip = active;
    worlds.setVisible(!active);
    graphics.setPreview(active);
    menus.setPreview(active);
    ship.setPreview(active);
    camera.place(true, 0, active);
  }

  function openShipSelection() {
    if (started) return;
    // Clear the planets from the preview and light the hull so the ship is the focus.
    setPreview(true);
    selection.open();
  }

  function closeShipSelection(confirm: boolean) {
    setPreview(false);
    selection.close(confirm);
  }

  function reset() {
    flight.reset(started);
    ship.setBank(flight.bank);
    input.clear();
    camera.place(true, 0, choosingShip);
    menus.notify('Returned to your starting coordinates.');
  }

  function jump() {
    launch();
    setPaused(false);
    flight.jump(target);
    camera.place(true, 0, choosingShip);
    menus.notify(`Jump complete. Approaching ${target.name}.`);
  }

  function handleCommand(command: InputCommand) {
    if (command === 'escape') {
      if (menus.helpVisible) menus.hideHelp();
      else if (choosingShip) closeShipSelection(false);
      else setPaused(!paused);
    } else if (command === 'pause') setPaused(!paused);
    else if (command === 'help') menus.toggleHelp();
    else if (command === 'reset') reset();
  }

  window.addEventListener('resize', () => {
    graphics.resize();
    if (choosingShip) camera.place(true, 0, true);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    setPaused(true);
    menus.showGraphicsError();
  });

  graphics.setAnimationLoop((time) => {
    // Cap elapsed time after a slow frame so the ship cannot jump through a planet.
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    const controls = input.read();
    if (started && !paused) {
      flight.update(dt, controls);
      ship.setBank(flight.bank);
      worlds.checkProximity(
        ship.object.position,
        (world) => {
          menus.notify(`${world.name} discovered.`);
        },
        (world, direction) => {
          flight.stopAtSurface(world, direction);
          menus.notify(`${world.name} proximity limit. Turn away to continue exploring.`);
        },
      );
      sky.follow(ship.object.position);
      camera.place(false, dt, choosingShip);
    }
    if (!paused) {
      worlds.update(dt);
      const enginePower = started ? (controls.braking ? 0.3 : controls.boosting ? 1.8 : 1) : 0.65;
      ship.update(dt, time, enginePower, choosingShip);
    }
    hud.update({
      dt,
      started,
      paused,
      controls,
      flight,
      target,
      discoveredCount: worlds.discoveredCount,
    });
    graphics.render();
    // Show the interface only after the canvas has its first frame.
    if (!firstFrameRendered) {
      menus.show();
      firstFrameRendered = true;
    }
  });
}
