/**
 * Sorgente "tastiera MIDI" (USB o Bluetooth) tramite Web MIDI API.
 *  - ascolta tutti i dispositivi o solo quello scelto
 *  - collegamento/scollegamento a caldo (statechange)
 *  - velocity, pedale di risonanza, timestamp precisi (event.timeStamp → tempo audio)
 */
import { BaseInputSource } from '../BaseInputSource';
import { midiHex, parseMidi } from './midiParser';

export type MidiState = 'off' | 'starting' | 'on' | 'denied' | 'unsupported' | 'error';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  connected: boolean;
}

export interface MidiDeps {
  requestAccess: () => Promise<MIDIAccess>;
  /** converte event.timeStamp (ms, clock performance) nel tempo audio (s) */
  toAudioTime: (perfMs: number) => number;
  /** pedale: inoltrato al sampler quando la tastiera non ha suono proprio */
  onSustain?: (on: boolean) => void;
}

export interface MidiActivity {
  hex: string;
  device: string;
  /** ritardo tra l'evento e la sua gestione (ms) */
  handlingDelayMs: number;
}

export class MidiInput extends BaseInputSource {
  readonly kind = 'midi' as const;
  state: MidiState = 'off';
  errorMessage = '';
  /** null = tutti i dispositivi */
  deviceId: string | null = null;
  lastActivity: MidiActivity | null = null;

  private access: MIDIAccess | null = null;
  private attached = new Map<string, MIDIInput>();
  private held = new Set<number>();
  private stateListeners = new Set<() => void>();
  private refs = 0;

  constructor(private readonly deps: MidiDeps) {
    super();
  }

  get devices(): MidiDevice[] {
    if (!this.access) return [];
    const list: MidiDevice[] = [];
    this.access.inputs.forEach((i) =>
      list.push({ id: i.id, name: i.name ?? 'Tastiera MIDI', manufacturer: i.manufacturer ?? '', connected: i.state === 'connected' }),
    );
    return list;
  }

  get connectedDevices(): MidiDevice[] {
    return this.devices.filter((d) => d.connected);
  }

  async acquire(): Promise<void> {
    this.refs++;
    if (this.state !== 'on' && this.state !== 'starting') await this.start();
  }

  release(): void {
    this.refs = Math.max(0, this.refs - 1);
    // la Web MIDI non ha implicazioni di privacy: si resta in ascolto (connessione a caldo più rapida)
  }

  async start(): Promise<void> {
    this.setState('starting');
    try {
      this.access = await this.deps.requestAccess();
      this.access.addEventListener('statechange', this.onStateChange);
      this.syncInputs();
      this.setState('on');
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotSupportedError' || name === 'TypeError') this.setState('unsupported', 'Questo browser non supporta le tastiere MIDI.');
      else if (name === 'SecurityError' || name === 'NotAllowedError')
        this.setState('denied', 'Accesso ai dispositivi MIDI negato. Puoi consentirlo dalle impostazioni del sito nel browser.');
      else this.setState('error', `Non riesco ad accedere ai dispositivi MIDI (${name ?? 'errore'}).`);
    }
  }

  stop(): void {
    this.attached.forEach((input) => input.removeEventListener('midimessage', this.onMessage as EventListener));
    this.attached.clear();
    this.access?.removeEventListener('statechange', this.onStateChange);
    this.access = null;
    this.releaseAll(0);
    this.setState('off');
  }

  /** sceglie il dispositivo (null = tutti) */
  selectDevice(id: string | null): void {
    this.deviceId = id;
    this.syncInputs();
    this.notify();
  }

  subscribeState(l: () => void): () => void {
    this.stateListeners.add(l);
    return () => this.stateListeners.delete(l);
  }

  // ---------- interni ----------

  private onStateChange = () => {
    this.syncInputs();
    this.notify();
  };

  /** collega gli input connessi (e scelti), scollega gli altri */
  private syncInputs() {
    if (!this.access) return;
    const wanted = new Map<string, MIDIInput>();
    this.access.inputs.forEach((input) => {
      if (input.state === 'connected' && (this.deviceId === null || input.id === this.deviceId)) wanted.set(input.id, input);
    });
    for (const [id, input] of this.attached) {
      if (!wanted.has(id)) {
        input.removeEventListener('midimessage', this.onMessage as EventListener);
        this.attached.delete(id);
      }
    }
    for (const [id, input] of wanted) {
      if (!this.attached.has(id)) {
        input.addEventListener('midimessage', this.onMessage as EventListener);
        this.attached.set(id, input);
      }
    }
    // dispositivo scollegato mentre si suonava: nessuna nota "incastrata"
    if (wanted.size === 0) this.releaseAll(performance.now());
  }

  private onMessage = (e: MIDIMessageEvent) => {
    const data = e.data;
    if (!data) return;
    const now = performance.now();
    const ts = e.timeStamp && e.timeStamp > 0 ? e.timeStamp : now;
    const msg = parseMidi(data);
    this.lastActivity = {
      hex: midiHex(data),
      device: (e.target as MIDIInput | null)?.name ?? '',
      handlingDelayMs: Math.max(0, now - ts),
    };
    const time = this.deps.toAudioTime(ts);
    switch (msg.type) {
      case 'noteon':
        if (this.held.has(msg.note)) this.emit({ type: 'off', midi: msg.note, velocity: 0, time });
        this.held.add(msg.note);
        this.emit({ type: 'on', midi: msg.note, velocity: msg.velocity, time });
        break;
      case 'noteoff':
        if (this.held.delete(msg.note)) this.emit({ type: 'off', midi: msg.note, velocity: 0, time });
        break;
      case 'sustain':
        this.deps.onSustain?.(msg.on);
        break;
      case 'allnotesoff':
        this.releaseAll(ts);
        break;
    }
    if (msg.type !== 'other') this.notify();
  };

  private releaseAll(perfMs: number) {
    const time = this.deps.toAudioTime(perfMs);
    for (const m of [...this.held]) {
      this.held.delete(m);
      this.emit({ type: 'off', midi: m, velocity: 0, time });
    }
    this.deps.onSustain?.(false);
  }

  private setState(s: MidiState, msg = '') {
    this.state = s;
    this.errorMessage = msg;
    this.notify();
  }

  private notify() {
    this.stateListeners.forEach((l) => l());
  }
}
