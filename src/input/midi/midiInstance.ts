import { audioEngine } from '../../audio/AudioEngine';
import { sampler } from '../../audio/Sampler';
import { inputHub } from '../inputHub';
import { MidiInput } from './MidiInput';

/** Istanza dell'app: Web MIDI reale, orologio audio, pedale verso il sampler (se la tastiera usa il suono del tablet). */
export const midiInput = new MidiInput({
  requestAccess: () => {
    if (!('requestMIDIAccess' in navigator)) return Promise.reject(new DOMException('Web MIDI non supportata', 'NotSupportedError'));
    return navigator.requestMIDIAccess({ sysex: false });
  },
  toAudioTime: (ms) => audioEngine.performanceToAudioTime(ms),
  onSustain: (on) => {
    if (inputHub.midiSound) sampler.setSustain(on);
  },
});
