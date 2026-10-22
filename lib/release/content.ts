/** The published snapshot uses the same authored content and media clocks as localhost. */
export const RELEASE_ID = '2026-10-22-localhost'
export function publishedContentEnabled() {
  return process.env.NODE_ENV === 'production' && process.env.LMM_PUBLISHED_CONTENT !== 'disabled'
}
