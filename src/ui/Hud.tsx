import { useSyncExternalStore, type RefObject } from 'react';
import type { Game, Session } from '../game.ts';
import { shipTypes } from '../ships/catalog.ts';
import { worldDefinitions } from '../worlds/catalog.ts';

export function Hud({
  game,
  session,
  markerRef,
}: {
  game: Game;
  session: Readonly<Session>;
  markerRef: RefObject<HTMLDivElement | null>;
}) {
  const telemetry = useSyncExternalStore(game.telemetry.subscribe, game.telemetry.getSnapshot);
  const choice = useSyncExternalStore(game.selection.subscribe, game.selection.getSnapshot);
  const ship = shipTypes.find((ship) => ship.id === choice.shipId) ?? shipTypes[0];
  const target =
    worldDefinitions.find((world) => world.id === session.targetId) ?? worldDefinitions[0];
  const targetName = target.name.toUpperCase();
  const headingStep = Math.floor(telemetry.heading / 15) * 15;
  const pitchLabel = `${telemetry.pitch < -0.5 ? '−' : '+'}${Math.abs(Math.round(telemetry.pitch)).toString().padStart(2, '0')}°`;
  const bankLabel = `${Math.abs(telemetry.bank) < 0.5 ? '' : telemetry.bank > 0 ? 'L ' : 'R '}${Math.abs(Math.round(telemetry.bank)).toString().padStart(2, '0')}°`;
  const throttle =
    !session.started || session.paused || telemetry.braking
      ? 0
      : telemetry.boosting
        ? 100
        : Math.round((42 / 180) * 100);
  const flightState = !session.started
    ? 'SYSTEMS READY'
    : session.paused
      ? 'FLIGHT PAUSED'
      : telemetry.boosting
        ? 'BOOST ENGAGED'
        : telemetry.braking
          ? 'BRAKING'
          : 'FREE FLIGHT';

  return (
    <>
      <aside className="navigation" aria-label="Navigation targets">
        <div className="section-label">NAVIGATION</div>
        {worldDefinitions.map((world) => (
          <button
            key={world.id}
            className={`destination${session.targetId === world.id ? ' active' : ''}`}
            aria-pressed={session.targetId === world.id}
            data-target={world.id}
            onClick={() => game.selectTarget(world.id)}
          >
            <span className={`planet-icon ${world.icon}`} />
            <span className="destination-info">
              <strong>{world.name}</strong>
              <span>{world.description}</span>
            </span>
            <span className="destination-arrow">↗</span>
          </button>
        ))}
        <div className="target-readout">
          <span>SELECTED TARGET</span>
          <strong id="target-name">{targetName}</strong>
          <div>
            <span id="target-distance">{telemetry.targetDistance.toFixed(0)} KM</span>
            <span id="target-status">
              {telemetry.targetDiscovered ? 'DISCOVERED' : 'UNEXPLORED'}
            </span>
          </div>
          <button id="jump-button" onClick={game.jump}>
            JUMP TO VICINITY <span>↗</span>
          </button>
        </div>
      </aside>
      <div className="target-marker" id="target-marker" ref={markerRef} aria-hidden="true">
        <div className="marker-corners"></div>
        <span id="marker-name">{targetName}</span>
      </div>
      <div className="heading-instrument" aria-label="Ship heading">
        <span className="instrument-label">
          HDG{' '}
          <strong id="heading">
            {(Math.round(telemetry.heading) % 360).toString().padStart(3, '0')}°
          </strong>
        </span>
        <div className="heading-window">
          <div
            className="heading-tape"
            id="heading-tape"
            style={{ transform: `translateX(${-67.5 - (telemetry.heading - headingStep) * 3}px)` }}
          >
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className="heading-mark">
                {((headingStep + (index - 4) * 15 + 360) % 360).toString().padStart(3, '0')}
              </span>
            ))}
          </div>
        </div>
        <i className="heading-pointer" aria-hidden="true"></i>
      </div>
      <div className="flight-guidance" aria-hidden="true">
        <div className="attitude-window">
          <div
            id="attitude-roll"
            style={{ transform: `rotate(${telemetry.bank}deg)` }}
            className="attitude-roll"
          >
            <div
              id="pitch-ladder"
              style={{ transform: `translateY(${telemetry.pitch * 4}px)` }}
              className="pitch-ladder"
            >
              <div className="pitch-rung">
                <span>30</span>
                <i></i>
                <span>30</span>
              </div>
              <div className="pitch-rung">
                <span>20</span>
                <i></i>
                <span>20</span>
              </div>
              <div className="pitch-rung">
                <span>10</span>
                <i></i>
                <span>10</span>
              </div>
              <div className="pitch-rung level">
                <span>0</span>
                <i></i>
                <span>0</span>
              </div>
              <div className="pitch-rung negative">
                <span>10</span>
                <i></i>
                <span>10</span>
              </div>
              <div className="pitch-rung negative">
                <span>20</span>
                <i></i>
                <span>20</span>
              </div>
              <div className="pitch-rung negative">
                <span>30</span>
                <i></i>
                <span>30</span>
              </div>
            </div>
          </div>
        </div>
        <div className="reticle">
          <span></span>
          <i></i>
          <span></span>
        </div>
      </div>
      <section className="velocity-instrument" aria-label="Velocity and engine power">
        <span className="instrument-label">VELOCITY</span>
        <div className="velocity-value">
          <strong id="speed">{Math.round(telemetry.speed).toString().padStart(2, '0')}</strong>
          <span>KM/S</span>
        </div>
        <div className="speed-meter">
          <i id="speed-meter" style={{ width: `${(telemetry.speed / 180) * 100}%` }}></i>
        </div>
        <div className="throttle-readout">
          <span>
            THR <strong id="throttle">{throttle.toString().padStart(2, '0')}%</strong>
          </span>
          <span id="boost-label">
            {session.paused
              ? 'PAUSED'
              : telemetry.braking
                ? 'BRAKING'
                : telemetry.boosting
                  ? 'BOOST'
                  : 'CRUISE'}
          </span>
        </div>
      </section>
      <footer className="hud">
        <div className="ship-status">
          <svg viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <path
              d="m22 5 4 15 13-7-3 6-10 6 2 13-6-5-6 5 2-13-10-6-3-6 13 7Z"
              stroke="currentColor"
            />
          </svg>
          <div>
            <div className="ship-identity">
              <strong id="ship-code">{ship.code}</strong>
              <span id="ship-name">{ship.name.toUpperCase()}</span>
            </div>
            <span className="ship-ready">
              <i></i>
              <span id="flight-state">{flightState}</span>
            </span>
          </div>
        </div>
        <div className="attitude-readout" aria-label="Ship attitude">
          <div>
            <span>PITCH</span>
            <strong id="pitch">{pitchLabel}</strong>
          </div>
          <div>
            <span>BANK</span>
            <strong id="bank">{bankLabel}</strong>
          </div>
        </div>
        <div className="flight-stats">
          <div>
            <span className="section-label">TRIP</span>
            <strong>
              <span id="distance">{telemetry.distance.toFixed(1)}</span>
              <small> KM</small>
            </strong>
          </div>
          <div>
            <span className="section-label">DISCOVERED</span>
            <strong>
              <span id="discovered">{telemetry.discoveredCount.toString().padStart(2, '0')}</span>
              <small> / {worldDefinitions.length.toString().padStart(2, '0')}</small>
            </strong>
          </div>
        </div>
      </footer>
    </>
  );
}
