import { createClient } from '@/lib/supabase/server';
import { MAX_PDF_BYTES } from '@/lib/playsense-studio/pdf/policy.mjs';
import { readBoundedBody, recognizePdf, RecognitionError } from '@/lib/playsense-studio/pdf/recognize';

export const runtime = 'nodejs';
export const maxDuration = 240;

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Sign in to import a PDF score.' }, { status: 401, headers });
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return Response.json({ error: 'Only Studio admins can import scores.' }, { status: 403, headers });
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/pdf') {
      return Response.json({ error: 'Choose a PDF file.' }, { status: 415, headers });
    }
    const bytes = await readBoundedBody(request.body, MAX_PDF_BYTES);
    const result = await recognizePdf(bytes, {
      percussion: request.headers.get('x-score-percussion') === 'true',
      title: decodeURIComponent(request.headers.get('x-score-title') ?? ''),
      signal: request.signal,
    });
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof RecognitionError ? error.message : 'PDF import failed. Please try again.' },
      { status: error instanceof RecognitionError ? error.status : 500, headers });
  }
}
