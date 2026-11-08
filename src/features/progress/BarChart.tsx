import { useState } from 'react';

export interface BarDatum {
  /** etichetta sull'asse (breve) */
  label: string;
  /** etichetta completa per tooltip e tabella */
  fullLabel: string;
  value: number;
  /** valore formattato */
  display: string;
}

/**
 * Istogramma a una serie (niente legenda: il titolo nomina la serie).
 * Barre ≤ 24 px con estremità arrotondata e base squadrata, griglia e assi recessivi,
 * linea di riferimento opzionale (es. obiettivo), tooltip su tocco/hover/focus,
 * tabella dei dati sempre raggiungibile.
 */
export function BarChart({
  title,
  data,
  max,
  reference,
  testId,
}: {
  title: string;
  data: BarDatum[];
  max: number;
  reference?: { value: number; label: string };
  testId?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(max, reference?.value ?? 0, 1e-9);
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
  const cur = active !== null ? data[active] : undefined;

  return (
    <figure className="chart" data-testid={testId}>
      <figcaption className="chart__title">{title}</figcaption>
      <div className="chart__plot" onPointerLeave={() => setActive(null)}>
        <div className="chart__grid" aria-hidden>
          <span style={{ bottom: '100%' }} />
          <span style={{ bottom: '50%' }} />
        </div>
        {reference && reference.value > 0 && (
          <div className="chart__ref" style={{ bottom: pct(reference.value) }} aria-hidden>
            <span>{reference.label}</span>
          </div>
        )}
        <div className="chart__bars" role="list">
          {data.map((d, i) => (
            <div
              key={d.fullLabel + i}
              role="listitem"
              tabIndex={0}
              aria-label={`${d.fullLabel}: ${d.display}`}
              className={`chart__slot${active === i ? ' is-active' : ''}`}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <div className="chart__bar" style={{ height: d.value > 0 ? pct(d.value) : 0 }} />
            </div>
          ))}
        </div>
        {cur && (
          <div className="chart__tooltip" style={{ left: `${((active! + 0.5) / data.length) * 100}%` }} role="tooltip">
            <strong>{cur.display}</strong>
            <span>{cur.fullLabel}</span>
          </div>
        )}
      </div>
      <div className="chart__axis" aria-hidden>
        {data.map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
      <details className="chart__table">
        <summary>Mostra i dati</summary>
        <table>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <th scope="row">{d.fullLabel}</th>
                <td>{d.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
