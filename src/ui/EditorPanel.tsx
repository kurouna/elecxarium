import { lazy, Suspense, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { TEMPLATES } from '@/templates';
import { useMatch, type EntryStatus } from '@/state/store';
import { cn } from './cn';

const MonacoEditor = lazy(() => import('./MonacoEditor'));

const HUE_PRESETS = [150, 330, 40, 210, 280, 100, 0, 190];

const EditorFallback = (
  <div className="grid h-full place-items-center text-xs text-muted">Loading editor…</div>
);

// Quiet when idle/ready (the colored dot before the name is the species color);
// only surface states that need attention.
function StatusDot({ status }: { status: EntryStatus }) {
  if (status === 'idle' || status === 'ready') return null;
  const color = status === 'error' ? 'hsl(0 70% 60%)' : 'hsl(45 90% 60%)';
  return <span className="size-1.5 rounded-full" title={status} style={{ background: color }} />;
}

export function EditorPanel() {
  const entries = useMatch((s) => s.entries);
  const activeId = useMatch((s) => s.activeId);
  const setActive = useMatch((s) => s.setActive);
  const setSource = useMatch((s) => s.setSource);
  const addEntry = useMatch((s) => s.addEntry);
  const removeEntry = useMatch((s) => s.removeEntry);
  const setHue = useMatch((s) => s.setHue);
  const saveCreatures = useMatch((s) => s.saveCreatures);
  const [saved, setSaved] = useState(false);
  const active = entries.find((e) => e.id === activeId) ?? entries[0];

  const onSave = (): void => {
    saveCreatures();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex h-full flex-col bg-surface/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActive(e.id)}
            title={`${e.title} — ${e.role}`}
            className={cn(
              'group flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition',
              e.id === active?.id ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
            )}
          >
            <span
              className="size-2 rounded-full"
              title="species color"
              style={{ background: `hsl(${e.hue} 72% 62%)` }}
            />
            <span>{e.title}</span>
            <StatusDot status={e.status} />
            {entries.length > 1 && (
              <span
                role="button"
                aria-label="Remove"
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeEntry(e.id);
                }}
                className="ml-0.5 opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
              >
                <X className="size-3" />
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="ml-1 grid size-6 shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-fg"
          aria-label="Add creature"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-1.5 text-xs">
        <span className="flex items-center gap-2">
          <span className="text-muted">Template</span>
          <select
            className="rounded bg-surface-2 px-2 py-1 text-fg outline-none"
            value=""
            onChange={(ev) => {
              const t = TEMPLATES.find((x) => x.id === ev.target.value);
              if (t && active) setSource(active.id, t.source);
            }}
          >
            <option value="">Insert…</option>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted">Color</span>
          {HUE_PRESETS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => active && setHue(active.id, h)}
              aria-label={`set color ${h}`}
              className={cn(
                'size-3.5 rounded-full transition',
                active?.hue === h
                  ? 'ring-2 ring-fg ring-offset-1 ring-offset-surface'
                  : 'opacity-80 hover:scale-110 hover:opacity-100',
              )}
              style={{ background: `hsl(${h} 72% 62%)` }}
            />
          ))}
        </span>
        {active?.status === 'error' && (
          <span className="truncate" style={{ color: 'hsl(0 70% 70%)' }} title={active.error}>
            ⚠ {active.error}
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          className="ml-auto flex items-center gap-1.5 rounded bg-surface-2 px-2.5 py-1 text-fg transition hover:brightness-125"
          title="Save all creatures in this browser (restored when you reopen the app)"
        >
          <Save className="size-3.5" /> {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <Suspense fallback={EditorFallback}>
          {active && (
            <MonacoEditor
              path={`creature-${active.id}.ts`}
              value={active.source}
              onChange={(v) => setSource(active.id, v)}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}
