import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

/** Isolates a render failure to one panel so a single creature/UI bug can't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label ?? 'panel'}]`, error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="grid h-full place-items-center p-4 text-center">
          <div>
            <p className="text-sm" style={{ color: 'hsl(0 70% 70%)' }}>
              ⚠ {this.props.label ?? 'Panel'} crashed
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted">{error.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 rounded-lg bg-surface-2 px-3 py-1 text-xs text-fg transition hover:brightness-125"
            >
              Reset panel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
