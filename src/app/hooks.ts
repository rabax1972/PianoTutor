import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { sampler } from '../audio/Sampler';

export function useSamplerState() {
  return useSyncExternalStore(
    (cb) => sampler.subscribe(cb),
    () => `${sampler.state}:${sampler.loaded}`,
  );
}

/** Larghezza (px) di un elemento, aggiornata al resize/rotazione. */
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  // misura sincrona prima del primo disegno: niente spostamenti di layout (CLS)
  useLayoutEffect(() => {
    if (el) setWidth(el.getBoundingClientRect().width);
  }, [el]);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}
