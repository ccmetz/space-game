import { element } from './dom.ts';

interface MenuActions {
  onLaunch: () => void;
  onChooseShip: () => void;
  onTogglePause: () => void;
  onResume: () => void;
}

export function createMenus(actions: MenuActions) {
  const app = element('app');
  const intro = element('intro');
  const helpPanel = element('controls-panel');
  const pauseOverlay = element('pause-overlay');
  const pauseButton = element<HTMLButtonElement>('pause-button');
  const flightState = element('flight-state');
  const notice = element('flight-notice');
  let noticeTimeout = 0;

  element('launch-button').addEventListener('click', actions.onLaunch);
  element('choose-ship-button').addEventListener('click', actions.onChooseShip);
  pauseButton.addEventListener('click', actions.onTogglePause);
  element('resume-button').addEventListener('click', actions.onResume);
  element('help-button').addEventListener('click', () => {
    helpPanel.hidden = !helpPanel.hidden;
  });
  element('close-help').addEventListener('click', () => {
    helpPanel.hidden = true;
  });

  return {
    get helpVisible() {
      return !helpPanel.hidden;
    },
    hideHelp() {
      helpPanel.hidden = true;
    },
    toggleHelp() {
      helpPanel.hidden = !helpPanel.hidden;
    },
    launch() {
      app.classList.add('flying');
      helpPanel.hidden = true;
      intro.inert = true;
      intro.setAttribute('aria-hidden', 'true');
    },
    setPreview(active: boolean) {
      app.classList.toggle('choosing-ship', active);
      intro.hidden = active;
      intro.inert = active;
      if (active) helpPanel.hidden = true;
    },
    setPaused(paused: boolean) {
      pauseOverlay.hidden = !paused;
      pauseButton.textContent = paused ? '▷' : 'Ⅱ';
      pauseButton.setAttribute('aria-label', paused ? 'Resume flight' : 'Pause flight');
      flightState.textContent = paused ? 'FLIGHT PAUSED' : 'FLIGHT ACTIVE';
    },
    notify(message: string) {
      notice.textContent = message;
      notice.classList.add('visible');
      window.clearTimeout(noticeTimeout);
      noticeTimeout = window.setTimeout(() => notice.classList.remove('visible'), 4000);
    },
    show() {
      app.hidden = false;
    },
    showGraphicsError() {
      const error = element('error');
      error.hidden = false;
      error.textContent =
        'The graphics connection was interrupted. Reload the page to restart your flight.';
    },
  };
}
