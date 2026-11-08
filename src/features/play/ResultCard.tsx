import type { SessionResult } from '../../core/evaluation/types';
import { noteLabel, type NoteNaming } from '../../core/music/pitch';
import { Stars } from '../../ui/Stars';
import './play.css';

const MESSAGES = [
  'Ottimo inizio! Riprova con calma: puoi anche rallentare il tempo.',
  'Bel lavoro! Riprova per guadagnare più stelle.',
  'Molto bene! Ancora un po’ di pratica e sarà perfetto.',
  'Fantastico! Esecuzione da vero pianista.',
];

export function topErrors(result: SessionResult, naming: NoteNaming, max = 3): string[] {
  const counts = new Map<number, number>();
  for (const e of result.errors) for (const m of e.expected) counts.set(m, (counts.get(m) ?? 0) + 1);
  result.onsets.filter((o) => o.grade === 'missed').forEach((o) => o.expected.forEach((m) => counts.set(m, (counts.get(m) ?? 0) + 1)));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([m, n]) => `${noteLabel(m, naming, { octave: false })}${n > 1 ? ` (${n} volte)` : ''}`);
}

export function ResultCard({
  result,
  naming,
  onRetry,
  onContinue,
  continueLabel = 'Continua',
}: {
  result: SessionResult;
  naming: NoteNaming;
  onRetry: () => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const errs = topErrors(result, naming);
  return (
    <div className="result" role="dialog" aria-label="Risultato" data-testid="result">
      <Stars value={result.stars} size="lg" animate />
      <p className="result__msg">{MESSAGES[result.stars]}</p>
      <dl className="result__stats">
        <div>
          <dt>Note giuste</dt>
          <dd data-testid="pitch-accuracy">{pct(result.pitchAccuracy)}</dd>
        </div>
        {result.timingAccuracy !== null && (
          <div>
            <dt>Ritmo</dt>
            <dd>{pct(result.timingAccuracy)}</dd>
          </div>
        )}
        <div>
          <dt>Perfette</dt>
          <dd>
            {result.counts.perfect}/{result.onsets.length}
          </dd>
        </div>
      </dl>
      {errs.length > 0 && <p className="muted result__errors">Da ripassare: {errs.join(', ')}</p>}
      <div className="result__actions">
        <button className="btn" onClick={onRetry} data-testid="retry">
          ↻ Riprova
        </button>
        {onContinue && (
          <button className="btn btn--primary" onClick={onContinue} data-testid="continue">
            {continueLabel} →
          </button>
        )}
      </div>
    </div>
  );
}
