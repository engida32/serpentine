import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArcadeButton } from "./controls";
import { IconHome, IconRestart } from "./icons";

interface Props {
  /** Changing this key resets the boundary (e.g. the active game id). */
  resetKey: string;
  onHome: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a crashing game so a single bug never takes down the whole arcade.
 * On a TV there is no refresh button, so the recovery UI is D-pad navigable
 * (`data-menu`) and offers both "retry this game" and "back to the hub".
 */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[arcade] game crashed", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main
        data-menu
        className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
        role="alert"
      >
        <p className="font-display text-xs sm:text-sm tv:text-base text-coral tracking-widest">— GLITCH IN THE CABINET —</p>
        <h2 className="font-display text-lg sm:text-2xl tv:text-3xl text-foam text-balance">This game hit an error</h2>
        <p className="text-fog text-sm sm:text-base tv:text-xl max-w-[560px] text-pretty leading-relaxed">
          Your scores and trophies are safe. You can retry the game or head back to the arcade.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ArcadeButton variant="primary" big data-autofocus onClick={() => this.setState({ error: null })}>
            <IconRestart /> Retry
          </ArcadeButton>
          <ArcadeButton big onClick={this.props.onHome}>
            <IconHome /> Arcade
          </ArcadeButton>
        </div>
        {import.meta.env.DEV && (
          <pre className="mt-2 max-w-[720px] overflow-auto text-left text-[11px] text-fog/70 bg-pit/80 border border-line rounded-md p-3">
            {this.state.error.message}
          </pre>
        )}
      </main>
    );
  }
}
