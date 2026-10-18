import { afterEach, expect, onTestFinished, test, vi } from 'vitest';
import { createInput, type InputCommand } from './input.ts';

afterEach(() => vi.unstubAllGlobals());

function browserEvents() {
  const window = new EventTarget();
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', new EventTarget());
  return window;
}

function key(window: EventTarget, code: string) {
  window.dispatchEvent(
    Object.assign(new Event('keydown', { cancelable: true }), {
      code,
      key: '',
      repeat: false,
    }),
  );
}

test('input cleanup removes old handlers before a React remount', () => {
  const window = browserEvents();
  const commands: InputCommand[] = [];
  const actions = {
    hasStarted: () => true,
    canFly: () => true,
    isPreviewing: () => false,
    onCommand: (command: InputCommand) => commands.push(command),
    onFocusLost() {},
  };
  const oldInput = createInput(actions);
  oldInput.dispose();
  const input = createInput(actions);
  onTestFinished(() => input.dispose());
  key(window, 'KeyP');
  key(window, 'KeyW');
  expect(commands).toStrictEqual(['pause']);
  expect(input.read().pitchUp).toBe(true);
  expect(oldInput.read().pitchUp).toBe(false);
});

test('touch input releases keys and focus loss clears controls before pausing', () => {
  const window = browserEvents();
  let flying = true;
  const input = createInput({
    hasStarted: () => true,
    canFly: () => flying,
    isPreviewing: () => false,
    onCommand() {},
    onFocusLost() {
      flying = false;
    },
  });
  onTestFinished(() => input.dispose());
  input.press('ShiftLeft');
  expect(input.read().boosting).toBe(true);
  input.release('ShiftLeft');
  expect(input.read().boosting).toBe(false);
  input.press('KeyW');
  window.dispatchEvent(new Event('blur'));
  expect(input.read().pitchUp).toBe(false);
  input.press('KeyW');
  expect(input.read().pitchUp).toBe(false);
});
