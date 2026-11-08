import { describe, expect, it } from 'vitest';
import type { NoteInputEvent } from '../types';
import { MidiInput } from './MidiInput';
import { midiHex, parseMidi } from './midiParser';

describe('parseMidi', () => {
  it('note on / note off su qualsiasi canale', () => {
    expect(parseMidi([0x90, 60, 127])).toEqual({ type: 'noteon', note: 60, velocity: 1, channel: 0 });
    expect(parseMidi([0x93, 64, 64])).toMatchObject({ type: 'noteon', note: 64, channel: 3 });
    expect(parseMidi([0x80, 60, 40])).toEqual({ type: 'noteoff', note: 60, channel: 0 });
  });

  it('note on con velocity 0 equivale a note off', () => {
    expect(parseMidi([0x90, 62, 0])).toEqual({ type: 'noteoff', note: 62, channel: 0 });
  });

  it('pedale di risonanza e tutte le note spente', () => {
    expect(parseMidi([0xb0, 64, 127])).toEqual({ type: 'sustain', on: true, channel: 0 });
    expect(parseMidi([0xb0, 64, 10])).toEqual({ type: 'sustain', on: false, channel: 0 });
    expect(parseMidi([0xb0, 123, 0])).toEqual({ type: 'allnotesoff', channel: 0 });
  });

  it('ignora clock, active sensing e altri messaggi', () => {
    expect(parseMidi([0xf8])).toEqual({ type: 'other' });
    expect(parseMidi([0xfe])).toEqual({ type: 'other' });
    expect(parseMidi([0xe0, 0, 64])).toEqual({ type: 'other' });
    expect(parseMidi([])).toEqual({ type: 'other' });
  });

  it('formatta in esadecimale', () => {
    expect(midiHex([0x90, 60, 100])).toBe('90 3C 64');
  });
});

// ---------- Web MIDI finta ----------

class FakeInput extends EventTarget {
  state: MIDIPortDeviceState = 'connected';
  constructor(
    readonly id: string,
    readonly name: string,
  ) {
    super();
  }
  readonly manufacturer = 'Test';
  send(data: number[], timeStamp = 1000) {
    const ev = new Event('midimessage') as MIDIMessageEvent;
    Object.defineProperty(ev, 'data', { value: new Uint8Array(data) });
    Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
    Object.defineProperty(ev, 'target', { value: this });
    this.dispatchEvent(ev);
  }
}

class FakeAccess extends EventTarget {
  inputs = new Map<string, FakeInput>();
  plug(i: FakeInput) {
    this.inputs.set(i.id, i);
    i.state = 'connected';
    this.dispatchEvent(new Event('statechange'));
  }
  unplug(id: string) {
    this.inputs.get(id)!.state = 'disconnected';
    this.dispatchEvent(new Event('statechange'));
  }
}

function setup() {
  const access = new FakeAccess();
  const sustain: boolean[] = [];
  const midi = new MidiInput({
    requestAccess: async () => access as unknown as MIDIAccess,
    toAudioTime: (ms) => ms / 1000,
    onSustain: (on) => sustain.push(on),
  });
  const events: NoteInputEvent[] = [];
  midi.subscribe((e) => events.push(e));
  return { access, midi, events, sustain };
}

describe('MidiInput', () => {
  it('converte i messaggi in eventi nota con tempo e velocity', async () => {
    const { access, midi, events } = setup();
    const kb = new FakeInput('a', 'Piano A');
    access.inputs.set('a', kb);
    await midi.start();
    kb.send([0x90, 60, 127], 500);
    kb.send([0x80, 60, 0], 800);
    expect(events).toEqual([
      { type: 'on', midi: 60, velocity: 1, time: 0.5, source: 'midi' },
      { type: 'off', midi: 60, velocity: 0, time: 0.8, source: 'midi' },
    ]);
  });

  it('applica la correzione di latenza calibrata', async () => {
    const { access, midi, events } = setup();
    const kb = new FakeInput('a', 'Piano A');
    access.inputs.set('a', kb);
    await midi.start();
    midi.latencyOffsetMs = 20;
    kb.send([0x90, 62, 100], 1000);
    expect(events[0]!.time).toBeCloseTo(0.98);
  });

  it('gestisce collegamento e scollegamento a caldo', async () => {
    const { access, midi, events } = setup();
    await midi.start();
    expect(midi.connectedDevices).toHaveLength(0);
    const kb = new FakeInput('b', 'Piano B');
    access.plug(kb);
    expect(midi.connectedDevices.map((d) => d.name)).toEqual(['Piano B']);
    kb.send([0x90, 64, 90]);
    // scollegata con un tasto premuto: la nota viene rilasciata
    access.unplug('b');
    expect(events.map((e) => e.type)).toEqual(['on', 'off']);
    expect(midi.connectedDevices).toHaveLength(0);
  });

  it('ascolta solo il dispositivo scelto', async () => {
    const { access, midi, events } = setup();
    const a = new FakeInput('a', 'A');
    const b = new FakeInput('b', 'B');
    access.inputs.set('a', a);
    access.inputs.set('b', b);
    await midi.start();
    midi.selectDevice('b');
    a.send([0x90, 60, 100]);
    b.send([0x90, 67, 100]);
    expect(events.map((e) => e.midi)).toEqual([67]);
    midi.selectDevice(null);
    a.send([0x90, 72, 100]);
    expect(events.map((e) => e.midi)).toEqual([67, 72]);
  });

  it('inoltra il pedale e non duplica le note ripetute', async () => {
    const { access, midi, events, sustain } = setup();
    const kb = new FakeInput('a', 'A');
    access.inputs.set('a', kb);
    await midi.start();
    kb.send([0xb0, 64, 127]);
    kb.send([0x90, 60, 100]);
    kb.send([0x90, 60, 100]); // ripercossa senza note off (alcune tastiere)
    kb.send([0xb0, 64, 0]);
    expect(sustain).toEqual([true, false]);
    expect(events.map((e) => e.type)).toEqual(['on', 'off', 'on']);
  });

  it('segnala il browser non supportato', async () => {
    const midi = new MidiInput({
      requestAccess: () => Promise.reject(new DOMException('no', 'NotSupportedError')),
      toAudioTime: () => 0,
    });
    await midi.start();
    expect(midi.state).toBe('unsupported');
  });
});
