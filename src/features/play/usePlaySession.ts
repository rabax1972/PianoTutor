import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { SessionResult } from '../../core/evaluation/types';
import { PlaySession, type SessionConfig } from './PlaySession';

/**
 * Crea una PlaySession per la configurazione data (ricreata quando cambia `key`)
 * e ne espone lo snapshot reattivo.
 */
export function usePlaySession(config: SessionConfig, key: string, onFinish?: (r: SessionResult | null, s: PlaySession) => void) {
  const [session, setSession] = useState<PlaySession | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const s: PlaySession = new PlaySession({ ...config }, (r) => onFinishRef.current?.(r, s));
    setSession(s);
    return () => s.dispose();
    // la sessione si ricrea solo quando cambia la chiave (brano/modalità/tentativo)
  }, [key]);

  const snapshot = useSyncExternalStore(
    (cb) => session?.subscribe(cb) ?? (() => {}),
    () => session?.snapshot ?? null,
  );
  return { session, snapshot };
}
