import { useEffect, useState } from 'react';
import { BookOpen, PanelLeft, PanelRight } from 'lucide-react';
import { useMatch } from '@/state/store';
import { ArenaPanel } from './ArenaPanel';
import { Controls } from './Controls';
import { EditorPanel } from './EditorPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { Leaderboard } from './Leaderboard';
import { LogConsole } from './LogConsole';
import { ManualModal, type ManualLang } from './ManualModal';
import { cn } from './cn';

// Phones start with both side panels collapsed so the arena is front-and-centre.
const MOBILE_AT_LOAD =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 767px)').matches;

const isMobile = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 767px)').matches;

const TOGGLE_BTN =
  'grid size-8 place-items-center rounded-lg bg-surface-2 text-fg transition hover:brightness-125';

export function App() {
  const loadFromCode = useMatch((s) => s.loadFromCode);
  const [manualLang, setManualLang] = useState<ManualLang | null>(null);
  const [leftOpen, setLeftOpen] = useState(!MOBILE_AT_LOAD);
  const [rightOpen, setRightOpen] = useState(!MOBILE_AT_LOAD);

  // Load a shared match from the URL hash (#m=<code>) on first mount.
  useEffect(() => {
    const m = /[#&]m=([^&]+)/.exec(window.location.hash);
    if (m?.[1]) loadFromCode(decodeURIComponent(m[1]));
  }, [loadFromCode]);

  // When the viewport crosses the mobile breakpoint, reset to that mode's sensible
  // default (desktop: both docked; mobile: both collapsed) so drawers can't overlap.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = (e: MediaQueryListEvent): void => {
      setLeftOpen(!e.matches);
      setRightOpen(!e.matches);
    };
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // On phones only one drawer fits at a time, so opening one closes the other.
  const toggleLeft = (): void => {
    setLeftOpen((v) => !v);
    if (isMobile()) setRightOpen(false);
  };
  const toggleRight = (): void => {
    setRightOpen((v) => !v);
    if (isMobile()) setLeftOpen(false);
  };

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 md:px-5">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={toggleLeft}
            className={cn(TOGGLE_BTN, leftOpen && 'text-accent')}
            aria-pressed={leftOpen}
            aria-label="Toggle code panel"
            title="Show/hide the code panel"
          >
            <PanelLeft className="size-4" />
          </button>
          <h1 className="text-base font-semibold tracking-tight">elecxarium</h1>
          <span className="hidden text-xs text-muted sm:inline">code-your-creature ecosystem battle</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted md:gap-4">
          <span className="hidden lg:inline">inspired by Microsoft .NET Terrarium</span>
          <button
            type="button"
            onClick={() => setManualLang('en')}
            className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-fg transition hover:brightness-125"
          >
            <BookOpen className="size-3.5" /> <span className="hidden sm:inline">Manual</span>
          </button>
          <button
            type="button"
            onClick={toggleRight}
            className={cn(TOGGLE_BTN, rightOpen && 'text-accent')}
            aria-pressed={rightOpen}
            aria-label="Toggle results panel"
            title="Show/hide the leaderboard & log"
          >
            <PanelRight className="size-4" />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Code panel — docked column on desktop, slide-over drawer on mobile. */}
        <div
          className={cn(
            'flex min-h-0 flex-col border-border bg-bg',
            'absolute inset-y-0 left-0 z-30 w-[88%] max-w-md border-r shadow-2xl transition-transform duration-200',
            leftOpen ? 'translate-x-0' : '-translate-x-full',
            'md:static md:z-auto md:max-w-[640px] md:translate-x-0 md:shadow-none md:transition-none',
            leftOpen ? 'md:flex md:w-[34%] md:min-w-[300px]' : 'md:hidden',
          )}
        >
          <ErrorBoundary label="Editor">
            <EditorPanel />
          </ErrorBoundary>
        </div>

        <div className="min-w-0 flex-1">
          <ErrorBoundary label="Arena">
            <ArenaPanel />
          </ErrorBoundary>
        </div>

        {/* Results panel — docked column on desktop, slide-over drawer on mobile. */}
        <aside
          className={cn(
            'flex min-h-0 flex-col border-border bg-bg',
            'absolute inset-y-0 right-0 z-30 w-[88%] max-w-md border-l shadow-2xl transition-transform duration-200',
            rightOpen ? 'translate-x-0' : 'translate-x-full',
            'md:static md:z-auto md:max-w-[420px] md:translate-x-0 md:shadow-none md:transition-none',
            rightOpen ? 'md:flex md:w-[26%] md:min-w-[240px]' : 'md:hidden',
          )}
        >
          <div className="min-h-0 flex-[3]">
            <ErrorBoundary label="Leaderboard">
              <Leaderboard />
            </ErrorBoundary>
          </div>
          <div className="min-h-0 flex-[2] border-t border-border">
            <ErrorBoundary label="Log">
              <LogConsole />
            </ErrorBoundary>
          </div>
        </aside>

        {/* Mobile-only backdrop: tap outside an open drawer to close it. */}
        {(leftOpen || rightOpen) && (
          <button
            type="button"
            aria-label="Close panels"
            className="absolute inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
      </div>

      <footer className="border-t border-border bg-surface/30">
        <ErrorBoundary label="Controls">
          <Controls />
        </ErrorBoundary>
      </footer>

      {manualLang && (
        <ManualModal lang={manualLang} onClose={() => setManualLang(null)} onLang={setManualLang} />
      )}
    </div>
  );
}
