import { useId, useLayoutEffect, useRef } from 'react'

/** Geometry authored against the original 1920 × 1080 slide, 29.963–38.906 s.
 * Only text regions are covered: the original map, instruments and live camera remain visible.
 */
export function SonInfluenceLayer({ lang, time }: { lang: 'es' | 'en'; time: number }) {
  const id = useId().replaceAll(':', '')
  const root = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = root.current
    if (!svg) return
    const fit = () => svg.querySelectorAll('foreignObject').forEach(box => {
      const text = box.firstElementChild as HTMLElement | null
      if (!text || !box.getBoundingClientRect().width) return
      for (let size = Number(text.dataset.maxFont); size >= 12; size -= .25) {
        text.style.fontSize = `${size}px`
        if (text.getBoundingClientRect().height <= box.getBoundingClientRect().height) break
      }
    })
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [lang])
  const es = lang === 'es'
  // The embedded camera grows during this authored transition. Keep a safety margin.
  const cameraTop = time < 35.3 ? 830 : time < 35.4 ? 808 : 790
  const paper = `url(#${id}-paper)`
  function panel(x: number, y: number, w: number, h: number, text: string, size = 21, color = '#302915', bold = false) {
    return <g><rect x={x} y={y} width={w} height={h} fill={paper}/><foreignObject x={x + 3} y={y + 2} width={w - 6} height={h - 4}>
      <div data-max-font={size} style={{ fontFamily: 'Arial, sans-serif', fontSize: size, lineHeight: 1.21, fontWeight: bold ? 700 : 500, color, margin: 0 }}>{text}</div>
    </foreignObject></g>
  }
  return <svg ref={root} className="lmm-reference-layer" data-son-influence-layer data-language={lang} viewBox="0 0 1920 1080" role="img" aria-label={es ? 'De Cuba para el mundo: la influencia del son' : 'From Cuba to the world: the influence of son'}>
    <defs><pattern id={`${id}-paper`} patternUnits="userSpaceOnUse" width="160" height="160"><image href="/local-course-assets/son-influence/parchment.png" width="160" height="160"/><rect width="160" height="160" fill="#ecd08d" opacity=".35"/></pattern></defs>
    {/* Original ribbon and ornaments stay in place. */}
    <rect x="844" y="30" width="520" height="94" fill="#1e3211"/>
    <text x="1104" y="69" textAnchor="middle" fill="#fff0c4" fontFamily="Georgia,serif" fontWeight="bold" fontSize="39">{es ? 'DE CUBA PARA EL MUNDO:' : 'FROM CUBA TO THE WORLD:'}</text>
    <text x="1104" y="112" textAnchor="middle" fill="#fff0c4" fontFamily="Georgia,serif" fontWeight="bold" fontSize="39">{es ? 'LA INFLUENCIA DEL SON' : 'THE INFLUENCE OF SON'}</text>
    <rect x="32" y="28" width="460" height="410" fill={paper}/>
    <text x="262" y="158" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize={es ? 130 : 148} fill="#251b09">{es ? 'EL SON' : 'SON'}</text>
    <text x="262" y="211" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="34" fill="#30220e">{es ? 'LA RAÍZ QUE' : 'THE ROOT THAT'}</text>
    <text x="262" y="296" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="80" fill="#65300f">{es ? 'inspiró' : 'inspired'}</text>
    <text x="262" y="361" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="39" fill="#28401b">{es ? 'MUCHOS RITMOS' : 'SO MANY RHYTHMS'}</text>
    <text x="262" y="420" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="36" fill="#28401b">{es ? 'DE AMÉRICA LATINA' : 'OF LATIN AMERICA'}</text>
    <rect x="52" y="785" width="286" height={Math.max(0, cameraTop - 786)} fill={paper}/>
    {panel(52,462,286,329,es ? 'Nacido en Cuba a finales del siglo XIX, el Son es la base de la música cubana tradicional y ha influido en numerosos géneros populares en toda América Latina y el Caribe. Su esencia rítmica, sus instrumentos y su espíritu viajaron más allá de las fronteras, dando vida a nuevas expresiones.' : 'Born in Cuba in the late 19th century, son is a foundation of traditional Cuban music. It has influenced many popular genres across Latin America and the Caribbean. Its rhythmic essence, instruments and spirit traveled beyond borders, giving life to new musical expressions.',20)}
    {panel(520,353,220,72,es ? 'Hermana del Son, nació en Cuba y comparte su raíz rítmica, su clave y su carácter festivo.' : 'Born in Cuba, this sister of son shares its rhythmic roots, clave and festive spirit.',16)}
    {panel(518,526,222,88,es ? 'Evolución del Son en los años 40 y 50. Conserva su base rítmica y la energía del Son, llevándola a un formato orquestal.' : 'An evolution of son in the 1940s and 1950s, preserving its rhythmic foundation and energy in an orchestral format.',16)}
    {panel(518,713,244,66,es ? 'Nacido del Son en los años 50, conserva su estructura rítmica y el uso de la clave.' : 'Born from son in the 1950s, it retains its rhythmic structure and use of the clave.',16)}
    {panel(519,805,220,43,es ? 'JAZZ LATINO' : 'LATIN JAZZ',31,'#53305f',true)}
    {panel(519,848,220,27,es ? '(CUBA Y LATINOAMÉRICA)' : '(CUBA & LATIN AMERICA)',16,'#53305f',true)}
    {panel(518,882,308,80,es ? 'El Son se fusionó con el jazz, dando origen a un lenguaje musical único que influyó en toda Latinoamérica.' : 'Son blended with jazz, creating a unique musical language that influenced all of Latin America.',17)}
    {panel(1470,291,209,33,es ? '(NUEVA YORK)' : '(NEW YORK)',22,'#28401b',true)}
    {panel(1468,328,384,100,es ? 'La Salsa es hija directa del Son Cubano. Su estructura, la clave, el montuno y el sabor caribeño son la base de este género que conquistó el mundo.' : 'Salsa is a direct descendant of Cuban son. Its structure, clave, montuno and Caribbean flavor underpin this genre that conquered the world.',20)}
    {panel(1468,539,389,42,es ? 'JAZZ LATINO / AFROCUBANO' : 'LATIN / AFRO-CUBAN JAZZ',27,'#53305f',true)}
    {panel(1468,583,315,34,es ? '(CUBA Y LATINOAMÉRICA)' : '(CUBA & LATIN AMERICA)',23,'#53305f',true)}
    {panel(1468,619,316,84,es ? 'El Son se fusionó con el jazz, dando origen a un lenguaje musical único que influyó en toda Latinoamérica.' : 'Son blended with jazz, creating a unique musical language that influenced all of Latin America.',20)}
    {panel(1528,812,317,111,es ? 'El Son no solo dio origen a ritmos, también transmitió una forma de sentir, de bailar y de contar historias que sigue viva en nuestra música.' : 'Son gave rise to more than rhythms. It passed on a way of feeling, dancing and telling stories that lives on in our music.',19)}
    <rect x="585" y="1028" width="779" height="43" fill="#38200c"/>
    <text x="974" y="1059" textAnchor="middle" fill="#f6d696" fontFamily="Georgia,serif" fontWeight="bold" fontSize="26">{es ? 'DISTINTOS NOMBRES, UNA MISMA ESENCIA: EL RITMO QUE NOS UNE.' : 'DIFFERENT NAMES, ONE SHARED SOUL: THE RHYTHM THAT UNITES US.'}</text>
  </svg>
}
