import { Link } from 'react-router-dom';
import { useMidiState } from '../../input/activeInput';
import { midiInput } from '../../input/midi/midiInstance';
import './midi.css';

/** Indicatore compatto (nome tastiera) o avviso se nessuna tastiera è collegata. */
export function MidiStatus({ variant }: { variant: 'chip' | 'banner' }) {
  const midi = useMidiState();
  const connected = midiInput.connectedDevices;
  if (variant === 'chip') {
    if (midi.state !== 'on' || connected.length === 0) return null;
    const name = connected.find((d) => d.id === midiInput.deviceId)?.name ?? connected[0]!.name;
    return (
      <span className="midi-chip" data-testid="midi-chip" title="Tastiera MIDI collegata">
        <span className="midi-dot is-connected" aria-hidden /> {name}
      </span>
    );
  }
  if (midi.state === 'starting' || midi.state === 'off') return null;
  if (midi.state === 'on' && connected.length > 0) return null;
  return (
    <div className="banner banner--warn" role="alert" data-testid="midi-banner">
      <span>{midi.state === 'on' ? '🔌 Nessuna tastiera MIDI collegata: collegala e si attiverà da sola.' : `⚠️ ${midi.message}`}</span>
      <Link className="btn" to="/midi">
        Configura
      </Link>
    </div>
  );
}
