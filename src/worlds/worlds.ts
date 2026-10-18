import * as THREE from 'three';
import type { Glow } from '../graphics/glow.ts';
import { createPlanet } from './planets.ts';

export interface World {
  readonly id: string;
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

  function planet(
    id: string,
    name: string,
    position: THREE.Vector3,
    radius: number,
    base: string,
    detail: string,
    kind: number,
  ) {
    const body = createPlanet(position, radius, base, detail, kind);
    object.add(body.object);
    planets.push(body);
    worlds.push({ id, name, position, radius, discovered: false });
  }

  planet('pelagos', 'Pelagos', new THREE.Vector3(330, 135, -720), 195, '#17495b', '#739c87', 0);
  planet('cinder', 'Cinder', new THREE.Vector3(1100, -170, -1900), 145, '#8c5137', '#c6a77b', 1);
  planet('aurelia', 'Aurelia', new THREE.Vector3(-1250, -180, -2400), 225, '#82725e', '#d4bea1', 2);
  const sunPosition = new THREE.Vector3(-850, 380, -1900);
  const sun = new THREE.Group();
  sun.position.copy(sunPosition);
  sun.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(120, 48, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.1) }),
    ),
  );
  sun.add(glow('#ffcc80', 1100, 0.55));
  object.add(sun);
  worlds.push({
    id: 'solace',
    name: 'Solace',
    position: sunPosition,
    radius: 120,
    discovered: false,
  });
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
    getTarget(id: string) {
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
