import { paints, shipTypes, type ShipSelection } from '../ships/catalog.ts';
import { element } from './dom.ts';

interface SelectionActions {
  onChange: (selection: ShipSelection) => void;
  onClose: (confirm: boolean) => void;
}

export function createShipSelection(actions: SelectionActions) {
  let selectedShip: string = shipTypes[0].id;
  let selectedPaint: string = paints[0].id;
  try {
    selectedShip =
      shipTypes.find((item) => item.id === localStorage.getItem('starbound.ship'))?.id ??
      shipTypes[0].id;
    selectedPaint =
      paints.find((item) => item.id === localStorage.getItem('starbound.paint'))?.id ??
      paints[0].id;
  } catch {
    // Browsers can block storage; choosing a ship still works for this session.
  }
  let confirmedShip = selectedShip;
  let confirmedPaint = selectedPaint;
  const selectionPanel = element('ship-selection');
  const chooseShipButton = element('choose-ship-button');
  const shipOptions = document.querySelectorAll<HTMLButtonElement>('[data-ship]');
  const paintOptions = document.querySelectorAll<HTMLButtonElement>('[data-paint]');

  function update() {
    const ship = shipTypes.find((item) => item.id === selectedShip);
    const paint = paints.find((item) => item.id === selectedPaint);
    if (!ship || !paint) throw new Error('Unknown ship or paint selection.');
    shipOptions.forEach((button) => {
      const selected = button.dataset.ship === selectedShip;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    paintOptions.forEach((button) => {
      const selected = button.dataset.paint === selectedPaint;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    element('paint-name').textContent = paint.name;
    element('ship-code').textContent = ship.code;
    element('ship-name').textContent = ship.name.toUpperCase();
    chooseShipButton.setAttribute(
      'aria-label',
      `Choose ship, current selection: ${ship.name}, ${paint.name}`,
    );
    actions.onChange({ shipId: selectedShip, paintId: selectedPaint });
  }
  shipOptions.forEach((button) =>
    button.addEventListener('click', () => {
      const ship = shipTypes.find((item) => item.id === button.dataset.ship);
      if (!ship) return;
      selectedShip = ship.id;
      update();
    }),
  );
  paintOptions.forEach((button) =>
    button.addEventListener('click', () => {
      const paint = paints.find((item) => item.id === button.dataset.paint);
      if (!paint) return;
      selectedPaint = paint.id;
      update();
    }),
  );
  element('back-from-ships').addEventListener('click', () => actions.onClose(false));
  element('confirm-ship-button').addEventListener('click', () => actions.onClose(true));
  update();

  return {
    open() {
      selectionPanel.hidden = false;
      element<HTMLButtonElement>('back-from-ships').focus();
    },
    close(confirm: boolean) {
      if (confirm) {
        confirmedShip = selectedShip;
        confirmedPaint = selectedPaint;
        try {
          localStorage.setItem('starbound.ship', confirmedShip);
          localStorage.setItem('starbound.paint', confirmedPaint);
        } catch {
          // Keep the confirmed choice in memory if this browser won't save it.
        }
      } else {
        selectedShip = confirmedShip;
        selectedPaint = confirmedPaint;
        update();
      }
      selectionPanel.hidden = true;
      chooseShipButton.focus();
    },
  };
}
