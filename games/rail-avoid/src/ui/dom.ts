/** Tiny DOM helpers for the UI layer (no framework). */

export type Child = Node | string | number | null | undefined | false;
export type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

/** Create an element. Keys starting with "on" become listeners; "class" → className; "text" → textContent. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = String(v);
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'html') node.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'style') node.setAttribute('style', String(v));
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    }
  }
  append(node, children);
  return node;
}

export function append(node: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Write textContent only when it changed (avoids layout churn). */
export function setText(node: Element | null | undefined, text: string): void {
  if (!node) return;
  if (node.textContent !== text) node.textContent = text;
}

export function setWidth(node: HTMLElement | null | undefined, pct: number): void {
  if (!node) return;
  const w = Math.max(0, Math.min(100, Math.round(pct * 10) / 10)) + '%';
  if (node.style.width !== w) node.style.width = w;
}

export function toggleClass(node: Element | null | undefined, cls: string, on: boolean): void {
  if (!node) return;
  if (node.classList.contains(cls) !== on) node.classList.toggle(cls, on);
}

export function show(node: HTMLElement | null | undefined, visible: boolean): void {
  if (!node) return;
  if (node.hidden === visible) node.hidden = !visible;
}

export function setAttr(node: Element | null | undefined, name: string, value: string | null): void {
  if (!node) return;
  if (value === null) { if (node.hasAttribute(name)) node.removeAttribute(name); return; }
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function btn(label: string, onClick: (e: MouseEvent) => void, opts?: { class?: string; aria?: string; title?: string; disabled?: boolean }): HTMLButtonElement {
  const b = el('button', {
    class: 'rv-btn' + (opts?.class ? ' ' + opts.class : ''),
    type: 'button',
    'aria-label': opts?.aria ?? label,
    title: opts?.title,
    text: label,
  });
  if (opts?.disabled) b.disabled = true;
  b.addEventListener('click', (e) => onClick(e as MouseEvent));
  return b;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
}

export function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

export function hexColor(n: number): string { return '#' + (n & 0xffffff).toString(16).padStart(6, '0'); }

export function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/** Focusable elements inside a container (for focus trapping / initial focus). */
export function focusables(root: HTMLElement): HTMLElement[] {
  const list = root.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
  return Array.from(list).filter(e => !e.hidden && e.offsetParent !== null);
}

export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
