import * as THREE from 'three';
import type { Glow } from '../graphics/glow.ts';
import { createPlanet } from './planets.ts';
import { worldDefinitions, type WorldId } from './catalog.ts';

export interface World {
  readonly id: WorldId;
  readonly name: string;
  readonly position: THREE.Vector3;
  readonly radius: number;
  discovered: boolean;
}

export function createWorlds(glow: Glow) {
  const object = new THREE.Group();
  const worlds: World[] = [];
  const planets: ReturnType<typeof createPlanet>[] = [];
  const separation = new THREE.Vector3();

  for (const definition of worldDefinitions) {
    const position = new THREE.Vector3(...definition.position);
    if (definition.kind === 'star') {
      const sun = new THREE.Group();
      sun.position.copy(position);
      sun.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(definition.radius, 48, 40),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.1) }),
        ),
      );
      sun.add(glow('#ffcc80', 1100, 0.55));
      object.add(sun);
    } else {
      const body = createPlanet(
        position,
        definition.radius,
        definition.base,
        definition.detail,
        definition.kind,
      );
      object.add(body.object);
      planets.push(body);
    }
    worlds.push({
      id: definition.id,
      name: definition.name,
      position,
      radius: definition.radius,
      discovered: false,
    });
  }
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(31, 32, 24),
    new THREE.MeshStandardMaterial({ color: '#7b838a', roughness: 1 }),
  );
  moon.position.set(70, 255, -830);
  object.add(moon);

  return {
    object,
    get discoveredCount() {
      return worlds.filter((world) => world.discovered).length;
    },
    getTarget(id: WorldId) {
      const target = worlds.find((world) => world.id === id);
      if (!target) throw new Error(`Unknown world: ${id}`);
      return target;
    },
    setVisible(visible: boolean) {
      object.visible = visible;
    },
    update(dt: number) {
      planets.forEach((planet) => planet.update(dt));
    },
    // Discovery and surface limits use the same distance, so keep both rules together.
    checkProximity(
      position: THREE.Vector3,
      onDiscovered: (world: World) => void,
      onSurface: (world: World, direction: THREE.Vector3) => void,
    ) {
      for (const world of worlds) {
        separation.subVectors(position, world.position);
        const gap = separation.length() - world.radius;
        if (gap < world.radius * 1.4 && !world.discovered) {
          world.discovered = true;
          onDiscovered(world);
        }
        if (gap < 12) {
          if (separation.lengthSq() < 0.001) separation.set(0, 0, 1);
          onSurface(world, separation.normalize());
        }
      }
    },
  };
}
