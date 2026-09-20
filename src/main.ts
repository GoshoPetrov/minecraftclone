import './ui/styles.css';

import { Game } from './app/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (canvas === null) {
  throw new Error('Game canvas element was not found in the document.');
}

const game = new Game({ canvas });
game.start();

// Stop the loop when the page is being unloaded so the loop cannot outlive
// the document.
window.addEventListener('beforeunload', () => {
  game.stop();
});
