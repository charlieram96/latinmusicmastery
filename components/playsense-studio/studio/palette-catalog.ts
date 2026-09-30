import catalog from '@/lib/playsense-studio/notation/symbol-catalog.json';
const families: Array<[string, RegExp]> = [
  ['Dinámica', /^dynamic/], ['Arpa y pedales', /^harp/], ['Notas y silencios', /^(note|rest|flag|augmentation)/],
  ['Claves y pentagramas', /^(.*Clef|clef|staff|leger)/], ['Compás y barras', /^(timeSig|barline)/],
  ['Alteraciones y microtonos', /^(accidental|accSagittal)/], ['Articulaciones', /^artic/],
  ['Adornos y trémolos', /^(ornament|tremolo|trill)/], ['Repeticiones y navegación', /^(repeat|coda|segno|daCapo|dalSegno|fine)/],
  ['Tempo y agógica', /^(met|fermata|breath|caesura)/], ['Cuerdas y arcos', /^(strings|bowed|plucked)/],
  ['Guitarra y tablatura', /^(guitar|fretboard|lute|.*StringTab)/], ['Vientos', /^(wind|brass|doubleTongue|tripleTongue)/],
  ['Percusión', /^(pict|percussion|unpitched|drum)/], ['Teclados y pedal', /^(keyboard|organ|accordion)/],
  ['Armonía y bajo cifrado', /^(csym|figbass|function)/], ['Voz y digitación', /^(vocal|fingering|lyrics)/],
  ['Notación antigua', /^(mensural|chant|medRen|kievan)/], ['Líneas y reguladores', /^(wiggle|arrow|line|bracket|octave|ottava)/],
];
const additions = [
  ['Crescendo','<','Líneas y reguladores'], ['Diminuendo','>','Líneas y reguladores'], ['Ligadura de unión','⌒','Líneas y reguladores'], ['Ligadura de expresión','⌢','Líneas y reguladores'],
  ['Puntillo','·','Notas y silencios'], ['Doble puntillo','··','Notas y silencios'], ['Tresillo','3','Grupos irregulares'], ['Dosillo','2','Grupos irregulares'], ['Quintillo','5','Grupos irregulares'], ['Seisillo','6','Grupos irregulares'], ['Septillo','7','Grupos irregulares'], ['Grupo personalizado','n:m','Grupos irregulares'],
  ...['Largo','Adagio','Andante','Moderato','Allegro','Presto','ritardando','rallentando','accelerando','rubato','a tempo','Tempo primo'].map(x=>[x,x,'Tempo y agógica']),
];
export const symbols = [...catalog.map(s => ({...s, family: families.find(([,re])=>re.test(s.name))?.[0] ?? 'Otros símbolos', label:s.name.replace(/([a-z])([A-Z])/g,'$1 $2')})), ...additions.map(([name,glyph,family])=>({name,glyph,family,label:name}))];
