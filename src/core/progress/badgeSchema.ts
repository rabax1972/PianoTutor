/**
 * Schema Zod di content/badges.json (usato dalla validazione a build, non incluso nell'app).
 */
import { z } from 'zod';

export const BadgeCriterionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('attempts'), count: z.number().int().positive() }),
  z.object({ type: z.literal('lessons'), count: z.number().int().positive() }),
  z.object({ type: z.literal('unit'), unitId: z.string() }),
  z.object({ type: z.literal('streak'), days: z.number().int().positive() }),
  z.object({ type: z.literal('perfect'), count: z.number().int().positive() }),
  z.object({ type: z.literal('minutes'), total: z.number().positive() }),
  z.object({ type: z.literal('goal-days'), count: z.number().int().positive() }),
  z.object({ type: z.literal('realtime'), count: z.number().int().positive() }),
  z.object({ type: z.literal('input'), mode: z.enum(['virtual', 'mic', 'midi']) }),
]);

export const BadgeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  criterion: BadgeCriterionSchema,
});

export const BadgesFileSchema = z.object({ schemaVersion: z.literal(1), badges: z.array(BadgeSchema).min(1) });

// verifica a compile-time che lo schema corrisponda ai tipi usati dall'app
import type { Badge } from './badges';
type Check<A, B> = A extends B ? (B extends A ? true : never) : never;
export const _schemaMatchesType: Check<z.infer<typeof BadgeSchema>, Badge> = true;
