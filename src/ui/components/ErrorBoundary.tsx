import { Component } from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Fatal UI error', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fatal-error">
        <div className="fatal-card">
          <div className="fatal-title">Something went wrong.</div>
          <div className="fatal-message">{error.message || 'Unknown error'}</div>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
