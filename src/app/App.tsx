import { useEffect } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { audioEngine } from '../audio/AudioEngine';
import { AboutPage } from '../features/about/AboutPage';
import { DiagnosticsPage } from '../features/diagnostics/DiagnosticsPage';
import { HomePage } from '../features/home/HomePage';
import { WelcomePage } from '../features/onboarding/WelcomePage';
import { FreePlayPage } from '../features/practice/FreePlayPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useSettings } from './settingsStore';

/**
 * HashRouter: funziona su qualunque hosting statico in sottocartella
 * (es. giacomorabaglia.com/pianotutotor/) senza regole di rewrite lato server, e offline.
 */
const router = createHashRouter([
  { path: '/', element: <HomeGate /> },
  { path: '/benvenuto', element: <WelcomePage /> },
  { path: '/suona', element: <FreePlayPage /> },
  { path: '/impostazioni', element: <SettingsPage /> },
  { path: '/diagnostica', element: <DiagnosticsPage /> },
  { path: '/info', element: <AboutPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function HomeGate() {
  const inputMode = useSettings((s) => s.settings.inputMode);
  return inputMode === null ? <Navigate to="/benvenuto" replace /> : <HomePage />;
}

export function App() {
  const { loaded, load, settings } = useSettings();

  useEffect(() => {
    void load();
  }, [load]);

  // Applica le impostazioni che agiscono su tutto il documento.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-scale', String(settings.fontScale));
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  }, [settings.fontScale, settings.highContrast]);

  useEffect(() => {
    if (audioEngine.isRunning) audioEngine.setVolume(settings.volume);
    return audioEngine.subscribe(() => {
      if (audioEngine.isRunning) audioEngine.setVolume(useSettings.getState().settings.volume);
    });
  }, [settings.volume]);

  if (!loaded) return null;
  return <RouterProvider router={router} />;
}
