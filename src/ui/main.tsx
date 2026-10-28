import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppErrorBoundary } from './common/AppErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
)
