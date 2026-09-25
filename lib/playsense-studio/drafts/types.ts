export type StudioOwnerKind = 'section' | 'exercise' | 'song';

/** Who a draft belongs to. section = class_item_score_sections.id;
 *  exercise = class_items.id (a class item's own score); song = play_sense_songs.id. */
export interface StudioDraftOwner {
  kind: StudioOwnerKind;
  id: string;
}

export function ownerKey(o: StudioDraftOwner): string {
  return `${o.kind}:${o.id}`;
}

/** The columns the draft policy needs from a studio_versions row. */
export interface VersionMeta {
  id: string;
  kind: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}
