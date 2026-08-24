import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../../src/shared/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
