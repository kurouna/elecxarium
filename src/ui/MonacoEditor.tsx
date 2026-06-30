import { Editor } from '@monaco-editor/react';
import { setupMonaco } from './monacoSetup';

setupMonaco();

export interface MonacoEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

// Default export so it can be React.lazy()'d — keeps Monaco out of the initial bundle.
export default function MonacoEditor({ path, value, onChange }: MonacoEditorProps) {
  return (
    <Editor
      height="100%"
      language="typescript"
      theme="vs-dark"
      path={path}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      loading={<div className="grid h-full place-items-center text-xs text-muted">Loading editor…</div>}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 10 },
      }}
    />
  );
}
