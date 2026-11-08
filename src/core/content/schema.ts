/**
 * Schema dei contenuti didattici (corso, lezioni, brani).
 * Fonte unica di verità: da qui derivano i tipi TS, la validazione a build e il JSON Schema in docs/.
 * Documentazione: docs/CONTENT-SCHEMA.md
 *
 * Convenzioni:
 *  - tempo musicale in BEAT, dove 1 = semiminima (4 = semibreve, 2 = minima, 0.5 = croma)
 *  - altezze in notazione scientifica: "C4" = Do centrale, "F#3", "Bb4"
 */
import { z } from 'zod';
import { isValidPitch } from '../music/pitch';

export const SCHEMA_VERSION = 1;

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'usa solo minuscole, numeri e trattini');

export const PitchSchema = z.string().refine(isValidPitch, { message: 'altezza non valida (es. "C4", "F#3", "Bb4")' });
export const HandSchema = z.enum(['R', 'L']);
export const StaffSchema = z.enum(['treble', 'bass']);
export const FingerSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const NoteEventSchema = z
  .object({
    t: z.number().min(0).describe('inizio in beat dall’inizio del brano'),
    d: z.number().positive().describe('durata in beat (1 = semiminima)'),
    p: z.array(PitchSchema).describe('altezze: [] = pausa, più elementi = accordo'),
    hand: HandSchema,
    staff: StaffSchema.optional().describe('default: R → treble, L → bass'),
    fingers: z.array(FingerSchema).optional().describe('diteggiatura, allineata a p'),
    tie: z.boolean().optional().describe('legatura di valore con la nota successiva'),
    label: z.string().optional().describe('testo/sillaba mostrata sotto la nota'),
  })
  .refine((e) => !e.fingers || e.fingers.length === e.p.length, {
    message: 'fingers deve avere la stessa lunghezza di p',
  });

export const ScoringConfigSchema = z.object({
  timing: z.object({
    perfectMs: z.number().positive().describe('entro ±perfectMs: verde'),
    goodMs: z.number().positive().describe('entro ±goodMs: giallo (anticipo/ritardo); oltre: mancata'),
  }),
  weights: z.object({ pitch: z.number().min(0), timing: z.number().min(0) }),
  stars: z.tuple([z.number(), z.number(), z.number()]).describe('soglie (0–1) per 1, 2, 3 stelle'),
});

export const DEFAULT_SCORING: ScoringConfig = {
  timing: { perfectMs: 80, goodMs: 180 },
  weights: { pitch: 0.7, timing: 0.3 },
  stars: [0.6, 0.8, 0.93],
};

export const PieceSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  title: z.string().min(1),
  composer: z.string().optional(),
  arranger: z.string().optional(),
  license: z.enum(['public-domain', 'original']).describe('obbligatorio: solo brani liberi o originali'),
  tempo: z.object({ bpm: z.number().min(20).max(300) }),
  timeSignature: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  key: z.object({ fifths: z.number().int().min(-7).max(7), mode: z.enum(['major', 'minor']) }),
  pickupBeats: z.number().min(0).optional(),
  staves: z.array(StaffSchema).min(1).max(2),
  events: z.array(NoteEventSchema).min(1),
});

export const PlaySettingsSchema = z.object({
  flow: z.enum(['wait', 'realtime']),
  listenFirst: z.boolean().optional(),
  metronome: z.boolean().optional(),
  countIn: z.number().int().min(0).max(4).optional(),
  tempoScale: z.number().min(0.25).max(1.5).optional(),
  hands: z.enum(['R', 'L', 'both']).optional(),
  loop: z.object({ fromMeasure: z.number().int().min(1), toMeasure: z.number().int().min(1) }).optional(),
  showNoteNames: z.boolean().optional(),
  colorNotes: z.boolean().optional(),
  hints: z.boolean().optional().describe('illumina sulla tastiera le note da suonare (default: sì negli esercizi guidati e nei brani, no negli esercizi liberi)'),
  scoring: ScoringConfigSchema.partial().optional(),
});

export const PieceRefSchema = z.union([id, PieceSchema]);

export const SlideSchema = z.object({
  text: z.string().min(1),
  animation: z
    .object({
      kind: z.enum(['keyboard-highlight', 'staff-note', 'rhythm-pulse', 'hand-position']),
      params: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
  highlightKeys: z.array(PitchSchema).optional(),
  showStaff: z.enum(['treble', 'bass', 'grand']).optional(),
});

export const StepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('explain'), id, slides: z.array(SlideSchema).min(1) }),
  z.object({
    type: z.literal('exercise'),
    id,
    mode: z.enum(['guided', 'free']),
    piece: PieceRefSchema,
    settings: PlaySettingsSchema,
  }),
  z.object({ type: z.literal('song'), id, piece: PieceRefSchema, settings: PlaySettingsSchema }),
]);

export const LessonSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  unitId: id,
  title: z.string().min(1),
  summary: z.string(),
  estimatedMinutes: z.number().min(1).max(10),
  concepts: z.array(z.string()).default([]),
  steps: z.array(StepSchema).min(1),
});

export const UnitSchema = z.object({
  id,
  title: z.string().min(1),
  description: z.string(),
  icon: z.string(),
  lessons: z.array(id).min(1),
  unlock: z.object({
    requiresLessons: z.array(id).default([]),
    minStars: z.number().int().min(0).max(3).optional(),
  }),
});

export const CourseSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  title: z.string(),
  units: z.array(UnitSchema).min(1),
});

export type NoteEvent = z.infer<typeof NoteEventSchema>;
export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
export type Piece = z.infer<typeof PieceSchema>;
export type PlaySettings = z.infer<typeof PlaySettingsSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Course = z.infer<typeof CourseSchema>;
