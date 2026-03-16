import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AmrapAuthProvider } from './contexts/AmrapAuthContext'
import './index.css'
import App from './App.tsx'

// Supabase auth-js uses navigator.locks; concurrent getSession/onAuthStateChange can race and
// trigger lock-steal AbortErrors (wording varies: "Lock broken by another request with the 'steal'
// option" or "Lock was stolen by another request"). One op aborts but the other succeeds; auth
// state is correct. Suppress the uncaught rejection so the app keeps working when logged in.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? '';
  if (
    event.reason?.name === 'AbortError' &&
    (msg.includes("Lock broken by another request with the 'steal' option") ||
      msg.includes('Lock was stolen by another request'))
  ) {
    event.preventDefault();
  }
});

const amrapBase = import.meta.env.VITE_AMRAP_BASE ?? '/amrap'
const basename = typeof amrapBase === 'string' ? amrapBase.replace(/\/+$/, '') || '/' : '/amrap'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AmrapAuthProvider>
        <App />
      </AmrapAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
