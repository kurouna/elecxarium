import { useEffect, useRef } from 'react';
import { useMatch } from '@/state/store';

export function LogConsole() {
  const logs = useMatch((s) => s.logs);
  const ref = useRef<HTMLDivElement>(null);

  // Keep the newest line in view as messages append.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="flex h-full flex-col bg-surface/20">
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Log
      </h2>
      <div ref={ref} className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-relaxed">
        {logs.length === 0 && <p className="text-muted">No messages yet.</p>}
        {logs.map((l) => (
          <div key={l.id} style={{ color: l.level === 'error' ? 'hsl(0 70% 70%)' : 'var(--color-muted)' }}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
