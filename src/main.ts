import { startGame } from './game.ts';
import { element } from './ui/dom.ts';

const app = element('app');
const error = element('error');

try {
  startGame(element<HTMLCanvasElement>('space'));
} catch (cause) {
  error.hidden = false;
  error.textContent = `Unable to start the flight. Please use a browser with WebGL 2 and hardware acceleration enabled. ${String(cause)}`;
  app.hidden = false;
}
