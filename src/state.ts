// Both game status and HUD readouts need stable snapshots and subscriptions.
// Keeping this small also lets game modules publish changes without importing React.
export function createStore<State extends object>(initialState: State) {
  let snapshot: Readonly<State> = Object.freeze({ ...initialState });
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(changes: Partial<State>) {
      const keys = Object.keys(changes) as (keyof State)[];
      if (keys.every((key) => Object.is(snapshot[key], changes[key]))) return;
      snapshot = Object.freeze({ ...snapshot, ...changes });
      listeners.forEach((listener) => listener());
    },
  };
}
