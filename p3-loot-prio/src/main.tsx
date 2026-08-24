import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LootPrio } from './LootPrio'
import '../../src/shared/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LootPrio />
  </StrictMode>,
)
