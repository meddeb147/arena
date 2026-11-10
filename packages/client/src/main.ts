import './styles/tokens.css';
import './styles/app.css';
import type { GameId } from '@arena/shared';
import { applyDir, t } from './i18n';
import { LocalSession } from './net/local';
import { NetSession } from './net/net';
import { fetchStats, serverBase } from './net/server';
import { GameScreen } from './ui/game-screen';
import { renderMenu, type MenuApi } from './ui/menu';

const app = document.getElementById('app')!;
applyDir();

const base = serverBase();
let lastStatus: { text: string; kind: 'online' | 'busy' | 'offline' } | null = null;

function startGame(gameId: GameId, session: LocalSession | NetSession): void {
  new GameScreen(app, gameId, session, showMenu);
}

function playOffline(gameId: GameId, name: string): void {
  startGame(gameId, new LocalSession(gameId, name));
}

async function playOnline(menu: MenuApi, gameId: GameId, name: string): Promise<void> {
  if (!base) return playOffline(gameId, name);
  menu.setBusy(t('connecting'));
  const slow = setTimeout(() => menu.setStatus(t('waking'), 'busy'), 2500);
  const session = new NetSession(gameId, name, base);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 75_000));
  try {
    await Promise.race([session.connected(), timeout]);
    clearTimeout(slow);
    startGame(gameId, session);
  } catch {
    clearTimeout(slow);
    session.dispose();
    menu.setBusy(null);
    menu.setStatus(t('serverDown'), 'offline');
    menu.offerOffline(() => playOffline(gameId, name));
  }
}

function showMenu(): void {
  let menu: MenuApi;
  const apply = (api: MenuApi) => {
    menu = api;
    if (lastStatus) menu.setStatus(lastStatus.text, lastStatus.kind);
  };
  apply(renderMenu(app, (gameId, name) => void playOnline(menu, gameId, name), apply));
  void refreshStatus(() => menu);
}

async function refreshStatus(menu: () => MenuApi): Promise<void> {
  const set = (text: string, kind: 'online' | 'busy' | 'offline') => {
    lastStatus = { text, kind };
    menu().setStatus(text, kind);
  };
  if (!base) return set(t('offlineMode'), 'offline');
  set(t('connecting'), 'busy');
  const slow = setTimeout(() => set(t('waking'), 'busy'), 2500);
  const stats = await fetchStats(base);
  clearTimeout(slow);
  if (stats) set(t('onlineCount', { n: stats.online }), 'online');
  else set(t('serverDown'), 'offline');
}

showMenu();
