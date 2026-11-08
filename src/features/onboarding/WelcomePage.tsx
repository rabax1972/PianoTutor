import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { ensureAudio } from '../../audio/ensureAudio';
import { t } from '../../i18n/it';
import { getInputAvailability } from '../../input/availability';
import type { InputKind } from '../../input/types';
import { Tile } from '../../ui/components';

const ICONS: Record<InputKind, string> = { mic: '🎤', midi: '🎹', virtual: '📱' };
/** Modalità già implementate: il MIDI arriva con la milestone M5. */
export const IMPLEMENTED_INPUTS: InputKind[] = ['virtual', 'mic'];

export function WelcomePage() {
  const navigate = useNavigate();
  const update = useSettings((s) => s.update);
  const availability = getInputAvailability();

  const choose = (kind: InputKind) => {
    void ensureAudio();
    update({ inputMode: kind });
    // il microfono va calibrato (si può saltare)
    navigate(kind === 'mic' ? '/microfono' : '/', { replace: true });
  };

  return (
    <main className="page" style={{ justifyContent: "center" }}>
      <header className="page-section">
        <h1 style={{ fontSize: '2rem' }}>🎵 {t.welcome.title}</h1>
        <p className="muted" style={{ fontSize: '1.15rem', margin: 0 }}>
          {t.welcome.subtitle}
        </p>
      </header>

      <div className="tiles">
        {availability.map((a) => {
          const implemented = IMPLEMENTED_INPUTS.includes(a.kind);
          const copy = t.welcome[a.kind];
          return (
            <Tile
              key={a.kind}
              testId={`input-${a.kind}`}
              icon={ICONS[a.kind]}
              title={copy.title}
              desc={a.available ? copy.desc : a.reason!}
              disabled={!a.available || !implemented}
              tag={!a.available ? 'Non disponibile' : !implemented ? t.common.comingSoon : undefined}
              onClick={() => choose(a.kind)}
              hero={a.kind === 'virtual'}
            />
          );
        })}
      </div>
    </main>
  );
}
