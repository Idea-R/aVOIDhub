/** Shared command convention: C continues, Enter activates focus, Escape backs out.
 * Letter shortcuts never consume browser combinations, typing, or auto-repeat. */
import { el, isTypingTarget } from './dom';
import './shortcuts.css';

export function commandKey(e: KeyboardEvent): string | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return null;
  return e.key.toLowerCase();
}

export function withHotkey(button: HTMLButtonElement, key: string): HTMLButtonElement {
  button.setAttribute('aria-keyshortcuts', key);
  button.title = `${button.getAttribute('aria-label') ?? button.textContent} (${key})`;
  button.append(el('kbd', { class: 'rv-command-key', text: key, 'aria-hidden': 'true' }));
  return button;
}
