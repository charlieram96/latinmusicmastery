/* Authored concept checks plus deterministic questions from each class score.
   Results describe answers, never claim to measure singing or instrumental skill. */
const fs=require('node:fs'),path=require('node:path'),{get}=require('@tonaljs/note');
const root=path.resolve('local-artifacts/solfeo-course/production');
const lessons=JSON.parse(fs.readFileSync(path.join(root,'curriculum.json'))).lessons;
const names={C:'Do',D:'Re',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'};
const name=p=>p.replace(/^([A-G])([#b]*)(-?\d+)$/,(_,n,a,o)=>`${names[n]}${({'#':' sostenido','##':' doble sostenido',b:' bemol',bb:' doble bemol'}[a]||'')} ${o}`);
const q=(prompt,answer,others,explanation)=>({prompt,choices:[String(answer),...others.map(String)].filter((v,i,a)=>a.indexOf(v)===i),answer:0,explanation:explanation||`La respuesta es ${answer}.`});
const fact=(prompt,a,b,c)=>q(prompt,a,[b,c]);
const concepts={
 '1.3':[fact('¿Qué nota fija la clave de Sol en segunda línea?','Sol 4','Sol 3','Do 4'),fact('¿Qué notas ocupan los cuatro espacios de la clave de Sol, de abajo arriba?','Fa–La–Do–Mi','Mi–Sol–Si–Re','Do–Mi–Sol–Si')],
 '1.4':[fact('¿Dónde se escribe Do central en clave de Sol?','Primera línea adicional inferior','Primer espacio interior','Tercera línea'),fact('¿Qué cambia al añadir líneas adicionales?','Se amplía el registro escrito','Cambian los nombres de todas las líneas','Cambia el valor rítmico')],
 '1.5':[fact('¿Cuántas negras equivalen a una redonda?','4','2','8'),fact('¿Qué silencio tiene la misma duración que una corchea?','Silencio de corchea','Silencio de negra','Silencio de blanca')],
 '1.6':[fact('¿Cuántas corcheas equivalen a una blanca?','4','2','8'),fact('¿Qué sucede con la duración en cada paso de redonda a blanca y de blanca a negra?','Se divide por dos','Se duplica','Se conserva')],
 '1.7':[fact('¿Qué parte de la nota señala su posición en el pentagrama?','La cabeza','La barra de compás','El número de página'),fact('¿Qué parte vertical acompaña a blancas, negras y figuras menores?','La plica','La armadura','La clave')],
 '2.1':[fact('¿Qué describe el tempo?','La velocidad del pulso','La altura de las notas','La cantidad de líneas'),fact('¿Qué indica 60 BPM si la unidad es la negra?','60 negras por minuto','60 compases por segundo','60 notas por compás')],
 '2.6':[fact('¿Qué compás representa el compasillo partido?','2/2','4/4','3/4'),fact('En 2/2, ¿cuál es la unidad de tiempo?','La blanca','La negra','La corchea')],
 '3.1':[fact('¿Cuántos semitonos forman un tono?','2','1','3'),fact('¿Qué distancia hay de Mi natural a Fa natural?','Un semitono','Un tono','Dos tonos')],
 '3.2':[fact('¿Cuánto eleva una nota un doble sostenido?','Dos semitonos','Un semitono','Una octava'),fact('¿Qué hace el becuadro?','Anula la alteración aplicable','Siempre sube un semitono','Siempre baja dos semitonos')],
 '3.3':[fact('Normalmente, ¿hasta dónde afecta una alteración accidental dentro del compás?','A la misma nota y octava hasta la barra de compás','A todas las notas de la pieza','Solo al signo de clave'),fact('Después de una barra de compás, ¿qué referencia vuelve a regir?','La armadura, salvo nueva alteración o continuación ligada','Todas las notas se vuelven sostenidas','Se elimina la armadura')],
 '3.4':[fact('En temperamento igual, ¿qué sonido comparte Do sostenido 4?','Re bemol 4','Re natural 4','Do bemol 4'),fact('¿Qué sonido comparte Re doble bemol 4?','Do natural 4','Re natural 4','Mi bemol 4')],
 '3.14':[fact('Al invertir una tercera, ¿qué intervalo resulta?','Una sexta','Una quinta','Una cuarta'),fact('Al invertir un intervalo mayor simple, ¿qué cualidad resulta?','Menor','Mayor','Justa')],
 '4.3':[fact('¿Cuánto añade un puntillo al valor de una figura?','La mitad de su valor','El doble de su valor','Una negra siempre'),fact('¿Cuántos tiempos de negra dura una blanca con puntillo?','3','2','4')],
 '4.4':[fact('¿Cuántos tiempos de negra dura una negra con doble puntillo?','1,75','1,5','2'),fact('¿Cuántos tiempos de negra dura una negra con triple puntillo?','1,875','1,75','2')],
 '4.6':[fact('¿Qué es una anacrusa?','Un comienzo antes del primer tiempo fuerte del compás completo','Un cambio de clave','Una pausa final obligatoria')],
 '4.7':[fact('En la lectura compuesta habitual de 6/8, ¿cómo se agrupan las seis corcheas?','En dos grupos de tres','En tres grupos de dos','En seis grupos de tres')],
 '4.9':[fact('Una agrupación habitual de 5/8 es…','2+3 o 3+2','3+3','4+4')],
 '4.10':[fact('Un tresillo 3:2 reparte…','Tres valores en el tiempo de dos iguales','Dos valores en el tiempo de tres iguales','Tres compases en dos páginas')],
 '4.11':[fact('Un seisillo 6:4 reparte…','Seis valores en el tiempo de cuatro iguales','Cuatro valores en el tiempo de seis iguales','Seis tiempos completos siempre')],
 '4.12':[fact('¿Son idénticas la agrupación 3+3 y la agrupación 2+2+2?','No: distribuyen los acentos de manera distinta','Sí: siempre se acentúan igual','No: una tiene más notas que la otra')],
 '4.13':[fact('En un quintillo 5:4, cada valor ocupa…','4/5 del valor ordinario','5/4 del valor ordinario','Dos valores ordinarios')],
 '5.1':[fact('¿Cuál es el patrón de la escala mayor?','T–T–ST–T–T–T–ST','T–ST–T–T–ST–T–T','ST–T–T–ST–T–T–T')],
 '5.2':[fact('¿Qué indica la armadura?','Alteraciones habituales de la tonalidad','La velocidad exacta','La duración de cada compás')],
 '5.3':[fact('¿Cuál es el orden de los sostenidos en la armadura?','Fa–Do–Sol–Re–La–Mi–Si','Si–Mi–La–Re–Sol–Do–Fa','Do–Re–Mi–Fa–Sol–La–Si')],
 '5.4':[fact('¿Cuál es el orden de los bemoles en la armadura?','Si–Mi–La–Re–Sol–Do–Fa','Fa–Do–Sol–Re–La–Mi–Si','Do–Re–Mi–Fa–Sol–La–Si')],
 '5.5':[fact('¿Qué comparten una tonalidad mayor y su relativa menor?','La armadura','Siempre la misma tónica','Siempre el mismo acorde de dominante')],
 '5.6':[fact('¿Qué grado se eleva en la escala menor armónica respecto a la natural?','El séptimo','El cuarto','El segundo'),fact('En la forma melódica clásica ascendente se elevan…','Sexto y séptimo grados','Segundo y tercero','Cuarto y quinto')],
 '7.1':[fact('¿Cómo avanza una escala cromática?','Por semitonos','Solo por tonos','Solo por terceras')],
 '7.5':[fact('¿Qué implica una modulación?','Un cambio de centro tonal','Cualquier nota accidental aislada','Solo un cambio de volumen')],
 '8.3':[fact('¿Qué pide staccato?','Separar o acortar la articulación','Duplicar el tempo','Cambiar la tonalidad'),fact('¿Qué indica una ligadura de expresión?','Agrupación y continuidad de fraseo','Sumar obligatoriamente dos notas iguales','Cambiar todas las notas por silencios')],
 '8.4':[fact('¿Qué destaca un acento escrito?','Un ataque o énfasis de la nota','Una nueva armadura','Una nueva clave')],
 '8.7':[fact('¿Qué pide accelerando?','Acelerar progresivamente','Disminuir intensidad','Volver al comienzo'),fact('¿Qué pide ritardando?','Retardar progresivamente','Aumentar intensidad','Tocar una octava más alta')],
 '8.8':[fact('¿Qué pide a tempo después de una modificación agógica?','Recuperar el tempo anterior','Volver al principio','Cambiar de clave')],
 '8.9':[fact('¿Qué señala 8va sobre un pasaje?','Sonar una octava más agudo','Sonar un semitono más agudo','Duplicar la duración')],
 '9.1':[fact('¿Qué separa una barra simple?','Compases','Siempre dos movimientos','Las líneas del pentagrama')],
 '9.2':[fact('¿Qué permiten las casillas de primera y segunda vez?','Finales distintos según la pasada','Cambiar de instrumento obligatoriamente','Omitir todo el tema siempre')],
 '10.1':[fact('¿Qué nota fija la clave de Fa en cuarta línea?','Fa 3','Fa 4','Do 4')],
 '10.2':[fact('¿Qué nota fija una clave de Do en su línea de referencia?','Do central','Sol 4','Fa 3')],
 '10.3':[fact('¿Qué une una llave de sistema de piano?','Pentagramas que se leen simultáneamente','Dos piezas sin relación','Dos páginas que nunca suenan juntas')],
 '10.4':[fact('En una lectura a dos voces, ¿qué debe conservarse entre ambas?','La coordinación temporal','La misma altura en cada nota','La misma dirección melódica siempre')],
 '12.1':[fact('Antes de escribir un dictado, conviene identificar…','Pulso, compás y referencia tonal','Solo el nombre del compositor','Solo la última figura')]
};
const extraConcepts={
 '1.5':[fact('Si la negra vale un tiempo, ¿cuánto dura una blanca?','2 tiempos','1 tiempo','4 tiempos'),fact('¿Cuál tiene cabeza vacía y no lleva plica?','La redonda','La negra','La corchea')],
 '1.6':[fact('¿Cuántas semicorcheas equivalen a una negra?','4','2','8'),fact('¿Cuántas blancas equivalen a una redonda?','2','4','8')],
 '1.7':[fact('Una corchea aislada tiene…','Un corchete','Dos corchetes','Ningún corchete'),fact('Las barras de unión permiten…','Agrupar figuras menores sin cambiar sus valores','Convertir negras en redondas','Cambiar la altura de las notas')],
 '3.5':[fact('En temperamento igual, ¿qué nota comparte tecla con Mi sostenido?','Fa natural','Mi natural','Fa sostenido'),fact('¿Qué nota comparte tecla con Si sostenido?','Do natural','Si natural','Do sostenido'),fact('¿Qué nota comparte tecla con Do bemol?','Si natural','Do natural','Si bemol'),fact('¿Qué nota comparte tecla con Fa doble sostenido?','Sol natural','Fa natural','Sol sostenido')],
 '4.2':[fact('¿Cuántos corchetes tiene una semifusa aislada?','4','3','2'),fact('¿Cuántas fusas equivalen a una negra?','8','4','16'),fact('¿Cuántas semifusas equivalen a una corchea?','8','4','16')],
 '6.1':[fact('¿Qué conviene reconocer primero en la lectura tonal?','La tónica y la armadura','Solo la última barra','Solo el tempo'),fact('¿Qué grado actúa como dominante?','El quinto','El segundo','El cuarto'),fact('¿Qué identifica una armadura con dos sostenidos?','Fa sostenido y Do sostenido','Si bemol y Mi bemol','Do sostenido y Re sostenido'),fact('¿Cómo se prepara una lectura de entonación?','Estableciendo una referencia tonal y un tempo cómodo','Saltando los silencios','Cantando todas las notas a la misma altura')],
 '7.3':[fact('¿Qué conservan dos notas enarmónicas en temperamento igual?','La altura sonora','Necesariamente el nombre','Necesariamente la función tonal')],
 '7.6':[fact('Un acorde pivote pertenece…','A dos tonalidades','Solo a una figura rítmica','A una clave de percusión'),fact('En Do mayor, La menor es el grado…','vi','V','IV'),fact('En Sol mayor, La menor es el grado…','ii','IV','I')],
 '8.5':[fact('¿Qué sugiere adagio?','Movimiento pausado','Máxima rapidez','Cambio de armadura'),fact('¿Qué sugiere andante?','Movimiento cómodo como al caminar','Siempre una cifra fija de BPM','Un silencio completo'),fact('¿Qué significa moderato?','Velocidad moderada','Fuerza máxima','Volver al segno')],
 '8.6':[fact('¿Qué indica presto?','Movimiento muy rápido','Movimiento pausado','Diminuir intensidad'),fact('¿Qué sugiere vivace?','Vivacidad y energía','Silencio absoluto','Volver al principio'),fact('Allegretto suele ser…','Relativamente vivo, generalmente menos rápido que allegro','Siempre más rápido que prestissimo','Una indicación de altura')],
 '9.1':[fact('¿Qué suele señalar una barra final?','El final de una pieza o sección','Un sostenido','Una nueva clave'),fact('¿Qué indican los puntos junto a una barra de repetición?','Un retorno o un comienzo de repetición','Una alteración de altura','Un silencio de negra'),fact('¿Cambia una barra de compás el valor de las figuras?','No','Sí: las duplica','Sí: las divide por dos')],
 '9.3':[fact('En D.C. al Fine, después de volver al comienzo, se termina…','En Fine','Siempre en la última barra escrita','En el primer silencio'),fact('Con cuatro compases y Fine al final del segundo, D.C. al Fine recorre…','1–2–3–4 / 1–2','1–2 / 4','4–3–2–1'),fact('¿D.C. y D.S. significan exactamente lo mismo?','No','Sí','Solo si hay sostenidos')],
 '9.4':[fact('¿Qué identifica el segno?','El punto de regreso indicado por D.S.','La duración de una negra','La tónica'),fact('D.S. al Fine termina…','En Fine después del retorno al segno','Antes de volver al segno','Siempre en la coda'),fact('¿Puede el segno estar después del primer compás?','Sí','No','Solo en clave de Fa')],
 '9.5':[fact('¿Qué es una coda?','Una sección conclusiva','Una clave','Una figura rítmica'),fact('¿Segno y coda tienen el mismo símbolo?','No','Sí','Solo en compás binario'),fact('Tras el retorno de D.C. al Coda, el salto a la coda se hace…','En la indicación a Coda','En cualquier silencio','Siempre en el primer compás')],
 '12.1':[fact('En un dictado, ¿para qué sirve una referencia tonal?','Para orientar la identificación de alturas','Para omitir el ritmo','Para cambiar el compás'),fact('¿Qué se debe conservar al escribir silencios?','Su posición y duración','Solo su nombre','Solo el último silencio'),fact('¿Cuándo conviene comparar el dictado con la solución?','Después de completar el intento','Antes de escuchar','En lugar de escuchar')]
};
Object.assign(extraConcepts,{
 ...extraConcepts,
 '1.3':[fact('¿En qué línea se escribe Si 4 en clave de Sol?','Tercera línea','Primera línea','Quinta línea'),fact('¿En qué espacio se escribe Do 5 en clave de Sol?','Tercer espacio','Primer espacio','Cuarto espacio')],
 '1.4':[fact('¿Dónde se escribe La 5 en clave de Sol?','Primera línea adicional superior','Quinto espacio interior','Primera línea inferior'),fact('¿Qué nota ocupa el espacio debajo de la primera línea en clave de Sol?','Re 4','Do 4','Mi 4')],
 '1.8':[fact('¿Cómo se cuentan las líneas del pentagrama?','De abajo hacia arriba','De arriba hacia abajo','Desde la línea central'),fact('¿Qué letra representa Fa?','F','E','A'),fact('¿Cuántas negras equivalen a una blanca?','2','4','1'),fact('¿Qué nota ocupa el primer espacio en clave de Sol?','Fa 4','Mi 4','Sol 4')],
 '2.13':[fact('Al reducir proporcionalmente todas las figuras a la mitad, ¿qué debe conservarse?','La relación entre las duraciones','El mismo símbolo de cada figura','El mismo número de corchetes'),fact('Una blanca reducida a la mitad se convierte en…','Una negra','Una redonda','Una corchea')],
 '8.1':[fact('¿Qué matiz es más suave: piano o forte?','Piano','Forte','Son iguales'),fact('¿Qué abreviatura corresponde a mezzo forte?','mf','mp','ff'),fact('¿Qué pide pianissimo?','Una intensidad muy suave','Un tempo muy lento','Una nota muy grave')],
 '8.2':[fact('¿Qué significa diminuendo?','Reducir gradualmente la intensidad','Reducir siempre el tempo','Subir la afinación'),fact('¿Un crescendo exige acelerar?','No: intensidad y tempo son aspectos distintos','Sí, siempre','Solo con corcheas'),fact('¿Cuál es el opuesto de crescendo?','Diminuendo','Legato','Da Capo')],
 '8.7':[fact('¿Un ritardando cambia las proporciones escritas de las figuras?','No: modifica el pulso progresivamente','Sí: toda figura se vuelve negra','Sí: elimina los silencios'),fact('¿Rallentando sugiere acelerar o frenar?','Frenar progresivamente','Acelerar progresivamente','Cambiar la tonalidad')],
 '8.8':[fact('¿Qué indica tempo primo?','Recuperar el tempo inicial','Duplicar el tempo actual','Volver al primer compás'),fact('¿Qué permite el rubato?','Flexibilidad expresiva del tiempo','Cambiar libremente todas las alturas','Ignorar la frase musical'),fact('¿Qué permite un calderón?','Prolongar expresivamente una nota o silencio','Acortar siempre la nota a la mitad','Cambiar de clave')]
});
const output=[];
for(const l of lessons){
 const key=`${l.module}.${l.number}`,questions=[...(concepts[key]||[]),...(extraConcepts[key]||[])];
 if(l.editorialExercise){const e=l.editorialExercise;questions.unshift(q(e.prompt,e.choices[e.answer],e.choices.filter((_,i)=>i!==e.answer)))}
 const refs=l.scores.flatMap(r=>r.score.events.filter(e=>!e.rest&&e.pitch).map(e=>({e,score:r.score})))
 // Name reading is spelling-aware: double flats never silently become naturals.
 if(refs.length){
  const {e,score}=refs[Math.min(refs.length-1,l.number%5)];
  questions.push(q(`En la notación alfabética, ¿cómo se lee ${e.pitch}?`,name(e.pitch),[name('C4'),name('F#4'),name('Bbb4'),name('G5')].filter(x=>x!==name(e.pitch)).slice(0,3)));
  const distinct=refs.find(x=>get(x.e.pitch).midi!==get(e.pitch).midi);
  if(distinct&&l.module>=3){const semitones=Math.abs(get(distinct.e.pitch).midi-get(e.pitch).midi);questions.push(q(`¿Cuántos semitonos separan ${name(e.pitch)} y ${name(distinct.e.pitch)}?`,semitones,[semitones+1,semitones+2,Math.max(0,semitones-1)].filter(x=>x!==semitones).slice(0,2),'Se compara la altura sonora de ambas notas, conservando su escritura.'))}
  const figure={1:'redonda',2:'blanca',4:'negra',8:'corchea',16:'semicorchea',32:'fusa',64:'semifusa',128:'garrapatea',256:'semigarrapatea'}[e.dur];
  if(figure){const dots=e.dots||(e.dot?1:0),ratio=e.tuplet||(score.notation.tuplet?score.notation.tuplet.split(':').map(Number):null),value=e.durationBeats;
   questions.push(q(`¿Cuántos tiempos de negra dura una ${figure}${dots?` con ${dots} puntillo${dots>1?'s':''}`:''}${ratio?` dentro de un grupo ${ratio[0]}:${ratio[1]}`:''}?`,value,[String(4/e.dur+1),String(4/e.dur+2),'8'].filter(x=>x!==value).slice(0,2),'Se aplica el valor de la figura, la suma de los puntillos y la proporción del grupo irregular, si corresponde.'))}
  if(score.meter){const [a,b]=score.meter.split('/').map(Number);questions.push(q(`¿Cuántas figuras de 1/${b} completan un compás de ${score.meter}?`,a,[a+1,a+2],`El numerador indica ${a} unidades de ${b===4?'negra':b===8?'corchea':b===2?'blanca':`1/${b}`}.`))}
 }
 if(questions.length<4&&refs.length){
  const first=refs[0].e,second=refs.find(x=>x.e.pitch!==first.pitch)?.e;
  if(l.module===3&&second){const degree=p=>Number(p.match(/-?\d+$/)[0])*7+'CDEFGAB'.indexOf(p[0]);const number=Math.abs(degree(first.pitch)-degree(second.pitch))+1;
   questions.push(q(`Contando los nombres y sus octavas, ¿qué número de intervalo forman ${name(first.pitch)} y ${name(second.pitch)}?`,number,[number+1,number+2],'El número del intervalo se obtiene contando ambos extremos, sin sustituir una nota por su equivalente enarmónico.'))
  }else if(l.module===6){const fifths=refs[0].score.keyFifths;
   questions.push(q('¿Cuántas alteraciones tiene la armadura del primer ejemplo?',Math.abs(fifths),[Math.abs(fifths)+1,Math.abs(fifths)+2]))
  }else if(refs[0].score.meter){const unit=refs[0].score.meter.split('/')[1];questions.push(q(`En ${refs[0].score.meter}, ¿qué figura representa el denominador?`,({'2':'Blanca','4':'Negra','8':'Corchea','16':'Semicorchea'})[unit],['Redonda','Fusa','Semifusa']))
  }else questions.push(fact('¿Cómo se cuentan las líneas y espacios del pentagrama?','De abajo hacia arriba','De arriba hacia abajo','Desde el centro hacia fuera'))
 }
 const foundations=[fact('¿Qué conviene hacer cuando una lectura no sale con precisión?','Reducir el tempo y mantener las proporciones','Acelerar para terminar','Ignorar los silencios'),fact('¿Un silencio conserva una duración dentro del pulso?','Sí','No','Solo si está al final'),fact('¿Qué permite un metrónomo?','Mantener una referencia regular de pulso','Corregir automáticamente la afinación','Elegir la clave de la partitura'),fact('¿Cómo se deben evaluar ritmo y afinación?','Como aspectos distintos de la interpretación','Solo por terminar la pieza','Sin escuchar el resultado')];
 // These fallback entries are explicitly flagged for editorial review, not approved.
 const needsEditorial=questions.length<4&&!(l.module===1&&l.number<=2);
 while(questions.length<4)questions.push(foundations[questions.length%foundations.length]);
 const result=questions.slice(0,4).map((p,i)=>{
  const shift=(l.module+l.number+i)%p.choices.length,choices=p.choices.slice(shift).concat(p.choices.slice(0,shift));
  return {id:`${l.id}-exercise-q${i+1}`,prompt:p.prompt,choices,answer:choices.indexOf(p.choices[p.answer]),explanation:p.explanation};
 });
 output.push({classId:l.id,questions:result,status:'draft-needs-review',needsEditorial});
}
fs.writeFileSync(path.join(root,'exercises.json'),JSON.stringify({lessons:output},null,2));
console.log(`${output.length} exercise drafts; ${output.filter(x=>x.needsEditorial).length} need additional topic-specific questions`);
