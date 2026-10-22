import { useId } from 'react'

/** Text-only replacement for the original Oriente slide, in source-video coordinates.
 * Preserve its map, geographic labels, artwork and live bottom-left camera.
 */
export function SonOrienteLayer({ lang }: { lang: 'es' | 'en' }) {
  const id = useId().replaceAll(':', '')
  const es = lang === 'es'
  const paper = `url(#${id}-paper)`
  function block(x: number, y: number, w: number, h: number, lines: string[], size: number, color = '#302915', background = paper, center = false) {
    return <g>
      <rect x={x} y={y} width={w} height={h} fill={background}/>
      {lines.map((line, i) => <text key={i} x={center ? x+w/2 : x+4} y={y+size+ i*(h-8)/lines.length}
        fill={color} fontFamily="Georgia, serif" fontWeight="bold" fontSize={size}
        textAnchor={center ? 'middle' : 'start'}
        textLength={line.length * size * .56 > w-8 ? w-8 : undefined} lengthAdjust="spacingAndGlyphs">{line}</text>)}
    </g>
  }
  return <svg className="lmm-reference-layer" data-son-oriente-layer data-language={lang} viewBox="0 0 1920 1080" role="img"
    aria-label={es ? 'Región oriental de Cuba: origen del son' : 'Eastern Cuba: the origins of son'}>
    <defs><pattern id={`${id}-paper`} patternUnits="userSpaceOnUse" width="160" height="160">
      <image href="/local-course-assets/son-influence/parchment.png" width="160" height="160"/>
      <rect width="160" height="160" fill="#ecd7a2" opacity=".4"/>
    </pattern></defs>
    {block(610,36,965,136,es ? ['REGIÓN ORIENTAL DE CUBA','(ORIENTE)'] : ['EASTERN REGION OF CUBA','(ORIENTE)'],49,'#fff2d7','#10314b',true)}
    {block(64,53,480,320,es ? [
      'El Son nació en Cuba','a finales del siglo XIX,','en la región oriental de la isla.',
      'Su ritmo y esencia se expandieron','por el Caribe y América Latina,',
      'inspirando géneros y formas musicales','que hoy son parte de nuestra identidad.'
    ] : [
      'Son was born in Cuba','in the late 19th century,','in the eastern region of the island.',
      'Its rhythm and spirit spread','through the Caribbean and Latin America,',
      'inspiring genres and musical forms','that are part of our identity today.'
    ],29)}
    {block(116,434,280,35,[es ? 'ORIGEN DEL SON' : 'ORIGINS OF SON'],26,'#fff2d7','#203711',true)}
    {block(203,500,246,94,es ? ['Raíces africanas','Ritmos, cantos','y percusión.'] : ['African roots','Rhythms, songs','and percussion.'],24)}
    {block(203,623,246,94,es ? ['Influencia española','Melodías, armonías','e instrumentos.'] : ['Spanish influence','Melodies, harmonies','and instruments.'],23)}
    {block(203,742,246,89,es ? ['Tradición campesina','Décimas, guaraperos','y música rural cubana.'] : ['Rural traditions','Décimas, guaraperos','and Cuban rural music.'],22)}
    {block(1310,247,276,115,es ? ['ORIGEN DEL SON:','SANTIAGO DE CUBA','Cuna del son cubano'] : ['BIRTHPLACE OF SON:','SANTIAGO DE CUBA','Cradle of Cuban son'],25,'#752916',paper,true)}
    {block(1639,399,240,34,[es ? 'ELEMENTOS CLAVE DEL SON' : 'KEY ELEMENTS OF SON'],21,'#fff2d7','#253b19',true)}
    {block(1732,467,152,40,['Clave'],26)}
    {block(1732,544,152,42,['Montuno'],26)}
    {block(1732,625,152,42,[es ? 'Guitarra' : 'Guitar'],26)}
    {block(1732,704,152,42,[es ? 'Improvisación' : 'Improvisation'],24)}
    {block(1732,785,152,42,[es ? 'Guajeo y sabor' : 'Guajeo & flavor'],23)}
    {block(980,254,260,34,[es ? 'OCÉANO ATLÁNTICO' : 'ATLANTIC OCEAN'],25,'#254d66','#bbccbf',true)}
    {block(730,597,190,36,[es ? 'MAR CARIBE' : 'CARIBBEAN SEA'],24,'#254d66','#c0cbb4',true)}
  </svg>
}
