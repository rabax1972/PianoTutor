import { Link } from 'react-router-dom';
import { useSettings } from '../../app/settingsStore';
import { useMicState } from '../../input/activeInput';

/** Avviso quando il microfono non è disponibile, con alternative immediate. */
export function MicWarning() {
  const { state, message } = useMicState();
  const update = useSettings((s) => s.update);
  if (state !== 'denied' && state !== 'error' && state !== 'unsupported') return null;
  return (
    <div className="banner banner--warn" role="alert">
      <span>⚠️ {message}</span>
      <Link className="btn" to="/microfono">
        Riprova
      </Link>
      <button className="btn" onClick={() => update({ inputMode: 'virtual' })}>
        Usa la tastiera a schermo
      </button>
    </div>
  );
}
