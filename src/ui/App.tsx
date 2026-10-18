import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Game } from '../game.ts';
import { CharacterCreation } from './CharacterCreation.tsx';
import { Hud } from './Hud.tsx';
import { Menus } from './Menus.tsx';
import { ShipSelection } from './ShipSelection.tsx';
import { TouchControls } from './TouchControls.tsx';

export function App({ game }: { game: Game }) {
  const character = useSyncExternalStore(game.character.subscribe, game.character.getSnapshot);
  return character.confirmed ? <FlightApp game={game} /> : <CharacterCreation game={game} />;
}

function FlightApp({ game }: { game: Game }) {
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
      <Menus game={game} session={session} />
      <Hud game={game} session={session} markerRef={markerRef} />
      <ShipSelection game={game} choosingShip={session.choosingShip} />
      <TouchControls game={game} />
      <div id="error" role="alert" hidden={!session.error}>
        {session.error}
      </div>
    </div>
  );
}
