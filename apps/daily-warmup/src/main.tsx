import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

/** Renders uncaught errors to the page so they're visible when console is hidden. */
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'monospace',
        color: '#ff6b6b',
        background: '#1a0a0a',
        minHeight: '100vh',
        whiteSpace: 'pre-wrap',
        overflow: 'auto',
      }}
    >
      <h2 style={{ color: '#ffbf00', marginBottom: 12 }}>Daily Warm-Up Error</h2>
      <p style={{ marginBottom: 8 }}>{error.message}</p>
      {import.meta.env.DEV && error.stack && (
        <pre style={{ fontSize: 12, opacity: 0.9 }}>{error.stack}</pre>
      )}
    </div>
  )
}

const rootEl = document.getElementById('root')!
const root = createRoot(rootEl)

try {
  root.render(
    <StrictMode>
      <ErrorBoundary
        fallback={(err) => <ErrorFallback error={err} />}
      >
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (err) {
  root.render(<ErrorFallback error={err instanceof Error ? err : new Error(String(err))} />)
}

window.addEventListener('error', (e) => {
  if (e.error) {
    root.render(<ErrorFallback error={e.error} />)
  }
})
window.addEventListener('unhandledrejection', (e) => {
  root.render(
    <ErrorFallback error={e.reason instanceof Error ? e.reason : new Error(String(e.reason))} />,
  )
})
