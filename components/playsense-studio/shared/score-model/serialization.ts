// PlaySense Studio — score model serialization and validation.
//
// Zod schemas at the storage boundary. When we read parsed_score JSONB from
// Supabase or accept an upload, we run it through parseScoreDocument() before
// treating it as a typed ScoreDocument. Anything that doesn't conform is
// rejected with a structured error.
//
// schema_version migration is handled here too. Versions are forward-only —
// older payloads run through migration steps to reach the current shape.

import { z } from 'zod';
import type { ScoreDocument } from './types';

const noteBaseShape = {
  durationQN: z.number().positive(),
  dotted: z.boolean().optional(),
  triplet: z.boolean().optional(),
  tieToNext: z.boolean().optional(),
  slurToNext: z.boolean().optional(),
  articulation: z.enum(['staccato', 'accent', 'tenuto']).optional(),
};

const fingeringSchema = z.object({
  string: z.number().int().positive(),
  fret: z.number().int().min(0),
  finger: z.number().int().min(0).max(5).optional(),
});

const noteSchema = z.object({
  kind: z.literal('note'),
  midi: z.number().int().min(0).max(127),
  spellingHint: z.string().optional(),
  fingering: fingeringSchema.optional(),
  ...noteBaseShape,
});

const restSchema = z.object({
  kind: z.literal('rest'),
  ...noteBaseShape,
});

const chordSchema = z.object({
  kind: z.literal('chord'),
  notes: z
    .array(
      z.object({
        midi: z.number().int().min(0).max(127),
        spellingHint: z.string().optional(),
        fingering: fingeringSchema.optional(),
        tieToNext: z.boolean().optional(),
      })
    )
    .min(2),
  ...noteBaseShape,
});

const musicalEventSchema = z.discriminatedUnion('kind', [
  noteSchema,
  restSchema,
  chordSchema,
]);

const voiceSchema = z.object({
  number: z.number().int().positive(),
  events: z.array(musicalEventSchema),
});

const timeSignatureSchema = z.tuple([
  z.number().int().positive(),
  z.number().int().positive(),
]);

const measureSchema = z.object({
  number: z.number().int().positive(),
  timeSignature: timeSignatureSchema.optional(),
  tempoChange: z.number().positive().optional(),
  keyFifths: z.number().int().min(-7).max(7).optional(),
  voices: z.array(voiceSchema).min(1),
});

const trackSchema = z.object({
  index: z.number().int().min(0),
  instrument: z.enum([
    'guitar',
    'bass',
    'tres',
    'cuatro',
    'tiple',
    'ukulele',
    'mandolin',
    'piano',
    'staff',
    'perc-kit',
    'perc-conga',
    'perc-bongo',
    'perc-timbal',
    'perc-clave',
  ]),
  displayName: z.string().min(1),
  tuning: z.array(z.string()).nullable(),
  stringMultiplicity: z.number().int().min(1).max(3),
  channel: z.number().int().min(0).max(15).nullable(),
  defaultView: z.enum(['staff', 'tab', 'fretboard', 'rhythm-grid', 'pdf']),
  measures: z.array(measureSchema),
});

const scoreDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  composer: z.string().optional(),
  sourceFormat: z.enum(['musicxml', 'midi', 'pdf', 'image', 'native']),
  initialTempo: z.number().positive(),
  initialTimeSignature: timeSignatureSchema,
  initialKeyFifths: z.number().int().min(-7).max(7),
  tracks: z.array(trackSchema).min(1),
});

export const SCORE_DOCUMENT_SCHEMA = scoreDocumentSchema;

export class ScoreDocumentValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(`ScoreDocument validation failed: ${issues.length} issue(s)`);
    this.name = 'ScoreDocumentValidationError';
  }
}

/**
 * Parse + validate an unknown payload (typically `parsed_score` JSONB from
 * Supabase) into a typed ScoreDocument. Throws ScoreDocumentValidationError
 * with the underlying Zod issues on failure.
 *
 * Older schema versions are migrated forward. The `schemaVersion` field is
 * mandatory — we never guess.
 */
export function parseScoreDocument(payload: unknown): ScoreDocument {
  const migrated = migrateToCurrentVersion(payload);
  const result = scoreDocumentSchema.safeParse(migrated);
  if (!result.success) {
    throw new ScoreDocumentValidationError(result.error.issues);
  }
  return result.data as ScoreDocument;
}

/**
 * Serialize a ScoreDocument back to JSON-safe form for storage. Currently
 * the in-memory shape is already JSON-safe, but routing through this function
 * keeps the boundary consistent and gives us a single place to handle future
 * non-JSON-safe additions (e.g. Map, Set, Date).
 */
export function serializeScoreDocument(score: ScoreDocument): unknown {
  return JSON.parse(JSON.stringify(score));
}

/**
 * Forward-only migration. Each version transition gets its own block.
 * Today the only supported version is 1 — this function exists so that
 * adding v2 later doesn't require touching every callsite.
 */
function migrateToCurrentVersion(payload: unknown): unknown {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    !('schemaVersion' in payload)
  ) {
    return payload;
  }

  const version = (payload as { schemaVersion: unknown }).schemaVersion;

  if (version === 1) return payload;

  throw new ScoreDocumentValidationError([
    {
      code: 'custom',
      message: `Unknown schemaVersion: ${String(version)}`,
      path: ['schemaVersion'],
      input: version,
    } as z.ZodIssue,
  ]);
}
