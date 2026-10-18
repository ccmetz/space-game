import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Game } from '../game.ts';
import { promenade, rooms } from '../station/station.ts';

export function Station({ game, themeSelector }: { game: Game; themeSelector: ReactNode }) {
  const state = useSyncExternalStore(game.station.subscribe, game.station.getSnapshot);
  const character = useSyncExternalStore(game.character.subscribe, game.character.getSnapshot);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) return game.station.start(canvas.current, game.character.getSnapshot());
  }, [game]);
  const room = rooms.find((item) => item.name === state.room) ?? promenade;
  return (
    <main className="station-app">
      <canvas
        ref={canvas}
        className="station-canvas"
        aria-label="Third-person space station with a circular promenade and branching rooms"
      />
      <header className="station-header">
        <div>
          <span className="eyebrow">STARBOUND / WAYFARER STATION</span>
          <h1>{room.name}</h1>
          <p>{room.description}</p>
        </div>
        <div className="station-actions">
          {themeSelector}
          <button onClick={game.station.togglePause}>{state.paused ? 'Resume' : 'Pause'}</button>
        </div>
      </header>
      <aside className="station-map" aria-label="Station directory">
        <span className="eyebrow">HABITAT RING / DECK 01</span>
        <svg viewBox="0 0 160 160" aria-label={`You are in ${state.room}`}>
          <circle
            cx="80"
            cy="80"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            opacity="0.3"
          />
          {rooms.map((item) => {
            const x = 80 + Math.sin(item.angle) * 51;
            const y = 80 + Math.cos(item.angle) * 51;
            return (
              <g key={item.code}>
                <path
                  d={`M ${80 + Math.sin(item.angle) * 33} ${80 + Math.cos(item.angle) * 33} L ${x} ${y}`}
                  stroke="currentColor"
                  strokeWidth="6"
                  opacity="0.3"
                />
                <rect
                  x={x - 11}
                  y={y - 11}
                  width="22"
                  height="22"
                  rx="3"
                  fill={state.room === item.name ? item.color : '#243e52'}
                  stroke={item.color}
                />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fill={state.room === item.name ? '#102030' : '#e2edf2'}
                >
                  {item.code}
                </text>
              </g>
            );
          })}
          <g
            transform={`translate(${80 + state.x} ${80 + state.z}) rotate(${(-state.heading * 180) / Math.PI})`}
          >
            <path
              d="M 0 5 L -3 -3 L 0 -1 L 3 -3 Z"
              fill="#ffffff"
              stroke="#73d4e8"
              strokeWidth="1"
            />
          </g>
        </svg>
        <div className="station-directory">
          {rooms.map((item) => (
            <span key={item.code} aria-current={state.room === item.name ? 'location' : undefined}>
              {item.code} · {item.name}
            </span>
          ))}
        </div>
      </aside>
      <section className="station-status" aria-label="Station controls">
        <p>Welcome aboard, {character.name}.</p>
        <p className="station-hint">
          WASD walk · Drag to look · Q / R turn · Shift run · E interact · Esc pause
        </p>
        {!character.saved && (
          <p role="status">Your character could not be saved and is available for this visit.</p>
        )}
        {!state.ready && <p role="status">Entering the station…</p>}
        {state.nearby && (
          <button disabled={state.paused} onClick={game.station.interact}>
            {state.nearby} [E]
          </button>
        )}
        {state.dialogue && (
          <p role="status" className="station-dialogue">
            {state.dialogue}
          </p>
        )}
      </section>
      <div className="station-walk" aria-label="Touch walking controls">
        {[
          ['KeyW', '↑', 'Walk forward'],
          ['KeyA', '←', 'Walk left'],
          ['KeyS', '↓', 'Walk backward'],
          ['KeyD', '→', 'Walk right'],
          ['KeyQ', '↶', 'Turn camera left'],
          ['KeyR', '↷', 'Turn camera right'],
        ].map(([key, symbol, label]) => (
          <button
            key={key}
            aria-label={label}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              game.station.press(key);
            }}
            onPointerUp={() => game.station.release(key)}
            onPointerCancel={() => game.station.release(key)}
            onLostPointerCapture={() => game.station.release(key)}
          >
            {symbol}
          </button>
        ))}
      </div>
      {state.paused && (
        <div className="station-pause">
          <h2>Station paused</h2>
          <button className="primary-button" onClick={game.station.togglePause}>
            Resume exploring
          </button>
          <button className="secondary-button" onClick={game.character.edit}>
            Edit character
          </button>
        </div>
      )}
      {state.error && (
        <div id="error" role="alert">
          {state.error}
        </div>
      )}
    </main>
  );
}
