import assert from 'node:assert/strict';
import test from 'node:test';
import { createShipSelection } from '../src/ui/ship-selection.ts';

// Supply only the browser operations this module needs; assertions below check
// choices and storage, while the real browser check covers the rendered controls.
class Control extends EventTarget {
  constructor(dataset = {}) {
    super();
    this.dataset = dataset;
  }
  classList = { toggle() {} };
  setAttribute() {}
  focus() {}
  click() {
    this.dispatchEvent(new Event('click'));
  }
}

function setup(t, storage) {
  const elements = new Map();
  const ships = ['pathfinder', 'arrow', 'atlas'].map((ship) => new Control({ ship }));
  const paints = ['ivory', 'graphite', 'cobalt', 'crimson'].map((paint) => new Control({ paint }));
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Control());
      return elements.get(id);
    },
    querySelectorAll(selector) {
      return selector === '[data-ship]' ? ships : paints;
    },
  };
  for (const [name, value] of Object.entries({ document, localStorage: storage })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
  let choice;
  const selection = createShipSelection({
    onChange: (value) => {
      choice = value;
    },
    onClose: (confirm) => selection.close(confirm),
  });
  return { selection, ships, paints, elements, getChoice: () => choice };
}

test('ship selection restores saved IDs, cancels drafts and saves confirmed choices', (t) => {
  const values = new Map([
    ['starbound.ship', 'arrow'],
    ['starbound.paint', 'crimson'],
  ]);
  const ui = setup(t, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  assert.deepEqual(ui.getChoice(), { shipId: 'arrow', paintId: 'crimson' });
  ui.selection.open();
  ui.ships[2].click();
  ui.paints[2].click();
  assert.deepEqual(ui.getChoice(), { shipId: 'atlas', paintId: 'cobalt' });
  ui.elements.get('back-from-ships').click();
  assert.deepEqual(ui.getChoice(), { shipId: 'arrow', paintId: 'crimson' });
  assert.equal(values.get('starbound.ship'), 'arrow');

  ui.selection.open();
  ui.ships[0].click();
  ui.paints[1].click();
  ui.elements.get('confirm-ship-button').click();
  assert.equal(values.get('starbound.ship'), 'pathfinder');
  assert.equal(values.get('starbound.paint'), 'graphite');
});

test('blocked storage still allows confirming and cancelling choices for the session', (t) => {
  const ui = setup(t, {
    getItem() {
      throw new Error('Storage blocked');
    },
    setItem() {
      throw new Error('Storage blocked');
    },
  });
  assert.deepEqual(ui.getChoice(), { shipId: 'pathfinder', paintId: 'ivory' });
  ui.ships[2].click();
  ui.paints[2].click();
  ui.elements.get('confirm-ship-button').click();
  ui.ships[1].click();
  ui.paints[3].click();
  ui.elements.get('back-from-ships').click();
  assert.deepEqual(ui.getChoice(), { shipId: 'atlas', paintId: 'cobalt' });
});

test('unknown saved ship and paint IDs fall back to the defaults', (t) => {
  const ui = setup(t, { getItem: () => 'removed-choice' });
  assert.deepEqual(ui.getChoice(), { shipId: 'pathfinder', paintId: 'ivory' });
});
