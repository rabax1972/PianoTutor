/**
 * Livello di storage astratto. L'app dipende solo da queste interfacce:
 * oggi l'implementazione è IndexedDB (Dexie), domani potrà essere un provider con sync/account.
 *
 * Tutti i record hanno un id stabile e `updatedAt` (ms epoch) per permettere
 * una futura sincronizzazione con merge last-write-wins.
 */
import type { NoteNaming } from '../core/music/pitch';
import type { InputKind } from '../input/types';

export interface LatencyOffsets {
  /** ms da sottrarre agli eventi di ciascuna sorgente */
  mic: number;
  midi: number;
  virtual: number;
  /** ms di ritardo dell'uscita audio (per allineare metronomo e "ascolta") */
  output: number;
}

export interface MicSettings {
  /** rumore di fondo misurato in calibrazione (dBFS); null = non calibrato */
  noiseFloorDb: number | null;
  /** sensibilità: margine sopra il rumore (dB). Più basso = più sensibile */
  gateMarginDb: number;
  calibratedAt: number | null;
}

export interface MidiSettings {
  /** null = tutti i dispositivi collegati */
  deviceId: string | null;
  /** suona anche dal tablet (per tastiere senza altoparlanti) */
  playSound: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  /** HH:MM ora locale */
  time: string;
}

export interface Settings {
  /** null = non ancora scelto (mostra la schermata di scelta all'avvio) */
  inputMode: InputKind | null;
  noteNaming: NoteNaming;
  showNoteNames: boolean;
  colorNotes: boolean;
  /** 0.85 – 1.5 */
  fontScale: number;
  highContrast: boolean;
  volume: number;
  latency: LatencyOffsets;
  a4Hz: number;
  mic: MicSettings;
  midi: MidiSettings;
  reminder: ReminderSettings;
  dailyGoalMin: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMode: null,
  noteNaming: 'italian',
  showNoteNames: true,
  colorNotes: false,
  fontScale: 1,
  highContrast: false,
  volume: 0.8,
  latency: { mic: 0, midi: 0, virtual: 0, output: 0 },
  a4Hz: 440,
  mic: { noiseFloorDb: null, gateMarginDb: 12, calibratedAt: null },
  midi: { deviceId: null, playSound: false },
  reminder: { enabled: false, time: '18:00' },
  dailyGoalMin: 10,
  updatedAt: 0,
};

export type Grade = 'perfect' | 'early' | 'late' | 'corrected' | 'wrong' | 'missed';

export interface NoteResult {
  expected: string[];
  played: string[];
  deltaMs?: number;
  grade: Grade;
}

export interface Attempt {
  id: string;
  lessonId: string;
  stepId: string;
  startedAt: number;
  durationMs: number;
  inputMode: InputKind;
  tempoScale: number;
  pitchAccuracy: number;
  timingAccuracy: number;
  stars: 0 | 1 | 2 | 3;
  noteResults: NoteResult[];
  updatedAt: number;
}

export interface LessonProgress {
  lessonId: string;
  bestStars: 0 | 1 | 2 | 3;
  completedSteps: string[];
  /** migliori stelle per step suonabile */
  stepStars: Record<string, number>;
  /** true quando tutti gli step sono stati completati almeno una volta */
  completed: boolean;
  attempts: number;
  updatedAt: number;
}

export interface PracticeDay {
  /** YYYY-MM-DD (ora locale) */
  date: string;
  practiceMs: number;
  updatedAt: number;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: number;
  updatedAt: number;
}

export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

export interface ProgressRepository {
  getLesson(lessonId: string): Promise<LessonProgress | undefined>;
  listLessons(): Promise<LessonProgress[]>;
  putLesson(p: LessonProgress): Promise<void>;
  addAttempt(a: Attempt): Promise<void>;
  listAttempts(filter?: { lessonId?: string; since?: number }): Promise<Attempt[]>;
}

export interface StatsRepository {
  addPractice(date: string, ms: number): Promise<void>;
  listPracticeDays(sinceDate?: string): Promise<PracticeDay[]>;
  listBadges(): Promise<EarnedBadge[]>;
  awardBadge(badgeId: string): Promise<boolean>;
}

export interface StorageProvider {
  settings: SettingsRepository;
  progress: ProgressRepository;
  stats: StatsRepository;
  /** cancella tutti i dati locali */
  clearAll(): Promise<void>;
}
