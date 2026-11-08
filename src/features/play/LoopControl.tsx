import { useEffect, useState } from 'react';

export interface LoopRange {
  fromMeasure: number;
  toMeasure: number;
}

/** "Ripeti sezione": scelta delle battute da esercitare (1…measureCount). */
export function LoopControl({
  measureCount,
  value,
  onChange,
}: {
  measureCount: number;
  value: LoopRange | null;
  onChange: (v: LoopRange | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value?.fromMeasure ?? 1);
  const [to, setTo] = useState(value?.toMeasure ?? Math.min(2, measureCount));

  useEffect(() => {
    if (value) {
      setFrom(value.fromMeasure);
      setTo(value.toMeasure);
    }
  }, [value]);

  if (measureCount < 2) return null;
  const clampFrom = (n: number) => Math.max(1, Math.min(to, n));
  const clampTo = (n: number) => Math.max(from, Math.min(measureCount, n));

  return (
    <div className="loop">
      <button
        className={`btn${value ? ' btn--on' : ''}`}
        aria-expanded={open}
        aria-controls="loop-panel"
        onClick={() => setOpen((o) => !o)}
        data-testid="loop-toggle"
      >
        <span aria-hidden="true">🔁</span> {value ? `Battute ${value.fromMeasure}–${value.toMeasure}` : 'Ripeti sezione'}
      </button>
      {open && (
        <div className="loop__panel" id="loop-panel" role="dialog" aria-label="Ripeti una sezione">
          <p className="loop__title">Esercita solo alcune battute</p>
          <Stepper label="Dalla battuta" value={from} onChange={(n) => setFrom(clampFrom(n))} min={1} max={to} testId="loop-from" />
          <Stepper label="Alla battuta" value={to} onChange={(n) => setTo(clampTo(n))} min={from} max={measureCount} testId="loop-to" />
          <div className="loop__actions">
            {value && (
              <button
                className="btn"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Tutto il brano
              </button>
            )}
            <button
              className="btn btn--primary"
              data-testid="loop-apply"
              onClick={() => {
                onChange({ fromMeasure: from, toMeasure: to });
                setOpen(false);
              }}
            >
              Ripeti queste
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange, min, max, testId }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; testId: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper__label">{label}</span>
      <button className="btn btn--icon" aria-label={`${label}: meno`} onClick={() => onChange(value - 1)} disabled={value <= min}>
        <span aria-hidden="true">−</span>
      </button>
      <output className="stepper__value" data-testid={testId} aria-live="polite">
        {value}
      </output>
      <button className="btn btn--icon" aria-label={`${label}: più`} onClick={() => onChange(value + 1)} disabled={value >= max}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
