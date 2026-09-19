// PDF score recognition: Claude reads the selected pages and answers in the
// app's own score shape (see recognized-score.ts), which is validated and
// expanded into ScoreDocuments here. The only deployment requirement is an
// ANTHROPIC_API_KEY; nothing runs outside the web process.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { PDFDocument } from 'pdf-lib';
import type { Instrument, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { getPercStrokes } from '../perc-strokes';
import { MAX_PDF_BYTES, MAX_PDF_PAGES, RECOGNITION_TIMEOUT_MS } from './policy.mjs';
import { RecognitionError } from './recognition-error';
import { recognitionOutputSchema, toScoreDocuments } from './recognized-score';

export { RecognitionError };

export const RECOGNITION_MODEL = 'claude-opus-5';
/** Room for a dense eight-page score; a longer answer means "select fewer pages". */
const MAX_OUTPUT_TOKENS = 24_000;

/** Bound streamed bodies even when Content-Length is missing or incorrect. */
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<Buffer> {
  if (!body) throw new RecognitionError('Choose a PDF to import.', 400);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RecognitionError('The file is too large. Choose a PDF under 4 MB.', 413);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, length);
  } finally {
    reader.releaseLock();
  }
}

async function validatePdf(bytes: Buffer): Promise<void> {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new RecognitionError('Choose a PDF under 4 MB.', 413);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new RecognitionError('This file is not a valid PDF.', 400);
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    throw new RecognitionError('This PDF could not be read. Use an unlocked, undamaged PDF.', 400);
  }
  if (!document.getPageCount() || document.getPageCount() > MAX_PDF_PAGES) {
    throw new RecognitionError(`Choose between 1 and ${MAX_PDF_PAGES} score pages.`, 400);
  }
  if (document.getPages().some(page => {
    const { width, height } = page.getSize();
    return !Number.isFinite(width * height) || width <= 0 || height <= 0 || width > 2400 || height > 2400;
  })) throw new RecognitionError('These PDF pages are too large. Export them at a standard sheet-music page size.', 400);
}

const PERCUSSION_INSTRUMENTS: Instrument[] = ['perc-conga', 'perc-bongo', 'perc-timbal', 'perc-clave', 'perc-kit'];

/** The app's percussion legends, so written symbols map to the strokes the editor knows. */
function percussionLegend(): string {
  return PERCUSSION_INSTRUMENTS.map(instrument => {
    const strokes = getPercStrokes(instrument) ?? [];
    const lines = strokes.map(s => `  - staffLine "${s.staffLine}", notehead "${s.notehead ?? s.noteType ?? 'normal'}"${s.marcato ? ' with marcato' : ''}: ${s.label}`);
    return `${instrument}:\n${lines.join('\n')}`;
  }).join('\n');
}

function systemPrompt(percussion: boolean): string {
  return [
    'You transcribe printed sheet music from a PDF into JSON that matches the provided schema exactly. Transcribe what is printed; do not compose or complete anything. Where a symbol is unreadable, use a rest of the right duration rather than a guess.',
    '',
    'Pieces: a PDF may hold several separate pieces (each with its own title or header). Return one entry per piece. A single piece with several instrument staves is ONE piece with one track per staff (or per part). Use the printed title when there is one, else "".',
    '',
    'Measures: list every bar of a track in reading order, including bars that repeat identically. Set timeSignature only on a bar where the meter changes, otherwise null. Use at most two voices per bar; put stems-up material in the first voice and stems-down in the second. Events are in time order and their durations must fill the bar.',
    '',
    'Durations are in quarter-note units: whole = 4, half = 2, quarter = 1, eighth = 0.5, sixteenth = 0.25. Do NOT fold dots or triplets into the number: a dotted quarter is durationQN 1 with dotted true; a triplet eighth is durationQN 0.5 with triplet true. Tuplets other than triplets: approximate with the nearest plain values. Set tieToNext on a note tied to the next one.',
    '',
    'Pitched notes: give midi (middle C = 60), honouring clef, key signature, accidentals carried through the bar, and 8va/8vb lines; staffLine and notehead are null. A chord is kind "chord" with two or more entries in notes. Choose the instrument from the enum: piano for grand staff, guitar/bass/tres/cuatro/tiple/ukulele/mandolin when named, otherwise "staff".',
    '',
    `Percussion: use kind "note" with midi null, staffLine as the written position on the five-line staff in letter/octave form (lines from bottom: e/4 g/4 b/4 d/5 f/5; spaces: f/4 a/4 c/5 e/5; ledger positions continue the pattern), and notehead from the enum ("x" for cross heads, "plus", "circled", "slash", "slashed", "diamond", "triangle-up", "triangle-down", "square", "ornate-x", otherwise "normal"). Set marcato when the note carries a marcato accent. Pick the instrument whose legend fits the part:\n${percussionLegend()}`,
    '',
    'Repeats: when a passage is enclosed in repeat barlines, write it ONCE in measures and add an entry to repeats with fromMeasure and throughMeasure (1-based, inclusive, counted in the once-written list) and count = total number of times it is played (a plain repeat sign means 2). Write first and second endings out explicitly instead of using repeats. Repeats must not overlap.',
    '',
    'Tempo: the printed metronome mark as quarter-notes per minute, else 100. keyFifths: sharps positive, flats negative, 0 for none.',
    percussion
      ? '\nThe person importing this score says it includes percussion: treat one-line staves and drum notation as percussion tracks using the legends above.'
      : '\nThe person importing this score expects standard pitched notation; only use a percussion instrument if the part is clearly unpitched.',
  ].join('\n');
}

