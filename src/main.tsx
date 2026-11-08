import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { installAudioUnlockOnFirstGesture } from './audio/ensureAudio';
import './styles/global.css';

// Niente pinch-zoom accidentale su iOS (Safari ignora user-scalable=no).
document.addEventListener('gesturestart', (e) => e.preventDefault());

installAudioUnlockOnFirstGesture();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
