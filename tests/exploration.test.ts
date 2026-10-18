import { expect, test } from 'vitest';
import * as THREE from 'three';
import { createFlight } from '../src/flight/flight.ts';
import type { WorldId } from '../src/worlds/catalog.ts';
import { createWorlds } from '../src/worlds/worlds.ts';

test('proximity discovers each world once and stops flight outside planet and star surfaces', () => {
  const ship = new THREE.Group();
  const flight = createFlight(ship);
  const worlds = createWorlds(() => new THREE.Sprite());
  const discoveries: WorldId[] = [];
  const limits: WorldId[] = [];
  const inspect = () =>
    worlds.checkProximity(
      ship.position,
      (world) => {
        discoveries.push(world.id);
      },
      (world, direction) => {
        limits.push(world.id);
        flight.stopAtSurface(world, direction);
      },
    );

  for (const id of ['pelagos', 'solace'] as const) {
    const target = worlds.getTarget(id);
    flight.launch();
    // Exact center exercises the fallback direction as well as ordinary surface contact.
    ship.position.copy(target.position);
    inspect();
    expect(Math.abs(ship.position.distanceTo(target.position) - target.radius - 12)).toBeLessThan(
      0.000001,
    );
    expect(flight.speed).toBe(0);
    inspect();
  }
  expect(discoveries).toStrictEqual(['pelagos', 'solace']);
  expect(limits).toStrictEqual(['pelagos', 'solace']);
  expect(worlds.discoveredCount).toBe(2);
});
