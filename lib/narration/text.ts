/** Short utterances avoid browser speech engines stalling on long paragraphs. */
export function narrationChunks(text: string, limit = 220): string[] {
  const words = text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim().split(' ')
  const result: string[] = []
  let current = ''
  for (const word of words) {
    if (current && current.length + word.length + 1 > limit) { result.push(current); current = '' }
    current += (current ? ' ' : '') + word
    if (/[.!?…]$/.test(word) && current.length > 55) { result.push(current); current = '' }
  }
  if (current) result.push(current)
  return result
}

export type NarrationVoice = { name: string; lang: string; voiceURI: string; localService: boolean }
// SpeechSynthesis exposes no gender field. Use documented voice names, never pitch-shift a male voice.
export function femaleVoices<T extends NarrationVoice>(voices: T[], language: string): T[] {
  return voices.filter(v => v.lang.toLowerCase().split(/[-_]/)[0] === language.split('-')[0]
    && /monica|mónica|paulina|angelica|angélica|sabina|elvira|dalia|helena|laura|lucia|lucía|samantha|ava|allison|susan|zira|aria|jenny|sonia|salli|joanna|female|google español|google español de estados unidos|google us english|google uk english female/i.test(v.name))
    .sort((a,b) => (voiceQuality(b) + (/es-(US|MX)/i.test(b.lang) ? 5 : 0)) - (voiceQuality(a) + (/es-(US|MX)/i.test(a.lang) ? 5 : 0)))
}
function voiceQuality(v: NarrationVoice) {
  return (/natural|neural|premium/i.test(v.name) ? 100 : /enhanced/i.test(v.name) ? 80 : !v.localService ? 60 : 20)
}
