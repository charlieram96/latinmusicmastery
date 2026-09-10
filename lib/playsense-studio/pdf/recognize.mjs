import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { MAX_PDF_BYTES, MAX_PDF_PAGES, MAX_RECOGNITION_BYTES, RECOGNITION_TIMEOUT_MS } from './policy.mjs';

export class RecognitionError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

/** Bound streamed bodies even when Content-Length is missing or incorrect. */
export async function readBoundedBody(body, limit) {
  if (!body) throw new RecognitionError('Choose a PDF to import.', 400);
  const reader = body.getReader();
  const chunks = [];
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
  } finally { reader.releaseLock(); }
}

async function validatePdf(bytes) {
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new RecognitionError('Choose a PDF under 4 MB.', 413);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new RecognitionError('This file is not a valid PDF.', 400);
  let document;
  try { document = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch { throw new RecognitionError('This PDF could not be read. Use an unlocked, undamaged PDF.', 400); }
  if (!document.getPageCount() || document.getPageCount() > MAX_PDF_PAGES) {
    throw new RecognitionError(`Choose between 1 and ${MAX_PDF_PAGES} score pages.`, 400);
  }
  // Reject unusually large pages before the recognizer rasterizes them.
  if (document.getPages().some(page => {
    const { width, height } = page.getSize();
    return !Number.isFinite(width * height) || width <= 0 || height <= 0 || width > 2400 || height > 2400;
  })) throw new RecognitionError('These PDF pages are too large. Export them at a standard sheet-music page size.', 400);
}

async function executable() {
  const configured = process.env.PLAYSENSE_AUDIVERIS_BIN;
  const candidates = configured ? [configured] : [
    path.join(process.cwd(), '.local/audiveris/Audiveris.app/Contents/MacOS/Audiveris'),
    '/Applications/Audiveris.app/Contents/MacOS/Audiveris',
    '/opt/audiveris/bin/Audiveris',
  ];
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* Try next installed location. */ }
  }
  throw new RecognitionError('PDF recognition is not configured on this server yet. You can still import MusicXML or MIDI.', 503);
}

/** One CPU-intensive job per process, also shared across Next development reloads. */
const slotKey = Symbol.for('playsense.pdf-recognition.active');

