import { expect, test } from 'vitest';
import { createCharacter } from './character.ts';

function memoryStorage(values = new Map<string, string>()) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test('character requires a name and saves confirmed appearance and class across reloads', () => {
  const storage = memoryStorage();
  const character = createCharacter(() => storage);
  character.setName('   ');
  expect(character.confirm()).toBe(false);
  expect(character.getSnapshot().confirmed).toBe(false);
  character.setName('  Nova  ');
  character.choose('classId', 'engineer');
  character.choose('skin', 'deep');
  character.choose('hair', 'silver');
  character.choose('hairstyle', 'swept');
  character.choose('suit', 'rust');
  expect(createCharacter(() => storage).getSnapshot().name).toBe('');
  expect(character.confirm()).toBe(true);
  const restored = createCharacter(() => storage);
  expect(restored.getSnapshot()).toEqual({
    name: 'Nova',
    classId: 'engineer',
    skin: 'deep',
    hair: 'silver',
    hairstyle: 'swept',
    suit: 'rust',
    confirmed: false,
    saved: true,
  });
  character.edit();
  expect(character.getSnapshot().confirmed).toBe(false);
  expect(character.getSnapshot().name).toBe('Nova');
});

test('invalid saved options fall back and invalid new options leave the character unchanged', () => {
  const character = createCharacter(() =>
    memoryStorage(new Map([['starbound.character.classId', 'missing']])),
  );
  expect(character.getSnapshot().classId).toBe('explorer');
  const before = character.getSnapshot();
  character.choose('skin', 'missing');
  expect(character.getSnapshot()).toBe(before);
});

test('blocked storage retains the character for the current session and reports saving failure', () => {
  const character = createCharacter(() => {
    throw new Error('Blocked');
  });
  character.setName('Nova');
  character.choose('classId', 'vanguard');
  expect(character.confirm()).toBe(true);
  expect(character.getSnapshot()).toMatchObject({
    name: 'Nova',
    classId: 'vanguard',
    confirmed: true,
    saved: false,
  });
});
