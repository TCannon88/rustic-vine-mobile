import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Capture viewport width before React mounts — used by debug overlay
window.__vw0 = window.innerWidth

// Register PWA service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Could show a "New version available" toast here
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('[PWA] Ready to work offline')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
