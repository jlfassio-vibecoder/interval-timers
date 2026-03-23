import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Daily Warm-Up] Error boundary caught:', error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error && this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }
    if (error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'monospace',
            color: '#ff6b6b',
            background: '#1a0a0a',
            minHeight: '100vh',
            whiteSpace: 'pre-wrap' as const,
            overflow: 'auto',
          }}
        >
          <h2 style={{ color: '#ffbf00', marginBottom: 12 }}>Daily Warm-Up Error</h2>
          <p style={{ marginBottom: 8 }}>{error.message}</p>
          {error.stack && (
            <pre style={{ fontSize: 12, opacity: 0.9 }}>{error.stack}</pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
