/** Stable class IDs keep this first rollout scoped to Timbal module 1. */
export const timbalScenes = [
  ['8faf1637-106d-4cca-81e4-093cc58e3dff', 'La gran bienvenida', 'The grand welcome', 'Un teatro lleno de nuevos amigos.', 'A theater full of new friends.', '🎟️', '#bf628c'],
  ['ca3ff4dd-dd1c-49d4-931c-6db1a815c924', 'La isla del timbal', 'Timbales island', 'Nuestra aventura musical comienza aquí.', 'Our musical adventure begins here.', '🌴', '#32a999'],
  ['b39b4df0-96ee-4568-af9a-0dee9f9cc155', 'El taller musical', 'The music workshop', 'Cada pieza tiene su lugar.', 'Every part has its place.', '🛠️', '#c98b36'],
  ['9b3e4515-7cad-4662-88e8-3c624d3968d6', 'El jardín de los sonidos', 'The sound garden', 'Escucha cómo cambia el sonido.', 'Listen to how the sound changes.', '🌷', '#649e51'],
  ['df6b8182-614d-4569-b30c-e0ea2fcd0d62', 'Colores que suenan', 'Colors that sing', 'Descubre y combina los sonidos.', 'Discover and combine sounds.', '🎨', '#c96b5f'],
  ['f2075413-744e-4081-8ded-5ea279a134ab', 'El bosque del rebote', 'The bouncing forest', 'Manos relajadas, baquetas que rebotan.', 'Relaxed hands, bouncing sticks.', '🌳', '#429b82'],
  ['f4c34585-2a24-4697-b033-62e89029e487', 'El tren de los golpes', 'The rhythm train', 'Un golpe, dos golpes: escucha el patrón.', 'One stroke, two strokes: hear the pattern.', '🚂', '#bc6655'],
  ['ee542f32-fda8-4f56-975a-bd6fe0fd1134', 'El laboratorio de patrones', 'The pattern lab', 'Descubre caminos para tus dos manos.', 'Discover pathways for both hands.', '🧩', '#8b75be'],
  ['99328ffc-f12d-4c3e-a883-ff64b11aedff', 'El valle de los ecos', 'The valley of echoes', 'Suave y fuerte: dale expresión al ritmo.', 'Soft and loud: give rhythm expression.', '🏔️', '#5c98b9'],
  ['ecb034c1-a2b6-44bf-b214-602a82e251a4', 'Los puentes de las manos', 'The bridges of two hands', 'Dos manos que trabajan en equipo.', 'Two hands working as a team.', '🌉', '#b07a51'],
  ['8472c3e1-2eba-48ae-8428-ac0f777c07e1', 'El viaje de las estrellas', 'The star journey', 'Paso a paso, con claridad y control.', 'Step by step, with clarity and control.', '🚀', '#7275bc'],
  ['aacdccc9-2214-4c2c-b8b4-b08f37939259', 'Un viaje al corazón del son', 'A journey to the heart of son', 'Escucha al maestro y descubre de dónde viene nuestro ritmo.', 'Listen to the teacher and discover where our rhythm comes from.', '🌴', '#398f86'],
  ['d6c3b163-7107-4ed8-8072-7ceee93d32e5', 'El patio del ritmo', 'The rhythm courtyard', 'Observa las manos del maestro y escucha el pulso del son.', 'Watch the teacher’s hands and listen to the pulse of son.', '🥁', '#b87648'],
  ['2f9d9d9d-78fc-4a8f-9f9a-8f7f7c0ee3fe', 'La fiesta de la cáscara', 'The cáscara celebration', 'Descubre cómo un ritmo puede tomar nuevos caminos.', 'Discover how a rhythm can take new paths.', '🎶', '#8770ad'],
] as const
export function timbalScene(classId: string) { return timbalScenes.find(scene => scene[0] === classId) }

export function timbalTheaterModule(classId: string) { const index = timbalScenes.findIndex(scene => scene[0] === classId); return index === 0 ? 1 : index >= 11 ? 3 : 2 }
