// Run beside an official Audiveris installation, behind HTTPS in production.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { readBoundedBody, recognizePdfLocally, RecognitionError } from '../lib/playsense-studio/pdf/recognize.mjs';
import { MAX_PDF_BYTES } from '../lib/playsense-studio/pdf/policy.mjs';

const token = process.env.PLAYSENSE_PDF_WORKER_TOKEN;
if (!token || token.length < 32) throw new Error('Set PLAYSENSE_PDF_WORKER_TOKEN to a secret of at least 32 characters.');
const expected = Buffer.from(`Bearer ${token}`);
const server = createServer(async (request, response) => {
  const send = (status, body) => {
    if (response.destroyed) return;
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (request.method !== 'POST' || request.url !== '/recognize') return send(404, { error: 'Not found' });
  const actual = Buffer.from(request.headers.authorization ?? '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return send(401, { error: 'Unauthorized' });
  if (request.headers['content-type']?.split(';')[0] !== 'application/pdf') return send(415, { error: 'PDF required' });
  const controller = new AbortController();
  response.on('close', () => { if (!response.writableEnded) controller.abort(); });
  try {
    const bytes = await readBoundedBody(Readable.toWeb(request), MAX_PDF_BYTES);
    const result = await recognizePdfLocally(bytes, {
      percussion: request.headers['x-score-percussion'] === 'true', signal: controller.signal,
    });
    send(200, result);
  } catch (error) {
    send(error instanceof RecognitionError ? error.status : 500, {
      error: error instanceof RecognitionError ? error.message : 'Recognition failed',
    });
  }
});
server.requestTimeout = 240_000;
server.headersTimeout = 15_000;
const port = Number(process.env.PLAYSENSE_PDF_WORKER_PORT ?? 3016);
const host = process.env.PLAYSENSE_PDF_WORKER_HOST ?? '127.0.0.1';
server.listen(port, host, () => console.log(`PlaySense PDF worker listening on ${host}:${port}`));
