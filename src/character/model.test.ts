import * as THREE from 'three';
import { expect, test, vi } from 'vitest';
import { createCharacter, hairStyles } from './character.ts';
import { characterSpeeds, createCharacterModel } from './model.ts';

function hairShape(model: ReturnType<typeof createCharacterModel>) {
  model.group.updateMatrixWorld(true);
  const shapes: number[][] = [];
  model.hairstyle.traverse((object) => {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry>;
    if (!mesh.geometry) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    shapes.push([
      ...bounds.min.toArray(),
      ...bounds.max.toArray(),
      mesh.geometry.getAttribute('position').count,
    ]);
  });
  return JSON.stringify(shapes);
}

test('every selectable hairstyle produces a distinct 3D shape, including no hair for bald', () => {
  const character = createCharacter(() => {
    throw new Error('No storage');
  });
  const shapes = new Set<string>();
  for (const style of hairStyles) {
    character.choose('hairstyle', style.id);
    const model = createCharacterModel(character.getSnapshot());
    shapes.add(hairShape(model));
    expect(model.hairstyle.children.length === 0).toBe(style.id === 'bald');
    model.dispose();
  }
  expect(shapes.size).toBe(hairStyles.length);
});

test('confirmed character retains the same model as its preview after saving and reloading', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const character = createCharacter(() => storage);
  character.setName('Nova');
  character.choose('hairstyle', 'long');
  character.choose('hair', 'copper');
  character.choose('skin', 'deep');
  character.choose('suit', 'rust');
  const preview = createCharacterModel(character.getSnapshot());
  character.confirm();
  const restored = createCharacter(() => storage);
  const player = createCharacterModel(restored.getSnapshot());
  expect(hairShape(player)).toBe(hairShape(preview));
  expect(new THREE.Box3().setFromObject(player.group)).toEqual(
    new THREE.Box3().setFromObject(preview.group),
  );
  preview.dispose();
  player.dispose();
});

test('detailed characters retain moving limbs and release their owned graphics resources', () => {
  const model = createCharacterModel({
    skin: 'deep',
    hair: 'silver',
    hairstyle: 'long',
    suit: 'blue',
  });
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.MeshStandardMaterial>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  model.group.traverse((object) => {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    materials.add(mesh.material);
    if (mesh.material.bumpMap) textures.add(mesh.material.bumpMap);
    if (mesh.material.alphaMap) textures.add(mesh.material.alphaMap);
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) skeletons.add(skinned.skeleton);
    const positions = mesh.geometry.getAttribute('position');
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
  });

  // The station expects alternating left leg/arm and right leg/arm pivots.
  expect(model.limbs).toHaveLength(4);
  for (const limb of model.limbs) {
    const before = new THREE.Box3().setFromObject(limb);
    limb.rotation.x = 0.45;
    expect(new THREE.Box3().setFromObject(limb)).not.toEqual(before);
  }
  expect(textures.size).toBe(3);
  expect(skeletons.size).toBe(4);
  const disposals = [...geometries, ...materials, ...textures, ...skeletons].map((resource) =>
    vi.spyOn(resource, 'dispose'),
  );
  model.dispose();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
});

test.each(['walk', 'run'] as const)(
  '%s bends the joints while keeping stance boots on the floor',
  (gait) => {
    const model = createCharacterModel({
      skin: 'sand',
      hair: 'dark',
      hairstyle: 'crop',
      suit: 'sage',
    });
    model.group.position.set(2, 0, -3);
    model.group.rotation.y = 0.4;
    let greatestKneeBend = 0;
    const point = new THREE.Vector3();
    for (let frame = 0; frame < 100; frame++) {
      model.animate(1 / 60, characterSpeeds[gait]);
      model.group.updateMatrixWorld(true);
      if (frame % 5) continue;
      let lowestBoot = Infinity;
      for (const limb of [model.limbs[0], model.limbs[2]]) {
        for (const object of limb.children) {
          const mesh = object as THREE.SkinnedMesh;
          if (!mesh.isSkinnedMesh) continue;
          greatestKneeBend = Math.max(greatestKneeBend, mesh.skeleton.bones[1].rotation.x);
          for (let vertex = 0; vertex < mesh.geometry.getAttribute('position').count; vertex++) {
            mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
            lowestBoot = Math.min(lowestBoot, point.y);
          }
        }
      }
      expect(lowestBoot).toBeGreaterThanOrEqual(-0.005);
      expect(lowestBoot).toBeLessThan(gait === 'walk' ? 0.02 : 0.09);
    }
    expect(greatestKneeBend).toBeGreaterThan(gait === 'walk' ? 0.5 : 1);
    expect(model.group.position.toArray()).toEqual([2, 0, -3]);
    expect(model.group.rotation.y).toBe(0.4);
    // Releasing movement (or hitting a wall) settles the legs instead of leaving
    // a foot suspended in the last running pose.
    for (let frame = 0; frame < 120; frame++) model.animate(1 / 60, 0);
    expect(Math.abs(model.limbs[0].rotation.x - model.limbs[2].rotation.x)).toBeLessThan(0.001);
    expect(Math.abs(model.limbs[0].rotation.x)).toBeLessThan(0.1);
    model.dispose();
  },
);

test.each(['walk', 'run'] as const)('%s stays smooth through lift-off and landing', (gait) => {
  const model = createCharacterModel({
    skin: 'sand',
    hair: 'dark',
    hairstyle: 'crop',
    suit: 'sage',
  });
  const joints = model.limbs.map((limb) => {
    const mesh = limb.children.find(
      (child) => (child as THREE.SkinnedMesh).isSkinnedMesh,
    ) as THREE.SkinnedMesh;
    return mesh.skeleton.bones[1];
  });
  let previous: number[] | undefined;
  let previousVelocity: number[] | undefined;
  let peakAcceleration = 0;
  // A steady high sampling rate exposes contact snaps that a pose snapshot
  // misses. Ignore the initial blend, then cover several complete strides.
  for (let frame = 0; frame < 600; frame++) {
    model.animate(1 / 120, characterSpeeds[gait]);
    const pose = [
      ...model.limbs.map((limb) => limb.rotation.x),
      ...joints.map((joint) => joint.rotation.x),
    ];
    if (previous) {
      const velocity = pose.map((angle, index) => (angle - previous![index]) * 120);
      if (previousVelocity && frame > 120) {
        for (let index = 0; index < velocity.length; index++) {
          peakAcceleration = Math.max(
            peakAcceleration,
            Math.abs(velocity[index] - previousVelocity[index]) * 120,
          );
        }
      }
      previousVelocity = velocity;
    }
    previous = pose;
  }
  // The original contact snaps exceeded 3,900 (walk) and 6,600 (run)
  // radians/s². Allow athletic motion, but reject those abrupt reversals.
  expect(peakAcceleration).toBeLessThan(800);
  model.dispose();
});
