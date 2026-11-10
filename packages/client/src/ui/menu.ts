import { GAME_CATALOG, type GameId } from '@arena/shared';
import { LANGS, lang, setLang, t } from '../i18n';
import { h } from './dom';

export interface MenuApi {
  /** Status line under the title: online count, connecting, offline… */
  setStatus(text: string, kind: 'online' | 'busy' | 'offline'): void;
  /** Disable PLAY with a label while connecting. */
  setBusy(label: string | null): void;
  /** Show a secondary "play offline" button (after a failed connection). */
  offerOffline(onClick: () => void): void;
}

/**
 * Step-1/2 menu: nickname + play. The full landing page (all 7 games, prize
 * pool, charity counter, leaderboards) is built in step 5.
 */
export function renderMenu(host: HTMLElement, onPlay: (game: GameId, name: string) => void, onRerender?: (api: MenuApi) => void): MenuApi {
  const game = GAME_CATALOG.find((g) => g.id === 'blob')!;
  let saved = '';
  try {
    saved = localStorage.getItem('nick') ?? '';
  } catch {
    /* ignore */
  }
  const input = h('input.field', { id: 'nick', maxlength: '16', placeholder: t('nickname'), 'aria-label': t('nickname'), autocomplete: 'off' });
  input.value = saved;
  const play = h('button.btn-play', {}, t('play'));
  const offline = h('button.btn-ghost.hidden', { style: 'width:100%;margin-top:10px' });
  const status = h('p.status', { role: 'status' });
  const go = () => {
    if (play.disabled) return;
    const name = input.value.trim().slice(0, 16) || `Guest${Math.floor(Math.random() * 9000 + 1000)}`;
    try {
      localStorage.setItem('nick', name);
    } catch {
      /* ignore */
    }
    onPlay(game.id, name);
  };
  play.addEventListener('click', go);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());

  const langs = h('div.lang');
  for (const l of LANGS) {
    const b = h('button', { 'aria-pressed': String(l.id === lang()) }, l.label);
    b.addEventListener('click', () => {
      setLang(l.id);
      const api = renderMenu(host, onPlay, onRerender);
      onRerender?.(api);
    });
    langs.append(b);
  }

  const card = h(
    'div.menu-card',
    {},
    h('h1.logo', {}, 'STAKE ARENA'),
    h('p.subtitle', {}, t('tagline')),
    status,
    h('div.game-pill', { style: `--accent:${game.accent}` }, h('div.dot'), h('div', {}, h('b', {}, game.name), h('span', {}, t('blobTagline')))),
    input,
    play,
    offline,
    h('p.keys', {}, t('keysHelp', { dash: 'Space', shield: 'E', cash: 'Q' })),
    langs,
    h('p.disclaimer', {}, t('disclaimer')),
  );
  host.replaceChildren(h('div.menu', {}, card));
  if (matchMedia('(pointer: fine)').matches) input.focus();

  return {
    setStatus(text, kind) {
      status.textContent = text;
      status.dataset.kind = kind;
    },
    setBusy(label) {
      play.disabled = label !== null;
      play.textContent = label ?? t('play');
    },
    offerOffline(onClick) {
      offline.textContent = t('playOffline');
      offline.classList.remove('hidden');
      offline.onclick = onClick;
    },
  };
}
