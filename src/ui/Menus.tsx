import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Game, Session } from '../game.ts';
import { paints, shipTypes } from '../ships/catalog.ts';

export function Menus({ game, session }: { game: Game; session: Readonly<Session> }) {
  const character = useSyncExternalStore(game.character.subscribe, game.character.getSnapshot);
  const choice = useSyncExternalStore(game.selection.subscribe, game.selection.getSnapshot);
  const ship = shipTypes.find((ship) => ship.id === choice.shipId) ?? shipTypes[0];
  const paint = paints.find((paint) => paint.id === choice.paintId) ?? paints[0];
  const chooseButton = useRef<HTMLButtonElement>(null);
  const wasChoosingShip = useRef(false);

  useEffect(() => {
    if (wasChoosingShip.current && !session.choosingShip) chooseButton.current?.focus();
    wasChoosingShip.current = session.choosingShip;
  }, [session.choosingShip]);

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Starbound home">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 2 20 12 30 16 20 20 16 30 12 20 2 16 12 12Z" stroke="currentColor" />
            <path d="m16 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="currentColor" />
          </svg>
          STARBOUND
        </a>
        <nav className="top-actions" aria-label="Game controls">
          <button id="help-button" onClick={game.toggleHelp} className="text-button">
            CONTROLS <span className="key">?</span>
          </button>
          <button
            id="pause-button"
            onClick={game.togglePause}
            className="icon-button"
            aria-label={session.paused ? 'Resume flight' : 'Pause flight'}
            title={session.paused ? 'Resume flight' : 'Pause flight'}
          >
            {session.paused ? '▷' : 'Ⅱ'}
          </button>
        </nav>
      </header>
      <div
        className="intro"
        id="intro"
        hidden={session.choosingShip}
        inert={session.started || session.choosingShip}
        aria-hidden={session.started || session.choosingShip}
      >
        <p className="crew-welcome">Welcome aboard, {character.name}.</p>
        {!character.saved && (
          <p role="status">
            Your character is available this session, but could not be saved in this browser.
          </p>
        )}
        <h1>
          Explore
          <br />
          the <em>stars.</em>
        </h1>
        <button id="launch-button" onClick={game.launch} className="primary-button">
          BEGIN FLIGHT <span>↗</span>
        </button>
        <button
          id="choose-ship-button"
          ref={chooseButton}
          onClick={game.openShipSelection}
          aria-label={`Choose ship, current selection: ${ship.name}, ${paint.name}`}
          className="secondary-button"
        >
          CHOOSE SHIP
        </button>
        <button className="secondary-button" onClick={game.character.edit}>
          EDIT CHARACTER
        </button>
      </div>
      <section
        className="controls-panel"
        id="controls-panel"
        aria-label="Flight controls"
        hidden={!session.helpVisible}
      >
        <div className="section-label">
          FLIGHT MANUAL
          <button id="close-help" onClick={game.hideHelp} aria-label="Close controls">
            ×
          </button>
        </div>
        <h2>You have the helm.</h2>
        <dl>
          <div>
            <dt>
              <kbd>W</kbd>
              <kbd>S</kbd>
            </dt>
            <dd>Pitch up / down</dd>
          </div>
          <div>
            <dt>
              <kbd>A</kbd>
              <kbd>D</kbd>
            </dt>
            <dd>Turn left / right</dd>
          </div>
          <div>
            <dt>
              <kbd>Q</kbd>
              <kbd>E</kbd>
            </dt>
            <dd>Roll left / right</dd>
          </div>
          <div>
            <dt>
              <kbd>SHIFT</kbd>
            </dt>
            <dd>Hold to boost</dd>
          </div>
          <div>
            <dt>
              <kbd>SPACE</kbd>
            </dt>
            <dd>Hold to brake</dd>
          </div>
          <div>
            <dt>
              <kbd>P</kbd> / <kbd>ESC</kbd>
            </dt>
            <dd>Pause flight</dd>
          </div>
          <div>
            <dt>
              <kbd>R</kbd>
            </dt>
            <dd>Return to start</dd>
          </div>
        </dl>
        <p>Fly close to a planet to discover it. Use navigation to jump near another world.</p>
      </section>
      <div className="pause-overlay" id="pause-overlay" hidden={!session.paused}>
        <span className="eyebrow">PAUSED</span>
        <h2>Adrift for a moment.</h2>
        <button id="resume-button" onClick={game.resume} className="primary-button">
          RESUME FLIGHT <span>↗</span>
        </button>
      </div>
      <div
        className={`flight-notice${session.notice ? ' visible' : ''}`}
        id="flight-notice"
        role="status"
      >
        {session.notice}
      </div>
    </>
  );
}
