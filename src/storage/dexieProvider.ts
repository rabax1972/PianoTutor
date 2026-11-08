import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_SETTINGS,
  type Attempt,
  type EarnedBadge,
  type LessonProgress,
  type PracticeDay,
  type Settings,
  type StorageProvider,
} from './types';

interface KV {
  key: string;
  value: unknown;
}

class PianoTutorDB extends Dexie {
  kv!: Table<KV, string>;
  lessonProgress!: Table<LessonProgress, string>;
  attempts!: Table<Attempt, string>;
  practiceDays!: Table<PracticeDay, string>;
  badges!: Table<EarnedBadge, string>;

  constructor(name: string) {
    super(name);
    // Per modifiche future: aggiungere this.version(2).stores({...}).upgrade(...) senza toccare la v1.
    this.version(1).stores({
      kv: 'key',
      lessonProgress: 'lessonId, updatedAt',
      attempts: 'id, lessonId, startedAt, updatedAt',
      practiceDays: 'date, updatedAt',
      badges: 'badgeId, updatedAt',
    });
  }
}

export function createDexieProvider(dbName = 'piano-tutor'): StorageProvider {
  const db = new PianoTutorDB(dbName);

  return {
    settings: {
      async load(): Promise<Settings> {
        const row = await db.kv.get('settings');
        const stored = (row?.value ?? {}) as Partial<Settings>;
        // merge profondo minimo: nuove chiavi aggiunte in versioni future ricevono il default
        return {
          ...DEFAULT_SETTINGS,
          ...stored,
          latency: { ...DEFAULT_SETTINGS.latency, ...(stored.latency ?? {}) },
          mic: { ...DEFAULT_SETTINGS.mic, ...(stored.mic ?? {}) },
        };
      },
      async save(settings: Settings): Promise<void> {
        await db.kv.put({ key: 'settings', value: { ...settings, updatedAt: Date.now() } });
      },
    },

    progress: {
      getLesson: (id) => db.lessonProgress.get(id),
      listLessons: () => db.lessonProgress.toArray(),
      async putLesson(p) {
        await db.lessonProgress.put({ ...p, updatedAt: Date.now() });
      },
      async addAttempt(a) {
        await db.attempts.put({ ...a, updatedAt: Date.now() });
      },
      async listAttempts(filter = {}) {
        let coll = filter.lessonId
          ? db.attempts.where('lessonId').equals(filter.lessonId)
          : db.attempts.orderBy('startedAt');
        if (filter.since !== undefined) {
          const since = filter.since;
          coll = coll.filter((a) => a.startedAt >= since);
        }
        return coll.toArray();
      },
    },

    stats: {
      async addPractice(date, ms) {
        await db.transaction('rw', db.practiceDays, async () => {
          const cur = await db.practiceDays.get(date);
          await db.practiceDays.put({ date, practiceMs: (cur?.practiceMs ?? 0) + ms, updatedAt: Date.now() });
        });
      },
      async listPracticeDays(sinceDate) {
        return sinceDate
          ? db.practiceDays.where('date').aboveOrEqual(sinceDate).toArray()
          : db.practiceDays.toArray();
      },
      listBadges: () => db.badges.toArray(),
      async awardBadge(badgeId) {
        const existing = await db.badges.get(badgeId);
        if (existing) return false;
        const now = Date.now();
        await db.badges.put({ badgeId, earnedAt: now, updatedAt: now });
        return true;
      },
    },

    async clearAll() {
      await Promise.all(db.tables.map((t) => t.clear()));
    },
  };
}
