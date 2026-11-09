import { en, type Dict } from './en';
import { fr } from './fr';
import { ar } from './ar';

export type Lang = 'en' | 'fr' | 'ar';
const DICTS: Record<Lang, Dict> = { en, fr, ar };
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'fr', label: 'FR' },
  { id: 'ar', label: 'عربي' },
];

let current: Lang = detect();

function detect(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'fr' || saved === 'ar') return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = (navigator.language || 'en').slice(0, 2);
  return nav === 'fr' || nav === 'ar' ? nav : 'en';
}

export function lang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  current = l;
  try {
    localStorage.setItem('lang', l);
  } catch {
    /* ignore */
  }
  applyDir();
}

export function applyDir(): void {
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
}

/** Translate a key, replacing {name} placeholders. */
export function t(key: keyof Dict, vars: Record<string, string | number> = {}): string {
  const s = DICTS[current][key] ?? en[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
