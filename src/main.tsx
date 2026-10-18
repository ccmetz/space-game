import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './game.ts';
import { App } from './ui/App.tsx';
import { element } from './ui/dom.ts';

const game = createGame();
const root = createRoot(element('root'));
root.render(
  <StrictMode>
    <App game={game} />
  </StrictMode>,
);
