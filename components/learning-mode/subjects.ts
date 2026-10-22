/** The subject, never its position in a list, determines the illustration. */
export const worlds: [RegExp, string, string, string][] = [
  [/notaci|notation|nombres|names/i,'garden','El jardín de las notas','The note garden'],
  [/pulso|pulse|compás|meter/i,'train','El tren del pulso','The pulse train'],
  [/interval|altura|pitch|tones/i,'mountain','La montaña de los sonidos','Sound mountain'],
  [/subdiv|rítmica|rhythmic/i,'workshop','El taller del ritmo','The rhythm workshop'],
  [/escala|scale|arpeg/i,'stairs','La escalera musical','The musical staircase'],
  [/cromat|chromat|modula/i,'lab','El laboratorio de colores','The color laboratory'],
  [/expres|articula/i,'forest','El bosque de las emociones','The feeling forest'],
  [/repet|repeat|recorrido|navigation/i,'trail','La ruta de las señales','The sign trail'],
  [/clave|clef|voces|voices|two.part/i,'castle','El castillo de las llaves','The key castle'],
  [/repert|enton|sing/i,'stage','El escenario de las canciones','The song stage'],
  [/dictad|dictat|evalu/i,'ear','La misión del oído','The listening mission'],
  [/lectura|reading/i,'journey','El viaje de las melodías','The melody journey'],
]
export function worldSubject(title: string) { return worlds.find(([re]) => re.test(title)) }
export function worldName(title:string,index:number,es:boolean) {
  const match = worldSubject(title)
  return match ? match[es ? 2 : 3] : `${es ? 'Aventura musical' : 'Music adventure'} ${index+1}`
}
export function lessonSubject(title:string) {
  const subjects: [RegExp,string][] = [
    [/examen|exam|quiz|evaluación|assessment/i,'achievements'],
    [/historia|history|origen|origin/i,'history'],
    [/pentagrama|staff|líneas|lines|espacios|spaces/i,'staff'],
    [/clave|clef/i,'key'],
    [/silencio|rest/i,'rest'],
    [/cabeza|plica|corchete|barras de unión|notehead|stem|beam|flag/i,'writing'],
    [/duraci|duration|equival|relacion|relationship/i,'clock'],
    [/pulso|pulse|tempo|agógica|agogic/i,'clock'],
    [/compás|meter|métrica|metric|marcación|conduct|ternari|ternary|binari|binary/i,'conduct'],
    [/interval|segunda|tercera|cuarta|quinta|sexta|séptima|octava|second|third|fourth|fifth|sixth|seventh|octave|registro|register|altura|pitch/i,'mountain'],
    [/escala|scale|arpeg|grado|degree/i,'stairs'],
    [/alteraci|accidental|armadura|key signature|sostenid|sharp|bemol|flat|becuadro|natural|cromat|chromat/i,'lab'],
    [/repet|repeat|capo|segno|coda|recorrido|navigation|finales|endings/i,'trail'],
    [/dinámica|dynamic|matice|expres|emoci|fraseo|phrasing|articul|legato|staccato|acento|accent/i,'forest'],
    [/dictado|dictation|oído|ear|escuch|listen/i,'ear'],
    [/escrit|writing|escribe/i,'writing'],
    [/enton|sing|canto|song|repert/i,'stage'],
    [/ritm|rhythm|subdiv|corchea|semicorchea|eighth|sixteenth|síncopa|syncop|tresillo|triplet|quintillo|quintuplet|dosillo|duplet|puntillo|dotted/i,'playSense'],
    [/nota|note|nombre|name|blanca|half|redonda|whole|negra|quarter/i,'music'],
    [/lectura|reading|mayor|major|menor|minor|melod/i,'browseCourses'],
  ]
  return subjects.find(([re])=>re.test(title))?.[1] ?? 'journey'
}
