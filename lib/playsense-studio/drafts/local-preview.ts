import {publishedContentEnabled} from '@/lib/release/content';
import {readReleaseDocument,writeReleaseDocument} from '@/lib/release/documents';
import { headers } from 'next/headers';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { StudioDraft } from '@/app/actions/studio-drafts';
import { ownerKey, type StudioDraftOwner } from './types';

// Only explicitly adopted local previews live here. Other owners continue
// through the existing draft workflow. Never used on the hosted site.
const file = path.join(process.cwd(), 'local-artifacts/studio-preview/drafts.json');
async function enabled() {
  if (publishedContentEnabled()) return true;
  if (process.env.NODE_ENV !== 'development') return false;
  const host = (await headers()).get('host')?.split(':')[0];
  return host === 'localhost' || host === '127.0.0.1';
}
async function read(): Promise<Record<string, StudioDraft>> {
  try { return JSON.parse(publishedContentEnabled()?await readReleaseDocument('local-artifacts/studio-preview/drafts.json'):await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
}
export async function localPreviewDraft(owner: StudioDraftOwner) {
  return await enabled() ? (await read())[ownerKey(owner)] : undefined;
}
let pending: Promise<unknown> = Promise.resolve();
export async function saveLocalPreviewDraft(owner: StudioDraftOwner, draft: StudioDraft): Promise<boolean> {
  if (!(await enabled())) return false;
  const result = pending.then(async () => {
    const drafts = await read();
    if (!drafts[ownerKey(owner)]) return false;
    drafts[ownerKey(owner)] = draft;
    if(publishedContentEnabled())await writeReleaseDocument('local-artifacts/studio-preview/drafts.json',JSON.stringify(drafts,null,2)+'\n');
    else{await writeFile(file + '.tmp', JSON.stringify(drafts, null, 2) + '\n');await rename(file + '.tmp', file);}
    return true;
  });
  pending = result.catch(() => undefined);
  return result;
}
