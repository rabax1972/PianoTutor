import { create } from 'zustand';
import { storage, DEFAULT_SETTINGS, type Settings } from '../storage';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    try {
      const settings = await storage.settings.load();
      set({ settings, loaded: true });
    } catch (err) {
      // IndexedDB non disponibile (es. navigazione privata restrittiva): si continua con i default.
      console.warn('Impostazioni non caricate', err);
      set({ loaded: true });
    }
  },
  update(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    storage.settings.save(settings).catch((err) => console.warn('Impostazioni non salvate', err));
  },
}));
