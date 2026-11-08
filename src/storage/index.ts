import { createDexieProvider } from './dexieProvider';
import type { StorageProvider } from './types';

/** Provider attivo. Per sync/account futuri basta sostituire questa riga. */
export const storage: StorageProvider = createDexieProvider();

export * from './types';
