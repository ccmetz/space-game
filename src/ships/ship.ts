import * as THREE from 'three';
import type { Glow } from '../graphics/glow.ts';
import { paints, type ShipSelection } from './catalog.ts';

export function createShip(glow: Glow) {
  const ship = new THREE.Group();
  const model = new THREE.Group();
  ship.add(model);

  const hull = new THREE.MeshStandardMaterial({
    color: '#b9bbb6',
    metalness: 0.55,
    roughness: 0.45,
  });
  const darkHull = new THREE.MeshStandardMaterial({
    color: '#34414b',
    metalness: 0.65,
    roughness: 0.4,
  });
  const red = new THREE.MeshStandardMaterial({ color: '#a75643', metalness: 0.4, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({
    color: '#162c3b',
    metalness: 0.8,
    roughness: 0.15,
  });
  let assembly = new THREE.Group();
  model.add(assembly);
  function box(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Group = assembly,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    top: number,
    bottom: number,
    length: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Group = assembly,
  ) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, length, 12), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  const engineGlows: THREE.Sprite[] = [];
  const flames: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  const engineMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.45, 2.4) });
  function addEngine(x: number, y: number, z: number, parent = assembly, radius = 0.62) {
    cylinder(radius, radius * 1.1, 3.8, hull, x, y, z, parent);
    cylinder(radius * 0.77, radius * 0.77, 0.3, darkHull, x, y, z + 2, parent);
    cylinder(radius * 0.61, radius * 0.61, 0.12, engineMaterial, x, y, z + 2.2, parent);
    const engineGlow = glow('#ae96ff', 3, 0.8);
    engineGlow.position.set(x, y, z + 2.3);
    parent.add(engineGlow);
    engineGlows.push(engineGlow);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.56, 3, 16),
      new THREE.MeshBasicMaterial({
        color: '#a7b6ff',
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(x, y, z + 3.5);
    parent.add(flame);
    flames.push(flame);
  }

  cylinder(0.17, 1, 11, hull, 0, 0, -2);
  box(1.8, 1.25, 4, hull, 0, 0, 2.3);
  const cockpit = box(1.18, 0.7, 2.8, glass, 0, 0.8, -0.1);
  cockpit.rotation.x = -0.13;
  box(0.24, 0.05, 6.5, red, 0, 0.6, -4.3);
  box(1.2, 0.4, 1.1, darkHull, 0, 0.86, 2.8);
  // Four separate wing assemblies form the open X silhouette, with a cannon and engine on each.
  for (const side of [-1, 1]) {
    for (const level of [-1, 1]) {
      const wing = new THREE.Group();
      wing.rotation.z = side * level * 0.28;
      wing.position.set(side * 0.65, level * 0.25, 1.8);
      assembly.add(wing);
      box(5.6, 0.16, 2.1, hull, side * 2.8, 0, 0, wing);
      box(1.1, 0.19, 2.12, red, side * 4.7, 0, 0, wing);
      box(1.3, 0.22, 1.4, darkHull, side * 1.4, 0, 0.2, wing);
      addEngine(side * 1.9, 0, 0.5, wing);
      cylinder(0.09, 0.13, 6.4, hull, side * 5.55, 0, -1.5, wing);
      cylinder(0.06, 0.08, 1.6, darkHull, side * 5.55, 0, -5.1, wing);
    }
  }
  const pathfinder = assembly;

  assembly = new THREE.Group();
  model.add(assembly);
  const deltaShape = new THREE.Shape();
  deltaShape.moveTo(0, 7);
  deltaShape.lineTo(-7, -3);
  deltaShape.lineTo(0, -1.5);
  deltaShape.lineTo(7, -3);
  deltaShape.closePath();
  const deltaWing = new THREE.Mesh(
    new THREE.ExtrudeGeometry(deltaShape, { depth: 0.3, bevelEnabled: false }),
    hull,
  );
  deltaWing.rotation.x = -Math.PI / 2;
  deltaWing.position.y = -0.5;
  assembly.add(deltaWing);
  cylinder(0.12, 0.85, 9, hull, 0, 0, -1.8);
  box(1.1, 0.65, 2.8, glass, 0, 0.65, -1.2).rotation.x = -0.18;
  box(0.2, 2, 2.3, red, 0, 1.25, 2.5).rotation.x = -0.25;
  for (const side of [-1, 1]) {
    box(0.6, 0.15, 4.8, red, side * 3.5, -0.1, 0.7).rotation.y = side * 0.5;
    addEngine(side * 2.2, -0.1, 1.7);
    cylinder(0.09, 0.15, 4.5, darkHull, side * 5.7, -0.2, 0.5);
  }
  const arrow = assembly;

  assembly = new THREE.Group();
  model.add(assembly);
  box(3.6, 1.8, 7, hull, 0, 0, 0);
  cylinder(0.6, 1.8, 4, hull, 0, 0, -4.5);
  box(2.1, 0.65, 2.7, glass, 0, 1.2, -2.1).rotation.x = -0.15;
  box(1.8, 0.3, 3, darkHull, 0, 1.1, 1.5);
  box(0.45, 0.1, 4.5, red, 0, 0.98, -1.5);
  for (const side of [-1, 1]) {
    box(3.2, 0.5, 2.7, darkHull, side * 2.8, 0, 1.6);
    box(1.8, 2, 4.7, hull, side * 4.1, 0, 0.7);
    box(1.85, 0.12, 1, red, side * 4.1, 1.05, 0.5);
    box(0.18, 1.7, 2.5, red, side * 4.1, 1.45, 1.7).rotation.x = -0.15;
    addEngine(side * 4.1, 0, 1.6, assembly, 0.95);
  }
  const atlas = assembly;

  const models = new Map([
    ['pathfinder', pathfinder],
    ['arrow', arrow],
    ['atlas', atlas],
  ]);

  return {
    object: ship,
    // All three models share the paint materials. Keep them built so switching ships
    // changes the preview instantly without creating more graphics resources each time.
    setSelection(selection: ShipSelection) {
      const paint = paints.find((paint) => paint.id === selection.paintId);
      if (!paint || !models.has(selection.shipId)) throw new Error('Unknown ship or paint.');
      models.forEach((model, id) => {
        model.visible = id === selection.shipId;
      });
      hull.color.set(paint.hull);
      red.color.set(paint.accent);
      engineMaterial.color.set(paint.engine).multiplyScalar(2.2);
      engineGlows.forEach((engine) => engine.material.color.set(paint.engine));
      flames.forEach((flame) => flame.material.color.set(paint.engine));
    },
    setPreview(active: boolean) {
      model.rotation.set(0, active ? -0.6 : 0, 0);
    },
    setBank(bank: number) {
      model.rotation.z = bank;
    },
    update(dt: number, time: number, enginePower: number, preview: boolean) {
      if (preview) model.rotation.y += dt * 0.22;
      engineGlows.forEach((engine) => {
        engine.scale.setScalar((2.7 + Math.sin(time * 0.014) * 0.15) * enginePower);
      });
      flames.forEach((flame) => {
        flame.scale.y = enginePower;
      });
    },
  };
}
