import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { loader } from '@monaco-editor/react';
import { CREATURE_API_DTS } from '@/sandbox/creatureApiDts';

let configured = false;

/** Self-host Monaco (no CDN — blocked by CSP) and wire up creature-api IntelliSense. */
export function setupMonaco(): void {
  if (configured) return;
  configured = true;

  self.MonacoEnvironment = {
    getWorker(_id, label) {
      if (label === 'typescript' || label === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };

  loader.config({ monaco });

  // monaco 0.55 marks `languages.typescript` deprecated on the typed barrel, but the
  // runtime namespace is still present. Access it through a cast and degrade gracefully.
  try {
    const tns = (monaco.languages as unknown as { typescript?: TsNamespace }).typescript;
    if (tns?.typescriptDefaults) {
      tns.typescriptDefaults.setCompilerOptions({
        target: tns.ScriptTarget.ES2020,
        module: tns.ModuleKind.ESNext,
        moduleResolution: tns.ModuleResolutionKind.NodeJs,
        strict: true,
        noEmit: true,
        allowNonTsExtensions: true,
      });
      tns.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
      tns.typescriptDefaults.addExtraLib(CREATURE_API_DTS, 'file:///elecxarium-creature.d.ts');
    }
  } catch {
    // Editor still highlights/edits TS without the extra IntelliSense config.
  }
}

interface TsDefaults {
  setCompilerOptions(options: Record<string, unknown>): void;
  setDiagnosticsOptions(options: Record<string, unknown>): void;
  addExtraLib(content: string, filePath?: string): void;
}
interface TsNamespace {
  typescriptDefaults: TsDefaults;
  ScriptTarget: Record<string, number>;
  ModuleKind: Record<string, number>;
  ModuleResolutionKind: Record<string, number>;
}

export { monaco };
