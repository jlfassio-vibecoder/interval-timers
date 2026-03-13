import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AmrapAuthProvider } from './contexts/AmrapAuthContext'
import './index.css'
import App from './App.tsx'

// Supabase auth-js uses navigator.locks; concurrent getSession/onAuthStateChange can race and
// trigger "Lock broken by another request with the 'steal' option". One op aborts but the other
// succeeds; auth state is correct. Suppress the uncaught rejection to avoid console noise.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? '';
  if (
    event.reason?.name === 'AbortError' &&
    msg.includes("Lock broken by another request with the 'steal' option")
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/amrap">
      <AmrapAuthProvider>
        <App />
      </AmrapAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
