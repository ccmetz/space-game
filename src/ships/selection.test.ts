import { expect, test } from 'vitest';
import { createShipSelection } from './selection.ts';

// Supply only the browser operations this module needs; assertions below check
// choices and storage, while the real browser check covers the rendered controls.
function createStorage(values = new Map<string, string>()) {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test('ship selection restores saved IDs, cancels drafts and saves confirmed choices', () => {
  const values = new Map([
    ['starbound.ship', 'arrow'],
    ['starbound.paint', 'crimson'],
  ]);
  const selection = createShipSelection(() => createStorage(values));
  expect(selection.getSnapshot()).toStrictEqual({ shipId: 'arrow', paintId: 'crimson' });
  selection.chooseShip('atlas');
  selection.choosePaint('cobalt');
  expect(selection.getSnapshot()).toStrictEqual({ shipId: 'atlas', paintId: 'cobalt' });
  selection.cancel();
  expect(selection.getSnapshot()).toStrictEqual({ shipId: 'arrow', paintId: 'crimson' });
  expect(values.get('starbound.ship')).toBe('arrow');

  selection.chooseShip('pathfinder');
  selection.choosePaint('graphite');
  selection.confirm();
  const restored = createShipSelection(() => createStorage(values));
  expect(restored.getSnapshot()).toStrictEqual({ shipId: 'pathfinder', paintId: 'graphite' });
});

test('blocked storage still allows confirming and cancelling choices for the session', () => {
  const selection = createShipSelection(() => {
    throw new Error('Storage blocked');
  });
  expect(selection.getSnapshot()).toStrictEqual({ shipId: 'pathfinder', paintId: 'ivory' });
  selection.chooseShip('atlas');
  selection.choosePaint('cobalt');
  selection.confirm();
  selection.chooseShip('arrow');
  selection.choosePaint('crimson');
  selection.cancel();
  expect(selection.getSnapshot()).toStrictEqual({ shipId: 'atlas', paintId: 'cobalt' });
});

test('unknown ship and paint IDs preserve valid selections', () => {
  const selection = createShipSelection(() =>
    createStorage(new Map([['starbound.ship', 'removed-choice']])),
  );
  const original = selection.getSnapshot();
  selection.chooseShip('removed-choice');
  selection.choosePaint('removed-choice');
  expect(selection.getSnapshot()).toBe(original);
  expect(original).toStrictEqual({ shipId: 'pathfinder', paintId: 'ivory' });
});
