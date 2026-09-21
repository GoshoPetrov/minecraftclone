import './ui/styles.css';

import { Game } from './app/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (canvas === null) {
  throw new Error('Game canvas element was not found in the document.');
}

const overlay = document.querySelector<HTMLElement>('#play-overlay');
const notices = document.querySelector<HTMLElement>('#notices');
const debug = document.querySelector<HTMLElement>('#debug-readout');

const game = await Game.create({
  canvas,
  ...(overlay === null ? {} : { overlay }),
  ...(notices === null ? {} : { notices }),
  ...(debug === null ? {} : { debug }),
});
game.start();

// Stop the loop when the page is being unloaded so the loop cannot outlive
// the document.
window.addEventListener('beforeunload', () => {
  game.stop();
});
