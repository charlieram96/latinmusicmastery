'use client'
import { createContext, useContext } from 'react'
export const adventureThemes = [
 {id:'garden',icon:'🌻',friends:['🐦','🐸','🦋'],decor:['🌱','🌼','🐇'],sky:'#eaf8ff',ground:'#f1f9e8',es:'El jardín de las notas',en:'The note garden',missionEs:'Mira, escucha y descubre un signo a la vez.',missionEn:'Look, listen and discover one symbol at a time.'},
 {id:'train',icon:'🚂',friends:['🚂','🚃','🥁'],decor:['🌳','🛤️','🚦'],sky:'#fff3de',ground:'#e8f4d9',es:'El tren del pulso',en:'The pulse train',missionEs:'Cada vagón lleva un pulso. Escucha antes de marcar el ritmo.',missionEn:'Each carriage carries a pulse. Listen before tapping the rhythm.'},
 {id:'sky',icon:'🎈',friends:['🐦','🪁','🎈'],decor:['☁️','❄️','🏔️'],sky:'#e3f5ff',ground:'#eee7ff',es:'El cielo de las alturas',en:'The pitch sky',missionEs:'Escucha qué sonido sube, baja o se queda en su lugar.',missionEn:'Listen for sounds going up, down or staying in place.'},
 {id:'prehistoric',icon:'🦕',friends:['🦕','🦖','🥁'],decor:['🌿','🌋','🪨'],sky:'#fff0dc',ground:'#f4e8ff',es:'El valle de los dinosaurios rítmicos',en:'The rhythmic dinosaur valley',missionEs:'Arma el ritmo con piezas pequeñas. Conserva el pulso.',missionEn:'Build rhythms with small pieces. Keep the pulse steady.'},
 {id:'castle',icon:'🏰',friends:['🗝️','🐉','👑'],decor:['🏰','✨','🌷'],sky:'#eee8ff',ground:'#fff1d2',es:'El castillo de las tonalidades',en:'The key castle',missionEs:'Busca la familia de notas y su nota de llegada.',missionEn:'Find the family of notes and its home note.'},
 {id:'forest',icon:'🌳',friends:['🦊','🐿️','🐦'],decor:['🌲','🍄','🍃'],sky:'#e6f4ed',ground:'#e0efd4',es:'El bosque de las melodías',en:'The melody forest',missionEs:'Escucha una frase, cántala y después une el camino.',missionEn:'Listen to a phrase, sing it, then connect the path.'},
 {id:'ocean',icon:'🐠',friends:['🐠','🐙','🐬'],decor:['🫧','🐚','🪸'],sky:'#e0f7ff',ground:'#c6eaf1',es:'El océano de los cambios',en:'The ocean of changes',missionEs:'Una alteración cambia el sonido. Escucha la diferencia.',missionEn:'An accidental changes a sound. Listen for the difference.'},
 {id:'art',icon:'🎨',friends:['🦋','🌺','🖌️'],decor:['🌸','🎨','🍃'],sky:'#fff0f4',ground:'#f1e5ff',es:'El jardín de las emociones',en:'The garden of feelings',missionEs:'Prueba suave, fuerte y expresivo, siguiendo los signos.',missionEn:'Try soft, loud and expressive sounds, following the signs.'},
 {id:'island',icon:'🗺️',friends:['🦜','⛵','🐢'],decor:['🌴','🌊','🧭'],sky:'#e0f5ff',ground:'#fff0cd',es:'Las islas de las señales',en:'The sign islands',missionEs:'Sigue las señales de repetición para encontrar el camino.',missionEn:'Follow repeat signs to find your way.'},
 {id:'space',icon:'🚀',friends:['🚀','🪐','⭐'],decor:['🌙','✨','🛰️'],sky:'#e7e8ff',ground:'#ddd6f4',es:'La galaxia de las claves',en:'The clef galaxy',missionEs:'Mira la clave: la misma posición puede tener otro nombre.',missionEn:'Check the clef: the same position can have another name.'},
 {id:'stage',icon:'🎭',friends:['🎤','🎻','🥁'],decor:['⭐','🎵','🎺'],sky:'#fff0e5',ground:'#f4def0',es:'El teatro de las canciones',en:'The song theatre',missionEs:'Ensaya por frases. Une la música cuando estés preparado.',missionEn:'Rehearse in phrases. Join the music when you feel ready.'},
 {id:'detective',icon:'🔎',friends:['🦉','🐾','🔎'],decor:['🫧','🐠','🐚'],sky:'#e1f5f8',ground:'#e4edff',es:'Detectives del sonido',en:'Sound detectives',missionEs:'Escucha, recuerda y comprueba. Puedes escuchar otra vez.',missionEn:'Listen, remember and check. You can listen again.'},
] as const
export type AdventureTheme = typeof adventureThemes[number]
export const AdventureThemeContext=createContext<AdventureTheme>(adventureThemes[0])
export function useAdventureTheme(){return useContext(AdventureThemeContext)}
