import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register static-asset service worker safely (graceful no-op if blocked by sandboxed iframe)
registerSW({
  immediate: true,
  onRegisterError() {
    // Expected in restricted cross-origin preview iframes
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
