import { DEFAULT_FEATURES, GAME_CATALOG, type GameCatalogEntry, type GameId } from '@arena/shared';
import { LANGS, lang, setLang, t } from '../i18n';
import type { Dict } from '../i18n/en';
import type { ServerStats } from '../net/server';
import { h } from './dom';
import { LivePreview, drawArt } from './previews';
import type { Challenge } from './share';
import { PLAYER_COLORS } from '@arena/engine';
import { COLOR_UNLOCK, colorUnlocked, levelFor, loadProgress, saveProgress, xpForLevel } from '../progress';
import { formatCredits } from '@arena/shared';

export type ConnState = { kind: 'online'; stats: ServerStats } | { kind: 'busy'; text: string } | { kind: 'offline'; text: string };

export interface Landing {
  setConn(state: ConnState): void;
  dispose(): void;
}

const FEATURED: GameId = 'volt';

/** The landing page: hero, all games, how it works, fair play. */
export function renderLanding(host: HTMLElement, onPlay: (game: GameId, name: string) => void, onLang: () => void, challenge: Challenge | null = null, online = false): Landing {
  const previews: LivePreview[] = [];
  const counters = new Map<GameId, HTMLElement>();
  const games = [...GAME_CATALOG].sort((a, b) => Number(b.available) - Number(a.available));

  let saved = '';
  try {
    saved = localStorage.getItem('nick') ?? '';
  } catch {
    /* ignore */
  }
  const nick = h('input.field', { id: 'nick', maxlength: '16', placeholder: t('nickname'), 'aria-label': t('nickname'), autocomplete: 'off' });
  nick.value = saved;
  const name = () => {
    const n = nick.value.trim().slice(0, 16) || `Guest${Math.floor(Math.random() * 9000 + 1000)}`;
    try {
      localStorage.setItem('nick', n);
    } catch {
      /* ignore */
    }
    return n;
  };
  const play = (id: GameId) => onPlay(id, name());

  // header
  const status = h('span.status', { role: 'status' });
  const langs = h('div.lang');
  for (const l of LANGS) {
    const b = h('button', { 'aria-pressed': String(l.id === lang()) }, l.label);
    b.addEventListener('click', () => {
      setLang(l.id);
      onLang();
    });
    langs.append(b);
  }
  const header = h('header.l-header', {}, h('div.l-wrap.l-header-row', {}, h('a.l-logo', { href: '#top' }, 'STAKE ARENA'), status, langs));

  // hero
  const playNow = h('button.btn-play', {}, t('playNow'));
  playNow.addEventListener('click', () => play(FEATURED));
  nick.addEventListener('keydown', (e) => e.key === 'Enter' && play(FEATURED));
  const heroCanvas = h('canvas.l-hero-canvas', { 'aria-hidden': 'true' });
  const featured = GAME_CATALOG.find((g) => g.id === FEATURED)!;
  const hero = h(
    'section.l-hero',
    { id: 'top' },
    h(
      'div.l-wrap.l-hero-grid',
      {},
      h(
        'div.l-hero-copy',
        {},
        ...(challenge ? [challengeBanner(challenge)] : []),
        h('h1.l-title', {}, t('heroTitle')),
        h('p.l-lead', {}, t('heroText')),
        h('div.l-join', {}, nick, playNow),
        profile(),
        h('p.disclaimer', {}, t('disclaimer')),
      ),
      h('div.l-hero-stage', { style: `--accent:${featured.accent}` }, heroCanvas, h('span.l-hero-tag', {}, featured.name)),
    ),
  );

  // games
  const grid = h('div.l-games');
  for (const g of games) grid.append(card(g));
  const gamesSec = h('section.l-section', { id: 'games' }, h('div.l-wrap', {}, h('h2.l-h2', {}, t('pickArena')), grid));

  // how it works (a real sequence, so it is numbered)
  const steps = h('ol.l-steps');
  ([1, 2, 3, 4] as const).forEach((n) => {
    steps.append(h('li.l-step', {}, h('b', {}, t(`step${n}Title` as keyof Dict)), h('p', {}, t(`step${n}Text` as keyof Dict))));
  });
  const how = h('section.l-section', { id: 'how' }, h('div.l-wrap', {}, h('h2.l-h2', {}, t('howItWorks')), steps));

  // fair play
  const fair = h('div.l-fair');
  ([1, 2, 3] as const).forEach((n) => {
    const soon = (n === 2 && !DEFAULT_FEATURES.weeklyPrizes) || n === 3;
    fair.append(h(`div.l-fair-item${soon ? '.soon' : ''}`, {}, h('b', {}, t(`fair${n}Title` as keyof Dict)), h('p', {}, t(`fair${n}Text` as keyof Dict))));
  });
  const fairSec = h('section.l-section', { id: 'fair' }, h('div.l-wrap', {}, h('h2.l-h2', {}, t('fairPlay')), fair));

  const footer = h(
    'footer.l-footer',
    {},
    h(
      'div.l-wrap',
      {},
      h('p.disclaimer', {}, t('disclaimer')),
      h('p', {}, t('takeBreak')),
      h('p', {}, h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, t('privacy')), ' · ', h('a', { href: 'https://github.com/meddeb147/arena', target: '_blank', rel: 'noopener' }, t('sourceCode'))),
    ),
  );

  const page = h('div.landing', {}, header, hero, gamesSec, how, fairSec, footer);
  host.replaceChildren(page);

  // start previews after layout so canvases have a size
  requestAnimationFrame(() => {
    previews.push(new LivePreview(heroCanvas, FEATURED, 12));
    for (const g of games) {
      const c = grid.querySelector<HTMLCanvasElement>(`canvas[data-game="${g.id}"]`);
      if (!c) continue;
      if (g.available) previews.push(new LivePreview(c, g.id, 8));
      else drawArt(c, g.id, g.accent, g.bg);
    }
  });
  if (matchMedia('(pointer: fine)').matches && !saved) nick.focus({ preventScroll: true });

  /** Level, streak, bank, daily missions and colour picker (all stored on this device). */
  function profile(): HTMLElement {
    const p = loadProgress();
    const lvl = levelFor(p.xp);
    const from = xpForLevel(lvl);
    const to = xpForLevel(lvl + 1);
    let bank = 1000;
    try {
      const b = Number(localStorage.getItem('bank'));
      if (Number.isFinite(b) && localStorage.getItem('bank') !== null) bank = b;
    } catch {
      /* ignore */
    }
    const bar = h('div.xp-bar', { role: 'progressbar', 'aria-valuenow': String(p.xp - from), 'aria-valuemax': String(to - from) }, h('i', { style: `width:${Math.round(((p.xp - from) / (to - from)) * 100)}%` }));
    const top = h(
      'div.p-top',
      {},
      h('span.p-level', {}, t('level', { n: lvl })),
      bar,
      h('span.p-chip', {}, t('dayStreak', { n: p.streak })),
      h('span.p-chip.bank', {}, `🏦 ${t('bank')} ${formatCredits(bank)}`),
    );
    const missions = h('ul.p-missions');
    for (const m of p.missions) {
      missions.append(
        h(`li${m.done ? '.done' : ''}`, {}, h('span', {}, m.done ? '✅' : '🎯'), h('span.txt', {}, t(`m_${m.id}` as keyof Dict, { n: formatCredits(m.goal) })), h('b', {}, `${formatCredits(Math.min(m.value, m.goal))}/${formatCredits(m.goal)}`)),
      );
    }
    const colors = h('div.p-colors', { role: 'radiogroup', 'aria-label': t('yourColor') });
    PLAYER_COLORS.forEach((c, i) => {
      const open = colorUnlocked(p, i);
      const sw = h(`button.swatch${i === p.color ? '.on' : ''}${open ? '' : '.locked'}`, { type: 'button', role: 'radio', 'aria-checked': String(i === p.color), style: `--c:#${c.toString(16).padStart(6, '0')}`, title: open ? '' : t('unlockAt', { n: COLOR_UNLOCK[i]! }) }, open ? '' : h('small', {}, `🔒${COLOR_UNLOCK[i]}`));
      sw.disabled = !open;
      sw.addEventListener('click', () => {
        p.color = i;
        saveProgress();
        colors.querySelectorAll('.swatch').forEach((el, k) => {
          el.classList.toggle('on', k === i);
          el.setAttribute('aria-checked', String(k === i));
        });
      });
      colors.append(sw);
    });
    return h('div.profile', {}, top, h('div.p-label', {}, t('missionsTitle')), missions, h('div.p-label', {}, t('yourColor')), colors);
  }

  function challengeBanner(c: Challenge): HTMLElement {
    const game = GAME_CATALOG.find((g) => g.id === c.g)!;
    const go = h('button.btn-card', { style: `--accent:${game.accent}` }, t('acceptChallenge'));
    go.addEventListener('click', () => play(c.g));
    return h('div.challenge', {}, h('span', {}, t('challengeBanner', { name: c.n, peak: formatCredits(c.p), game: game.name, kos: c.k })), go);
  }

  function card(g: GameCatalogEntry): HTMLElement {
    const canvas = h('canvas.l-card-canvas', { 'data-game': g.id, 'aria-hidden': 'true' });
    const count = h('span.l-count');
    counters.set(g.id, count);
    const chips = h('div.l-chips', {}, ...g.skills.map((s) => h('span.chip', {}, s.name)), ...g.hazards.map((z) => h('span.chip.hz', {}, z)));
    const action = g.available ? h('button.btn-card', {}, t('play')) : h('span.btn-card.soon', {}, t('comingSoon'));
    if (g.available) action.addEventListener('click', () => play(g.id));
    const friends = h('button.btn-friends', { type: 'button' }, t('playWithFriends'));
    const note = h('p.friends-note');
    friends.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!online) {
        note.textContent = t('friendsNeedServer');
        return;
      }
      const code = newRoomCode();
      history.replaceState(null, '', `${location.pathname}?room=${code}#${g.id}`);
      const link = `${location.origin}${location.pathname}?room=${code}#${g.id}`;
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* the HUD chip offers the link again */
      }
      play(g.id);
    });
    const el = h(
      `article.l-card${g.available ? '' : '.is-soon'}`,
      { style: `--accent:${g.accent}` },
      h('div.l-card-media', {}, canvas, count),
      h('div.l-card-body', {}, h('h3', {}, g.name), h('p', {}, t(`tag_${g.id}` as keyof Dict)), chips, h('div.card-actions', {}, action, g.available ? friends : ''), note),
    );
    if (g.available) {
      el.addEventListener('click', (e) => {
        if (e.target === action) return;
        play(g.id);
      });
      el.tabIndex = 0;
      el.addEventListener('keydown', (e) => e.key === 'Enter' && play(g.id));
    }
    return el;
  }

  return {
    setConn(state) {
      status.dataset.kind = state.kind;
      if (state.kind === 'online') {
        status.textContent = t('onlineCount', { n: state.stats.online });
        for (const [id, el] of counters) {
          const n = state.stats.games?.[id];
          el.textContent = n ? t('playingNow', { n }) : '';
        }
      } else status.textContent = state.text;
    },
    dispose() {
      for (const p of previews) p.dispose();
    },
  };
}

/** 5-character room code without look-alike characters (no I, O, 0, 1). */
export function newRoomCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}
