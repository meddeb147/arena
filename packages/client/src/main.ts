import './styles/tokens.css';
import './styles/app.css';
import './styles/landing.css';
import { GAME_CATALOG, type GameId } from '@arena/shared';
import { applyDir, t } from './i18n';
import { unlockAudio } from './audio/sfx';
import { LocalSession } from './net/local';
import { NetSession } from './net/net';
import { fetchStats, serverBase } from './net/server';
import { h } from './ui/dom';
import { GameScreen } from './ui/game-screen';
import { renderLanding, type ConnState, type Landing } from './ui/landing';

const app = document.getElementById('app')!;
applyDir();
// browsers allow audio only after a user gesture
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { capture: true });

const base = serverBase();
let landing: Landing | null = null;
let conn: ConnState = base ? { kind: 'busy', text: t('connecting') } : { kind: 'offline', text: t('offlineMode') };
let statsTimer = 0;

const playable = (id: string): id is GameId => GAME_CATALOG.some((g) => g.id === id && g.available);

function enterGame(gameId: GameId, session: LocalSession | NetSession): void {
  landing?.dispose();
  landing = null;
  clearInterval(statsTimer);
  history.replaceState(null, '', `#${gameId}`);
  new GameScreen(app, gameId, session, showLanding);
}

function playOffline(gameId: GameId, name: string): void {
  enterGame(gameId, new LocalSession(gameId, name));
}

/** Join online, with a small dialog while connecting (free hosts may need to wake up). */
function play(gameId: GameId, name: string): void {
  if (!base) return playOffline(gameId, name);
  const game = GAME_CATALOG.find((g) => g.id === gameId)!;
  const msg = h('p', {}, t('connecting'));
  const actions = h('div.row');
  const cancel = h('button.btn-ghost', {}, t('cancel'));
  actions.append(cancel);
  const dlg = h('div.overlay.connect', { role: 'dialog', 'aria-modal': 'true' }, h('div.card', { style: `--accent:${game.accent}` }, h('h2', {}, t('connectingTo', { game: game.name })), msg, actions));
  app.append(dlg);

  const session = new NetSession(gameId, name, base);
  let done = false;
  const finish = () => {
    done = true;
    clearTimeout(slow);
    clearTimeout(giveUp);
    dlg.remove();
  };
  const fail = () => {
    if (done) return;
    finish();
    session.dispose();
    const offline = h('button.btn-play', {}, t('playOffline'));
    offline.addEventListener('click', () => {
      err.remove();
      playOffline(gameId, name);
    });
    const close = h('button.btn-ghost', {}, t('cancel'));
    const err = h('div.overlay.connect', { role: 'dialog' }, h('div.card', {}, h('h2', {}, t('serverDown')), offline, h('div.row', { style: 'margin-top:10px' }, close)));
    close.addEventListener('click', () => err.remove());
    app.append(err);
  };
  const slow = setTimeout(() => (msg.textContent = t('waking')), 2500);
  const giveUp = setTimeout(fail, 75_000);
  cancel.addEventListener('click', () => {
    finish();
    session.dispose();
  });
  session.connected().then(
    () => {
      if (done) return;
      finish();
      enterGame(gameId, session);
    },
    fail,
  );
}

function showLanding(): void {
  landing?.dispose();
  landing = renderLanding(app, play, showLanding);
  landing.setConn(conn);
  void refreshStats();
  clearInterval(statsTimer);
  if (base) statsTimer = window.setInterval(() => void refreshStats(), 20_000);
}

async function refreshStats(): Promise<void> {
  if (!base) return;
  const slow = setTimeout(() => {
    if (conn.kind !== 'online') {
      conn = { kind: 'busy', text: t('waking') };
      landing?.setConn(conn);
    }
  }, 2500);
  const stats = await fetchStats(base);
  clearTimeout(slow);
  conn = stats ? { kind: 'online', stats } : { kind: 'offline', text: t('serverDown') };
  landing?.setConn(conn);
}

// direct links: https://…/#volt opens that game straight away
const fromHash = location.hash.slice(1);
showLanding();
if (playable(fromHash)) {
  let nick = '';
  try {
    nick = localStorage.getItem('nick') ?? '';
  } catch {
    /* ignore */
  }
  play(fromHash, nick || `Guest${Math.floor(Math.random() * 9000 + 1000)}`);
}
