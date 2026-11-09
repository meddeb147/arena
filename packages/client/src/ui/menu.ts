import { GAME_CATALOG, type GameId } from '@arena/shared';
import { LANGS, lang, setLang, t } from '../i18n';
import { h } from './dom';

/**
 * Step-1 menu: nickname + play. The full landing page (all 7 games, prize
 * pool, charity counter, leaderboards) is built in step 5.
 */
export function renderMenu(host: HTMLElement, onPlay: (game: GameId, name: string) => void): void {
  const game = GAME_CATALOG.find((g) => g.id === 'blob')!;
  let saved = '';
  try {
    saved = localStorage.getItem('nick') ?? '';
  } catch {
    /* ignore */
  }
  const input = h('input.field', { maxlength: '16', placeholder: t('nickname'), 'aria-label': t('nickname'), autocomplete: 'off' });
  input.value = saved;
  const play = h('button.btn-play', {}, t('play'));
  const go = () => {
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
      renderMenu(host, onPlay);
    });
    langs.append(b);
  }

  const card = h(
    'div.menu-card',
    {},
    h('h1.logo', {}, 'STAKE ARENA'),
    h('p.subtitle', {}, t('tagline')),
    h('div.game-pill', { style: `--accent:${game.accent}` }, h('div.dot'), h('div', {}, h('b', {}, game.name), h('span', {}, t('blobTagline')))),
    input,
    play,
    h('p.keys', {}, t('keysHelp', { dash: 'Space', shield: 'E', cash: 'Q' })),
    langs,
    h('p.disclaimer', {}, t('disclaimer')),
  );
  host.replaceChildren(h('div.menu', {}, card));
  if (matchMedia('(pointer: fine)').matches) input.focus();
}
