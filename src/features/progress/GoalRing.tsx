/** Anello dell'obiettivo giornaliero (indicatore singolo: niente legenda, il testo accanto lo spiega). */
export function GoalRing({ ratio, size = 72 }: { ratio: number; size?: number }) {
  const stroke = Math.max(6, size / 10);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = ratio >= 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Obiettivo di oggi: ${Math.round(ratio * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-elev-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={done ? 'var(--ok)' : 'var(--chart-1)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * Math.max(0, Math.min(1, ratio))} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--fg)" fontSize={size / 4.2} fontWeight={800}>
        {done ? '✓' : `${Math.round(ratio * 100)}%`}
      </text>
    </svg>
  );
}
