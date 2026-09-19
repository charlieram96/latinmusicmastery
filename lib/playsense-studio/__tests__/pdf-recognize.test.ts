import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';

const mocks = vi.hoisted(() => ({ parse: vi.fn(), ctor: vi.fn() }));
// The recognizer streams and awaits the final message; the mock resolves or rejects there.
const stream = (...args: unknown[]) => ({ finalMessage: () => mocks.parse(...args) });
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class FakeAnthropic {
    messages = { stream };
    constructor(opts?: unknown) { mocks.ctor(opts); }
  }
  Object.assign(FakeAnthropic, {
    APIError: actual.APIError, AuthenticationError: actual.AuthenticationError, RateLimitError: actual.RateLimitError,
    APIConnectionError: actual.APIConnectionError, APIConnectionTimeoutError: actual.APIConnectionTimeoutError, APIUserAbortError: actual.APIUserAbortError,
    BadRequestError: actual.BadRequestError,
  });
  return { ...actual, default: FakeAnthropic };
});
import Anthropic from '@anthropic-ai/sdk';
import { recognizePdf } from '../pdf/recognize';
import type { RecognitionOutput } from '../pdf/recognized-score';

async function pdf() {
  const document = await PDFDocument.create();
  document.addPage();
  return Buffer.from(await document.save());
}

const output: RecognitionOutput = { pieces: [{ title: 'Tumbao', initialTempo: 90, timeSignature: [4, 4], keyFifths: 0, tracks: [{
  displayName: 'Conga', instrument: 'perc-conga', repeats: [], measures: [{ timeSignature: null, voices: [{ events: [
    { kind: 'note', durationQN: 1, dotted: false, triplet: false, tieToNext: false, marcato: false, midi: null, staffLine: 'e/5', notehead: 'ornate-x', notes: null },
  ] }] }],
}] }] };

const reply = (over: Record<string, unknown> = {}) => ({ stop_reason: 'end_turn', parsed_output: output, content: [], usage: {}, ...over });

describe('recognizePdf', () => {
  beforeEach(() => { vi.stubEnv('ANTHROPIC_API_KEY', 'test-key'); mocks.parse.mockReset(); mocks.ctor.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());

  it('answers 503 without calling the API when no key is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 503 });
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it('sends the PDF as a document block with the percussion legend and returns validated documents', async () => {
    mocks.parse.mockResolvedValue(reply());
    const bytes = await pdf();
    const result = await recognizePdf(bytes, { percussion: true, title: 'tumbao' });
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].tracks[0].measures[0].voices[0].events[0]).toMatchObject({ kind: 'note', midi: 62, percussion: { strokeId: 'slap' } });
    const [params, options] = mocks.parse.mock.calls[0];
    expect(params.model).toBe('claude-opus-5');
    expect(params.output_config.format).toBeTruthy();
    const document = params.messages[0].content.find((b: { type: string }) => b.type === 'document');
    expect(document.source).toMatchObject({ type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') });
    expect(String(params.system)).toContain('perc-timbal');
    expect(String(params.system)).toContain('a/4');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps a truncated answer to 413 and an unparseable one to 422', async () => {
    mocks.parse.mockResolvedValueOnce(reply({ stop_reason: 'max_tokens', parsed_output: null }));
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 413 });
    mocks.parse.mockResolvedValueOnce(reply({ parsed_output: null }));
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 422 });
  });

  it('maps API failures to the statuses the dialog explains', async () => {
    mocks.parse.mockRejectedValueOnce(new Anthropic.AuthenticationError(401, { error: {} }, 'bad key', new Headers()));
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 503 });
    mocks.parse.mockRejectedValueOnce(new Anthropic.RateLimitError(429, { error: {} }, 'slow down', new Headers()));
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 429 });
    mocks.parse.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError());
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 504 });
    mocks.parse.mockRejectedValueOnce(new Anthropic.APIConnectionError({ message: 'down' }));
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 502 });
  });

  it('scopes the request to a workspace when one is configured', async () => {
    vi.stubEnv('ANTHROPIC_WORKSPACE_ID', 'wrkspc_123');
    mocks.parse.mockResolvedValue(reply());
    await recognizePdf(await pdf());
    expect(mocks.ctor).toHaveBeenCalledWith(expect.objectContaining({ defaultHeaders: { 'anthropic-workspace-id': 'wrkspc_123' } }));
    vi.stubEnv('ANTHROPIC_WORKSPACE_ID', '');
    mocks.ctor.mockReset();
    await recognizePdf(await pdf());
    expect(mocks.ctor.mock.calls[0][0]).not.toHaveProperty('defaultHeaders');
  });

  it('passes the reason of a rejected request through so an admin can act on it', async () => {
    mocks.parse.mockRejectedValueOnce(new Anthropic.BadRequestError(400, { error: { message: 'must include the anthropic-workspace-id header' } }, 'must include the anthropic-workspace-id header', new Headers()));
    await expect(recognizePdf(await pdf())).rejects.toMatchObject({ status: 502, message: expect.stringContaining('anthropic-workspace-id') });
  });

  it('still refuses invalid or oversized files before any API call', async () => {
    await expect(recognizePdf(Buffer.from('not a pdf'))).rejects.toMatchObject({ status: 400 });
    expect(mocks.parse).not.toHaveBeenCalled();
  });
});
