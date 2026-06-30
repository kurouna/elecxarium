import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useMatch } from '@/state/store';
import { ArenaPanel } from './ArenaPanel';
import { Controls } from './Controls';
import { EditorPanel } from './EditorPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { Leaderboard } from './Leaderboard';
import { LogConsole } from './LogConsole';
import { ManualModal, type ManualLang } from './ManualModal';

export function App() {
  const loadFromCode = useMatch((s) => s.loadFromCode);
  const [manualLang, setManualLang] = useState<ManualLang | null>(null);

  // Load a shared match from the URL hash (#m=<code>) on first mount.
  useEffect(() => {
    const m = /[#&]m=([^&]+)/.exec(window.location.hash);
    if (m?.[1]) loadFromCode(decodeURIComponent(m[1]));
  }, [loadFromCode]);

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-border px-5 py-2.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold tracking-tight">elecxarium</h1>
          <span className="text-xs text-muted">code-your-creature ecosystem battle</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="hidden md:inline">inspired by Microsoft .NET Terrarium</span>
          <button
            type="button"
            onClick={() => setManualLang('en')}
            className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-fg transition hover:brightness-125"
          >
            <BookOpen className="size-3.5" /> Manual
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-[34%] min-w-[300px] max-w-[640px] border-r border-border">
          <ErrorBoundary label="Editor">
            <EditorPanel />
          </ErrorBoundary>
        </div>
        <div className="min-w-0 flex-1">
          <ErrorBoundary label="Arena">
            <ArenaPanel />
          </ErrorBoundary>
        </div>
        <aside className="flex w-[25%] min-w-[240px] max-w-[420px] flex-col border-l border-border">
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