export interface RecognizeOptions {
  percussion?: boolean;
  signal?: AbortSignal;
  /** Fallback document title (usually the PDF filename) when the score prints none. */
  title?: string;
}

function mapApiError(error: unknown, cancelled: boolean, timedOut: boolean): RecognitionError {
  if (error instanceof RecognitionError) return error;
  if (cancelled) return new RecognitionError('Recognition cancelled.', 499);
  if (timedOut || error instanceof Anthropic.APIConnectionTimeoutError) {
    return new RecognitionError('Recognition took too long. Try fewer pages or a clearer PDF.', 504);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new RecognitionError('PDF recognition is not configured on this server yet (invalid ANTHROPIC_API_KEY). You can still import MusicXML or MIDI.', 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new RecognitionError('Another PDF is being recognized. Please try again in a moment.', 429);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new RecognitionError('PDF recognition is unavailable. Please try again later.', 502);
  }
  if (error instanceof Anthropic.APIError && error.status === 529) {
    return new RecognitionError('PDF recognition is busy right now. Please try again in a moment.', 503);
  }
  if (error instanceof Anthropic.BadRequestError) {
    // Only admins reach this route, and the API's wording is what they need to fix the setup.
    return new RecognitionError(`PDF recognition request was rejected: ${error.message}`, 502);
  }
  console.error('PDF recognition failed:', error);
  return new RecognitionError('PDF recognition is unavailable. Please try again later.', 502);
}

/** Recognize every piece on the PDF's pages. Throws RecognitionError with the status to answer. */
export async function recognizePdf(bytes: Buffer, options: RecognizeOptions = {}): Promise<{ documents: ScoreDocument[] }> {
  await validatePdf(bytes);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new RecognitionError('PDF recognition is not configured on this server yet (missing ANTHROPIC_API_KEY). You can still import MusicXML or MIDI.', 503);
  }
  const timeout = AbortSignal.timeout(RECOGNITION_TIMEOUT_MS);
  const signal = AbortSignal.any([timeout, ...(options.signal ? [options.signal] : [])]);
  // An organization-level key must name the workspace to bill; a workspace-scoped key needs nothing more.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey, maxRetries: 1, ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}) });
  let response;
  try {
    // Streamed: the SDK refuses a non-streaming call that could outlive its
    // HTTP timeout at this output size, and the final message still carries
    // parsed_output for the structured format.
    response = await client.messages.stream({
      model: RECOGNITION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt(!!options.percussion),
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } },
          { type: 'text', text: 'Transcribe every piece of music on these pages.' },
        ],
      }],
      output_config: { effort: 'high', format: zodOutputFormat(recognitionOutputSchema) },
    }, { signal }).finalMessage();
  } catch (error) {
    throw mapApiError(error, !!options.signal?.aborted, timeout.aborted);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new RecognitionError('This score is too long to recognize in one go. Select fewer pages.', 413);
  }
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new RecognitionError('Some notation could not be recognized. Try a clearer PDF or fewer pages.', 422);
  }
  return { documents: toScoreDocuments(response.parsed_output, { title: options.title?.trim() || 'Imported score' }) };
}
