import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted handwriting font: no CDN request, works offline.
import '@fontsource/caveat/400.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
