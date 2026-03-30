import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FormPage from './FormPage'
import './form.css'

const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Root element #app was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <FormPage />
  </StrictMode>,
)
