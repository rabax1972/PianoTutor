import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { audioEngine } from '../audio/AudioEngine';
import { HomePage } from '../features/home/HomePage';
import { WelcomePage } from '../features/onboarding/WelcomePage';
import { scheduleReminder } from '../features/progress/reminders';
import { loadSummary } from '../features/progress/summary';
import { Toaster } from '../features/progress/toasts';
import { useSettings } from './settingsStore';
import { preloadNotation } from '../notation/preload';

/**
 * Ogni schermata (tranne home e benvenuto) è un chunk separato, caricato al primo accesso.
 * Tutti i chunk sono comunque in precache nel service worker: offline funzionano lo stesso.
 */
function lazyPage<M extends Record<string, unknown>>(importer: () => Promise<M>, name: keyof M): LazyExoticComponent<ComponentType> {
  return lazy(() => importer().then((m) => ({ default: m[name] as ComponentType })));
}

const pages = {
  freePlay: lazyPage(() => import('../features/practice/FreePlayPage'), 'FreePlayPage'),
  course: lazyPage(() => import('../features/course/CoursePage'), 'CoursePage'),
  calibration: lazyPage(() => import('../features/mic/CalibrationPage'), 'CalibrationPage'),
  midi: lazyPage(() => import('../features/midi/MidiSetupPage'), 'MidiSetupPage'),
  // con lo spartito: VexFlow e font partono subito, in parallelo al chunk della pagina
  lesson: lazyPage(() => (preloadNotation(), import('../features/lesson/LessonPage')), 'LessonPage'),
  progress: lazyPage(() => import('../features/progress/ProgressPage'), 'ProgressPage'),
  songs: lazyPage(() => import('../features/songs/SongsPage'), 'SongsPage'),
  scorePlayer: lazyPage(() => (preloadNotation(), import('../features/songs/ScorePlayerPage')), 'ScorePlayerPage'),
  settings: lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage'),
  diagnostics: lazyPage(() => import('../features/diagnostics/DiagnosticsPage'), 'DiagnosticsPage'),
  about: lazyPage(() => import('../features/about/AboutPage'), 'AboutPage'),
};

const fallback = (
  <p className="page muted" role="status">
    Caricamento…
  </p>
);
const el = (P: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={fallback}>
    <P />
  </Suspense>
);

/**
 * HashRouter: funziona su qualunque hosting statico in sottocartella
 * (es. giacomorabaglia.com/pianotutor/) senza regole di rewrite lato server, e offline.
 */
const router = createHashRouter([
  { path: '/', element: <HomeGate /> },
  { path: '/benvenuto', element: <WelcomePage /> },
  { path: '/suona', element: el(pages.freePlay) },
  { path: '/percorso', element: el(pages.course) },
  { path: '/microfono', element: el(pages.calibration) },
  { path: '/midi', element: el(pages.midi) },
  { path: '/lezione/:id', element: el(pages.lesson) },
  { path: '/progressi', element: el(pages.progress) },
  { path: '/brani', element: el(pages.songs) },
  { path: '/brano/:id', element: el(pages.scorePlayer) },
  { path: '/impostazioni', element: el(pages.settings) },
  { path: '/diagnostica', element: el(pages.diagnostics) },
  { path: '/info', element: el(pages.about) },
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

  // promemoria: notifica all'ora scelta finché l'app è aperta (se oggi non si è suonato)
  useEffect(() => {
    if (!loaded) return;
    let practiced = false;
    const refresh = () =>
      loadSummary(settings.dailyGoalMin)
        .then((s) => (practiced = s.streak.practicedToday))
        .catch(() => undefined);
    void refresh();
    scheduleReminder(settings.reminder.enabled, settings.reminder.time, () => {
      void refresh();
      return practiced;
    });
  }, [loaded, settings.reminder.enabled, settings.reminder.time, settings.dailyGoalMin]);

  if (!loaded) return null;
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
