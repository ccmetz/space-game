import * as THREE from 'three';
import { expect, test } from 'vitest';
import { createCharacter, hairStyles } from './character.ts';
import { createCharacterModel } from './model.ts';

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
