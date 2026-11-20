import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Keep the app up to date: check for a new version when the app comes back
// to the screen and every hour, then reload automatically once it's downloaded.
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    const checkForUpdate = () => {
      if (navigator.onLine) registration.update()
    }
    setInterval(checkForUpdate, 60 * 60 * 1000) // every hour
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate() // app reopened
    })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
