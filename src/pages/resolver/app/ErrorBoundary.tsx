import { Component, type ErrorInfo, type ReactNode } from "react";
import { strings } from "@/pages/resolver/i18n";

interface State {
  failed: boolean;
}

/** Catches render errors so users see a calm message, never a stack trace. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card stack" role="alert" style={{ maxWidth: "30rem", margin: "2rem auto" }}>
        <h1>{strings.errors.crashTitle}</h1>
        <p>{strings.errors.crashBody}</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          {strings.errors.reload}
        </button>
      </div>
    );
  }
}
