import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Game } from '../game.ts';
import { paints } from '../ships/catalog.ts';

export function ShipSelection({ game, choosingShip }: { game: Game; choosingShip: boolean }) {
  const choice = useSyncExternalStore(game.selection.subscribe, game.selection.getSnapshot);
  const paint = paints.find((paint) => paint.id === choice.paintId) ?? paints[0];
  const backButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (choosingShip) backButton.current?.focus();
  }, [choosingShip]);

  return (
    <section
      id="ship-selection"
      className="ship-selection"
      aria-label="Spaceship selection"
      hidden={!choosingShip}
    >
      <button
        id="back-from-ships"
        ref={backButton}
        onClick={() => game.closeShipSelection(false)}
        className="back-button"
      >
        ← BACK
      </button>
      <h1>Choose your ship.</h1>
      <div className="ship-options" role="group" aria-label="Ship type">
        <button
          className={`ship-option${choice.shipId === 'pathfinder' ? ' selected' : ''}`}
          data-ship="pathfinder"
          aria-pressed={choice.shipId === 'pathfinder'}
          onClick={() => game.selection.chooseShip('pathfinder')}
        >
          <svg viewBox="0 0 60 48" aria-hidden="true">
            <path d="m30 3 3 19 22-11-4 10-18 7 2 15-5-4-5 4 2-15-18-7-4-10 22 11Z" />
          </svg>
          <span>
            <strong>Pathfinder</strong>
            <small>Four-wing starfighter</small>
          </span>
          <span className="selection-check" aria-hidden="true">
            ✓
          </span>
        </button>
        <button
          className={`ship-option${choice.shipId === 'arrow' ? ' selected' : ''}`}
          data-ship="arrow"
          aria-pressed={choice.shipId === 'arrow'}
          onClick={() => game.selection.chooseShip('arrow')}
        >
          <svg viewBox="0 0 60 48" aria-hidden="true">
            <path d="m30 4 25 37-19-5-6 5-6-5-19 5Z" />
            <path d="M30 13v23" />
          </svg>
          <span>
            <strong>Arrow</strong>
            <small>Delta-wing interceptor</small>
          </span>
          <span className="selection-check" aria-hidden="true">
            ✓
          </span>
        </button>
        <button
          className={`ship-option${choice.shipId === 'atlas' ? ' selected' : ''}`}
          data-ship="atlas"
          aria-pressed={choice.shipId === 'atlas'}
          onClick={() => game.selection.chooseShip('atlas')}
        >
          <svg viewBox="0 0 60 48" aria-hidden="true">
            <path d="m24 6 12 0 5 8v24H19V14ZM19 25H7v-9h8v25H7V25m34 0h12v-9h-8v25h8V25" />
          </svg>
          <span>
            <strong>Atlas</strong>
            <small>Twin-engine explorer</small>
          </span>
          <span className="selection-check" aria-hidden="true">
            ✓
          </span>
        </button>
      </div>
      <div className="paint-selection">
        <div className="paint-label">
          PAINT <span id="paint-name">{paint.name}</span>
        </div>
        <div className="paint-options" role="group" aria-label="Paint scheme">
          <button
            className={`paint-swatch ivory${choice.paintId === 'ivory' ? ' selected' : ''}`}
            data-paint="ivory"
            aria-label="Ivory paint"
            aria-pressed={choice.paintId === 'ivory'}
            onClick={() => game.selection.choosePaint('ivory')}
          ></button>
          <button
            className={`paint-swatch graphite${choice.paintId === 'graphite' ? ' selected' : ''}`}
            data-paint="graphite"
            aria-label="Graphite paint"
            aria-pressed={choice.paintId === 'graphite'}
            onClick={() => game.selection.choosePaint('graphite')}
          ></button>
          <button
            className={`paint-swatch cobalt${choice.paintId === 'cobalt' ? ' selected' : ''}`}
            data-paint="cobalt"
            aria-label="Cobalt paint"
            aria-pressed={choice.paintId === 'cobalt'}
            onClick={() => game.selection.choosePaint('cobalt')}
          ></button>
          <button
            className={`paint-swatch crimson${choice.paintId === 'crimson' ? ' selected' : ''}`}
            data-paint="crimson"
            aria-label="Crimson paint"
            aria-pressed={choice.paintId === 'crimson'}
            onClick={() => game.selection.choosePaint('crimson')}
          ></button>
        </div>
      </div>
      <button
        id="confirm-ship-button"
        onClick={() => game.closeShipSelection(true)}
        className="primary-button"
      >
        USE THIS SHIP <span>✓</span>
      </button>
    </section>
  );
}