async function runAudiveris(bin, args, cwd, signal) {
  if (signal?.aborted) throw new RecognitionError('Recognition cancelled.', 499);
  await new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: {
        ...process.env,
        TESSDATA_PREFIX: process.env.TESSDATA_PREFIX || path.join(cwd, '../tessdata'),
        XDG_CONFIG_HOME: cwd,
        XDG_DATA_HOME: cwd,
        XDG_CACHE_HOME: cwd,
        JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS ?? ''} -Djava.awt.headless=true -Xmx2g`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let termination = null;
    let killTimer;
    const kill = (force) => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
        else child.kill(force ? 'SIGKILL' : 'SIGTERM');
      } catch { /* Already exited. */ }
    };
    const stop = (reason) => {
      if (termination) return;
      termination = reason;
      kill(false);
      killTimer = setTimeout(() => kill(true), 1500);
      killTimer.unref();
    };
    const timer = setTimeout(() => stop(new RecognitionError('Recognition took too long. Try fewer pages or a clearer PDF.', 504)), RECOGNITION_TIMEOUT_MS);
    const abort = () => stop(new RecognitionError('Recognition cancelled.', 499));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    // Drain logs without retaining user score content or unbounded process output.
    child.stdout.resume();
    child.stderr.resume();
    const cleanup = () => { clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort); };
    child.once('error', () => { cleanup(); reject(new RecognitionError('The PDF recognition engine could not start.', 503)); });
    child.once('close', (code) => {
      cleanup();
      if (termination) reject(termination);
      else if (code !== 0) reject(new RecognitionError('Some notation could not be recognized. Try a clearer PDF or fewer pages.'));
      else resolve(undefined);
    });
  });
}

async function collectScores(directory) {
  const files = [];
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && /\.(mxl|musicxml)$/i.test(entry.name)) files.push(full);
    }
  };
  await visit(directory);
  if (!files.length) throw new RecognitionError('No playable notation was found. Try a clearer scan, or import the original MusicXML file.');
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length > 20) throw new RecognitionError('Too many separate pieces were detected. Select fewer pages.');
  let total = 0;
  const scores = [];
  for (const file of files) {
    const info = await stat(file);
    total += info.size;
    if (total > MAX_RECOGNITION_BYTES) throw new RecognitionError('This score is too large. Select fewer pages.', 413);
    scores.push({ filename: path.basename(file), data: (await readFile(file)).toString('base64') });
  }
  return { scores };
}

/** Local recognition is also used by the standalone worker. */
export async function recognizePdfLocally(bytes, { percussion = false, signal = undefined } = {}) {
  if (globalThis[slotKey]) throw new RecognitionError('Another PDF is being recognized. Please try again in a moment.', 429);
  globalThis[slotKey] = true;
  let job;
  try {
    await validatePdf(bytes);
    const bin = await executable();
    if (signal?.aborted) throw new RecognitionError('Recognition cancelled.', 499);
    const engineHome = process.env.PLAYSENSE_AUDIVERIS_HOME || path.join(process.cwd(), '.local/audiveris/home');
    await mkdir(engineHome, { recursive: true });
    job = await mkdtemp(path.join(tmpdir(), 'playsense-pdf-'));
    const input = path.join(job, 'score.pdf');
    const output = path.join(job, 'output');
    await mkdir(output);
    await writeFile(input, bytes, { mode: 0o600 });
    const args = ['-batch', '-transcribe', '-export', '-output', output,
      '-constant', 'org.audiveris.omr.sheet.BookManager.useOpus=false',
    ];
    if (percussion) args.push(
      '-constant', 'org.audiveris.omr.sheet.ProcessingSwitches.oneLineStaves=true',
      '-constant', 'org.audiveris.omr.sheet.ProcessingSwitches.drumNotation=true',
    );
    args.push('--', input);
    await runAudiveris(bin, args, engineHome, signal);
    return await collectScores(output);
  } finally {
    try { if (job) await rm(job, { recursive: true, force: true }); }
    finally { globalThis[slotKey] = false; }
  }
}

/** A configured worker keeps Java/OMR outside the web deployment. */
export async function recognizePdf(bytes, options = {}) {
  const endpoint = process.env.PLAYSENSE_PDF_WORKER_URL;
  if (!endpoint) return recognizePdfLocally(bytes, options);
  const token = process.env.PLAYSENSE_PDF_WORKER_TOKEN;
  if (!token) throw new RecognitionError('PDF recognition is not configured on this server yet.', 503);
  await validatePdf(bytes);
  const signal = AbortSignal.any([AbortSignal.timeout(RECOGNITION_TIMEOUT_MS + 5000), ...(options.signal ? [options.signal] : [])]);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', body: bytes, signal, redirect: 'error',
      headers: { 'Content-Type': 'application/pdf', Authorization: `Bearer ${token}`, 'X-Score-Percussion': options.percussion ? 'true' : 'false' },
    });
    if (!response.ok) {
      const messages = {
        429: 'Another PDF is being recognized. Please try again in a moment.',
        422: 'Some notation could not be recognized. Try a clearer PDF or fewer pages.',
        504: 'Recognition took too long. Try fewer pages or a clearer PDF.',
      };
      throw new RecognitionError(messages[response.status] ?? 'PDF recognition is unavailable. Please try again later.', response.status === 429 ? 429 : 502);
    }
    const body = await readBoundedBody(response.body, MAX_RECOGNITION_BYTES * 1.5);
    const result = JSON.parse(body.toString());
    if (!Array.isArray(result.scores) || !result.scores.length || result.scores.length > 20 || result.scores.some(score =>
      typeof score.filename !== 'string' || !/\.(mxl|musicxml)$/i.test(score.filename) || typeof score.data !== 'string' || !score.data.length
    )) throw new Error('Invalid recognition response');
    return result;
  } catch (error) {
    if (error instanceof RecognitionError) throw error;
    if (options.signal?.aborted) throw new RecognitionError('Recognition cancelled.', 499);
    if (signal.aborted) throw new RecognitionError('Recognition took too long. Try fewer pages.', 504);
    throw new RecognitionError('PDF recognition is unavailable. Please try again later.', 502);
  }
}
