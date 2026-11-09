import './styles/tokens.css';
import './styles/app.css';
import { applyDir } from './i18n';
import { LocalSession } from './net/local';
import { GameScreen } from './ui/game-screen';
import { renderMenu } from './ui/menu';

const app = document.getElementById('app')!;
applyDir();

function showMenu(): void {
  renderMenu(app, (gameId, name) => {
    // Step 1: authoritative engine runs locally. Step 2 swaps in NetSession.
    const session = new LocalSession(gameId, name);
    new GameScreen(app, gameId, session, showMenu);
  });
}

showMenu();
