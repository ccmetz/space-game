import { paints, shipTypes, type ShipSelection } from './catalog.ts';
import { createStore } from '../state.ts';

export type SelectionStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createShipSelection(getStorage: () => SelectionStorage = () => localStorage) {
  let shipId: string = shipTypes[0].id;
  let paintId: string = paints[0].id;
  try {
    const storage = getStorage();
    shipId = shipTypes.find((item) => item.id === storage.getItem('starbound.ship'))?.id ?? shipId;
    paintId = paints.find((item) => item.id === storage.getItem('starbound.paint'))?.id ?? paintId;
  } catch {
    // Browsers can block storage; choosing a ship still works for this session.
  }
  const store = createStore<ShipSelection>({ shipId, paintId });
  let confirmed = store.getSnapshot();

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    chooseShip(id: string) {
      if (shipTypes.some((ship) => ship.id === id)) store.update({ shipId: id });
    },
    choosePaint(id: string) {
      if (paints.some((paint) => paint.id === id)) store.update({ paintId: id });
    },
    confirm() {
      confirmed = store.getSnapshot();
      try {
        const storage = getStorage();
        storage.setItem('starbound.ship', confirmed.shipId);
        storage.setItem('starbound.paint', confirmed.paintId);
      } catch {
        // Keep the confirmed choice in memory if this browser won't save it.
      }
    },
    cancel() {
      store.update(confirmed);
    },
  };
}
