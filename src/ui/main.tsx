import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppErrorBoundary } from './common/AppErrorBoundary'
import { installErrorForwarding } from './common/reportError'

installErrorForwarding()

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
)
