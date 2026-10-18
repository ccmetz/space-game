export interface FlightControls {
  pitchUp: boolean;
  pitchDown: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  boosting: boolean;
  braking: boolean;
}

export type InputCommand = 'escape' | 'pause' | 'help' | 'reset';

interface InputActions {
  hasStarted: () => boolean;
  canFly: () => boolean;
  isPreviewing: () => boolean;
  onCommand: (command: InputCommand) => void;
  onFocusLost: () => void;
}

export function createInput(actions: InputActions) {
  const keys = new Set<string>();
  const handledKeys = new Set([
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
    'KeyQ',
    'KeyE',
    'ShiftLeft',
    'ShiftRight',
    'Space',
    'KeyP',
    'Escape',
    'KeyR',
  ]);

  window.addEventListener('keydown', (event) => {
    if (actions.hasStarted() && handledKeys.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    // Escape first closes help or the preview; other flight keys wait until preview ends.
    if (event.code === 'Escape') {
      actions.onCommand('escape');
      return;
    }
    if (actions.isPreviewing() && handledKeys.has(event.code)) return;
    if (event.code === 'KeyP') {
      actions.onCommand('pause');
      return;
    }
    if (event.key === '?') {
      actions.onCommand('help');
      return;
    }
    if (event.code === 'KeyR') {
      actions.onCommand('reset');
      return;
    }
    if (actions.canFly()) keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    actions.onFocusLost();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) actions.onFocusLost();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
    const key = button.dataset.key;
    if (!key) return;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (actions.canFly()) keys.add(key);
    });
    const release = () => keys.delete(key);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });

  return {
    clear() {
      keys.clear();
    },
    read(): FlightControls {
      return {
        pitchUp: keys.has('KeyW'),
        pitchDown: keys.has('KeyS'),
        turnLeft: keys.has('KeyA'),
        turnRight: keys.has('KeyD'),
        rollLeft: keys.has('KeyQ'),
        rollRight: keys.has('KeyE'),
        boosting: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        braking: keys.has('Space'),
      };
    },
  };
}
