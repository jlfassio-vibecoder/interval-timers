import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AmrapAuthProvider } from './contexts/AmrapAuthContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/amrap">
      <AmrapAuthProvider>
        <App />
      </AmrapAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
