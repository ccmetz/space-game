import * as THREE from 'three';
import type { Glow } from './glow.ts';

export function createSky(glow: Glow) {
  const object = new THREE.Group();
  // A seeded sky stays the same after refresh and keeps the scene easy to reproduce.
  let seed = 74021;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  const starPositions: number[] = [];
  const starColors: number[] = [];
  for (let i = 0; i < 6500; i++) {
    const direction = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
    direction.multiplyScalar(11000 + random() * 5000);
    starPositions.push(direction.x, direction.y, direction.z);
    const shade = new THREE.Color().setHSL(
      0.52 + random() * 0.15,
      random() * 0.28,
      0.35 + random() * 0.65,
    );
    starColors.push(shade.r, shade.g, shade.b);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 11,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  object.add(stars);

  // Soft clouds give the sky depth without downloading textures or hiding the stars.
  const nebula = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const cloud = glow(i % 3 === 0 ? '#62659c' : '#24566e', 5000 + random() * 4000, 0.025);
    cloud.position.set(-6500 + random() * 13000, 1600 + random() * 1500, -9500 - random() * 2000);
    nebula.add(cloud);
  }
  object.add(nebula);
  for (let i = 0; i < 35; i++) {
    const bright = glow(i % 4 === 0 ? '#f5d2b0' : '#d0e8ff', 40 + random() * 65, 0.8);
    bright.position.set(
      (random() - 0.5) * 15000,
      (random() - 0.5) * 10000,
      -6500 - random() * 3000,
    );
    stars.add(bright);
  }

  return {
    object,
    follow(position: THREE.Vector3) {
      // The sky follows the pilot; nearby planets stay fixed so flying past them feels real.
      stars.position.copy(position);
      nebula.position.copy(position);
    },
  };
}
