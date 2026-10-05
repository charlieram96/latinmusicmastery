/** Experimental acoustic setup. No changes to authored scores or BLE profiles. */
export const ACOUSTIC_INSTRUMENTS = [
  { group: 'Body / Cuerpo', items: [['claps', 'Palmadas', 'Claps', '👏'], ['voice', 'Voz', 'Voice', '🎤']] },
  { group: 'Percussion / Percusión', items: [
    ['conga','Tumbadora / conga','Conga','🪘'], ['bongo','Bongó','Bongos','🪘'], ['timbale','Timbales','Timbales','🥁'],
    ['drums','Batería','Drum kit','🥁'], ['snare','Caja / redoblante','Snare drum','🥁'], ['kick','Bombo','Bass drum','🥁'],
    ['cajon','Cajón','Cajon','🪘'], ['clave','Claves','Claves','🥢'], ['cowbell','Campana','Cowbell','🔔'],
    ['guiro','Güiro','Guiro','🪇'], ['maracas','Maracas','Maracas','🪇'], ['tambourine','Pandereta','Tambourine','🪇'],
    ['shaker','Shaker','Shaker','🪇'], ['cymbal','Platillo','Cymbal','🥁'], ['jamblock','Jam block','Jam block','🥢'],
    ['triangle','Triángulo','Triangle','🔺'], ['vibraphone','Vibráfono','Vibraphone','🎹']] },
  { group: 'Brass / Metales', items: [['trumpet','Trompeta','Trumpet','🎺'], ['trombone','Trombón','Trombone','🎺'], ['horn','Trompa','French horn','📯'], ['tuba','Tuba','Tuba','📯']] },
  { group: 'Woodwinds / Maderas', items: [['soprano-sax','Saxofón soprano','Soprano saxophone','🎷'], ['alto-sax','Saxofón alto','Alto saxophone','🎷'], ['tenor-sax','Saxofón tenor','Tenor saxophone','🎷'], ['baritone-sax','Saxofón barítono','Baritone saxophone','🎷'], ['flute','Flauta','Flute','🪈'], ['clarinet','Clarinete','Clarinet','🪈'], ['oboe','Oboe','Oboe','🪈'], ['bassoon','Fagot','Bassoon','🪈']] },
  { group: 'Strings / Cuerdas', items: [['violin','Violín','Violin','🎻'], ['viola','Viola','Viola','🎻'], ['cello','Violonchelo','Cello','🎻'], ['double-bass','Contrabajo','Double bass','🎻'], ['harp','Arpa','Harp','🪉']] },
  { group: 'Guitars / Guitarras', items: [['acoustic-guitar','Guitarra acústica','Acoustic guitar','🎸'], ['electric-guitar','Guitarra eléctrica','Electric guitar','🎸'], ['bass','Bajo eléctrico','Electric bass','🎸'], ['tres','Tres cubano','Cuban tres','🎸'], ['cuatro','Cuatro','Cuatro','🎸'], ['ukulele','Ukelele','Ukulele','🎸']] },
  { group: 'Keys / Teclados', items: [['piano','Piano','Piano','🎹'], ['keyboard','Teclado','Keyboard','🎹'], ['accordion','Acordeón','Accordion','🪗']] },
] as const

export function noiseReference(samples: number[]) {
  const sorted = samples.filter(Number.isFinite).sort((a,b) => a-b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : 0
}
export function clapDetectionFloor(energies: number[]) {
  const soft = energies.filter(value => Number.isFinite(value) && value > 0).sort((a,b) => a-b)
  // Use measured filtered onset energy, not the unfiltered dBFS meter.
  return soft.length >= 3 ? Math.max(.00001, Math.min(.05, soft[0] * .4)) : null
}
