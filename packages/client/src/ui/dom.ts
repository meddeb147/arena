type TagOf<S extends string> = S extends `${infer T}.${string}` ? T : S;
type ElOf<S extends string> = TagOf<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagOf<S>] : HTMLElement;

/** Tiny DOM helper: h('div.cls', {attr}, ...children). Text is always set via text nodes (no HTML injection). */
export function h<S extends string>(tag: S, attrs: Record<string, string> = {}, ...children: (Node | string)[]): ElOf<S> {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name!);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el as ElOf<S>;
}
