import type { Game } from '../game.ts';

export function TouchControls({ game }: { game: Game }) {
  function control(key: string, label: string, content: string) {
    return (
      <button
        key={key}
        data-key={key}
        aria-label={label}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          game.pressControl(key);
        }}
        onPointerUp={() => game.releaseControl(key)}
        onPointerCancel={() => game.releaseControl(key)}
        onLostPointerCapture={() => game.releaseControl(key)}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="touch-controls" aria-label="Touch flight controls">
      <div className="touch-pad">
        {control('KeyW', 'Pitch up', '↑')}
        {control('KeyA', 'Turn left', '←')}
        {control('KeyS', 'Pitch down', '↓')}
        {control('KeyD', 'Turn right', '→')}
      </div>
      <div className="touch-speed">
        {control('ShiftLeft', 'Boost', 'BOOST')}
        {control('Space', 'Brake', 'BRAKE')}
      </div>
    </div>
  );
}
