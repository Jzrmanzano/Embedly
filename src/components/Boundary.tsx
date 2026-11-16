import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** What to show instead, with a way to try again. */
  fallback: (error: Error, retry: () => void) => ReactNode;
  /** When this changes (another mission, another board) the boundary starts afresh. */
  resetKey?: unknown;
}
interface State { error: Error | null; key: unknown }

/** Catches a crash in the part of the page inside it, so the rest of the lab keeps working. */
export class Boundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };
  static getDerivedStateFromError(error: unknown): Partial<State> { return { error: error instanceof Error ? error : new Error(String(error)) }; }
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null { return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Embedly caught a crash:', error, info.componentStack); }
  retry = () => this.setState({ error: null });
  render() { return this.state.error ? this.props.fallback(this.state.error, this.retry) : this.props.children; }
}

/** A dynamic import that failed: the network dropped, or the site was updated and the old file is gone. */
export const isLoadError = (e: Error) => /dynamically imported module|Failed to fetch|Importing a module script failed|error loading dynamically/i.test(e.message);

/** The whole page, when something outside the panels crashed. Progress and benches are saved as the student goes, so a reload loses nothing. */
export function CrashPage({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <main className="crash page" role="alert">
      <h1>Something went wrong</h1>
      <p>Embedly ran into a problem it did not expect. Your missions, benches and sketches are saved, so nothing is lost.</p>
      <div className="crash-actions">
        <button type="button" className="primary" onClick={retry}>Try again</button>
        <button type="button" onClick={() => location.reload()}>Reload the page</button>
        <button type="button" onClick={() => { location.hash = ''; retry(); }}>Back to the home page</button>
      </div>
      <details><summary>What went wrong</summary><pre>{error.message}</pre></details>
    </main>
  );
}

/** One panel crashed: say so in the panel, and leave the bench and the other panels alone. */
export function PanelCrash({ what, retry }: { what: string; retry: () => void }) {
  return (
    <div className="crash" role="alert">
      <p>The {what} ran into a problem.</p>
      <button type="button" onClick={retry}>Try again</button>
    </div>
  );
}
