import '../../../packages/client/src/styles/tokens.css';
import '../../../packages/client/src/styles/app.css';
import { GameScreen } from '../../../packages/client/src/ui/game-screen';
import { SCENARIOS } from './scenarios';

const name = new URLSearchParams(location.search).get('scenario') ?? 'volt';
const make = SCENARIOS[name];
if (!make) throw new Error(`unknown scenario ${name}`);
const session = make();
new GameScreen(document.getElementById('app')!, session.gameId, session, () => undefined);
(window as unknown as { captureReady: boolean }).captureReady = true;
