import type { ClipboardEvent, FormEvent, KeyboardEvent, RefObject } from 'react';
import { Keyboard } from 'lucide-react';

interface TypingSurfaceProps {
  inputRef: RefObject<HTMLInputElement | null>;
  isListening: boolean;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onInput: (event: FormEvent<HTMLInputElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (event: FormEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}

export function TypingSurface({
  inputRef,
  isListening,
  onKeyDown,
  onInput,
  onCompositionStart,
  onCompositionEnd,
  onPaste,
}: TypingSurfaceProps) {
  return (
    <label className="typing-surface" data-active={isListening ? 'true' : 'false'}>
      <Keyboard aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="typing-surface__label">
        {isListening ? 'Type here' : 'Typing paused'}
      </span>
      <input
        ref={inputRef}
        className="typing-surface__input"
        aria-label="WORDaVOID typing input"
        aria-describedby="typing-surface-help"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="done"
        inputMode="text"
        spellCheck={false}
        disabled={!isListening}
        autoFocus={isListening}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onPaste={onPaste}
      />
      <span id="typing-surface-help" className="sr-only">
        Type one English letter at a time. Pasting, composition text, and modified shortcuts are ignored.
      </span>
    </label>
  );
}
