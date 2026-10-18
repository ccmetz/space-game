import { expect, test } from 'vitest';
import { createStore } from './state.ts';

test('snapshots stay stable between changes and remain unchanged after later updates', () => {
  const store = createStore({ started: false, paused: false });
  const initial = store.getSnapshot();
  expect(store.getSnapshot()).toBe(initial);
  store.update({ started: false });
  expect(store.getSnapshot()).toBe(initial);
  expect(() => Object.assign(initial, { started: true })).toThrow(TypeError);

  store.update({ started: true });
  expect(store.getSnapshot()).not.toBe(initial);
  expect(initial).toStrictEqual({ started: false, paused: false });
  expect(store.getSnapshot()).toStrictEqual({ started: true, paused: false });
});

test('subscribers read a complete update and stop receiving changes after unsubscribe', () => {
  const store = createStore({ started: false, paused: false });
  const received: Readonly<{ started: boolean; paused: boolean }>[] = [];
  const unsubscribe = store.subscribe(() => received.push(store.getSnapshot()));
  store.update({ started: true, paused: true });
  store.update({ paused: true });
  expect(received).toStrictEqual([{ started: true, paused: true }]);
  unsubscribe();
  store.update({ paused: false });
  expect(received.length).toBe(1);
});
