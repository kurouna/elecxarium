import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';

export type ManualLang = 'en' | 'ja';

/** In-app manual: renders the static manual HTML in an iframe inside a dialog. */
export function ManualModal({
  lang,
  onClose,
  onLang,
}: {
  lang: ManualLang;
  onClose: () => void;
  onLang: (l: ManualLang) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Manual"
    >
      <div
        className="flex h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">Manual</span>
            <div className="flex gap-1">
              {(['en', 'ja'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onLang(l)}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs transition',
                    l === lang ? 'bg-accent text-[#06121a]' : 'bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {l === 'en' ? 'English' : '日本語'}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Close manual"
          >
            <X className="size-4" />
          </button>
        </div>
        <iframe
          key={lang}
          src={`manual.${lang}.html`}
          title="elecxarium manual"
          className="min-h-0 flex-1 border-0 bg-bg"
          onLoad={(e) => {
            // The modal already provides Close + a language toggle, so hide the manual's own
            // top-bar. Its "Back to app" / language links target the iframe itself, which would
            // otherwise load the whole app *inside* this modal (the reported nesting bug).
            try {
              e.currentTarget.contentDocument?.querySelector('.topbar')?.setAttribute('style', 'display:none');
            } catch {
              /* same-origin manual, so this should not throw; ignore if it ever does */
            }
          }}
        />
      </div>
    </div>
  );
}
