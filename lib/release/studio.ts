import type { StudioDraft } from '@/app/actions/studio-drafts'
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types'
import { readReleaseDocument } from './documents'
import approvedOwners from './studio-owners.json'

/** Only the explicitly published snapshot is visible to students; subsequent drafts stay private. */
export async function publishedScoreDrafts(owners: StudioDraftOwner[]): Promise<Record<string, StudioDraft>> {
  const keys = owners.map(ownerKey).filter(key => approvedOwners.includes(key))
  if (!keys.length) return {}
  const published = JSON.parse(await readReleaseDocument('local-artifacts/studio-preview/published-studio.json')) as Record<string, StudioDraft>
  return Object.fromEntries(keys.filter(key => published[key]).map(key => [key, published[key]]))
}
