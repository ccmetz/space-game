import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Game } from '../game.ts';
import { CharacterCreation } from './CharacterCreation.tsx';
import { Hud } from './Hud.tsx';
import { Menus } from './Menus.tsx';
import { ShipSelection } from './ShipSelection.tsx';
import { Station } from './Station.tsx';
import { TouchControls } from './TouchControls.tsx';

const themes = [
  { id: 'aurora', name: 'Aurora', description: 'Cyan / ice blue' },
  { id: 'nebula', name: 'Nebula', description: 'Violet / pink' },
  { id: 'solar', name: 'Solar', description: 'Amber / teal' },
];

export function App({ game }: { game: Game }) {
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('starbound.theme');
      return themes.find((item) => item.id === savedTheme)?.id ?? 'aurora';
    } catch {
      return 'aurora';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('starbound.theme', theme);
    } catch {
      // Theme changes still work for this visit when the browser blocks storage.
    }
  }, [theme]);

  const themeSelector = (
    <label className="theme-selector">
      <span>THEME</span>
      {/* Keep typing and arrow keys in the picker from also steering the ship. */}
      <select
        aria-label="Game theme"
        value={theme}
        onChange={(event) => setTheme(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {themes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.description}
          </option>
        ))}
      </select>
    </label>
  );
  const character = useSyncExternalStore(game.character.subscribe, game.character.getSnapshot);
  const location = useSyncExternalStore(game.location.subscribe, game.location.getSnapshot);
  if (!character.confirmed) return <CharacterCreation game={game} themeSelector={themeSelector} />;
  return location.scene === 'station' ? (
    <Station game={game} themeSelector={themeSelector} />
  ) : (
    <FlightApp game={game} themeSelector={themeSelector} />
  );
}

function FlightApp({ game, themeSelector }: { game: Game; themeSelector: ReactNode }) {
  const session = useSyncExternalStore(game.session.subscribe, game.session.getSnapshot);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);

  // React development remounts run this effect again. Its cleanup gives each mount
  // one game loop and removes the previous listeners and graphics resources.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return game.start(canvas, (position) => {
      // Move this marker every frame without asking React to render the whole HUD.
      const marker = markerRef.current;
      if (!marker) return;
      marker.hidden = position.hidden;
      marker.style.left = `${position.x}px`;
      marker.style.top = `${position.y}px`;
    });
  }, [game]);

  return (
    <div
      id="app"
      hidden={!session.ready}
      className={session.started ? 'flying' : session.choosingShip ? 'choosing-ship' : ''}
    >
      <canvas id="space" ref={canvasRef} aria-label="Three-dimensional space flight view" />
      <div className="vignette" />
      <Menus game={game} session={session} themeSelector={themeSelector} />
      <Hud game={game} session={session} markerRef={markerRef} />
      <ShipSelection game={game} choosingShip={session.choosingShip} />
      <TouchControls game={game} />
      <div id="error" role="alert" hidden={!session.error}>
        {session.error}
      </div>
    </div>
  );
}
