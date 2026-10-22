'use client'
import type { PresentationCue } from '@/lib/playsense-studio/lesson-presentation'

const root = '/local-course-assets/codex-ritmo/'
const instruments = [
  { image: 'krin', es: ['KRIN (ÁFRICA OCCIDENTAL)', 'Tronco de madera tallado con hendiduras que producen dos tonos diferentes. Se toca con dos palos.'], en: ['KRIN (WEST AFRICA)', 'A carved wooden log with slits producing two different tones. Played with two sticks.'] },
  { image: 'ekwe', es: ['EKWE (PUEBLOS IGBO / YORUBA)', 'Instrumento sagrado y de comunicación. Su patrón rítmico repetitivo sirve como base para la música y la danza.'], en: ['EKWE (IGBO / YORUBA PEOPLES)', 'A sacred instrument of communication. Its repeating rhythmic pattern supports music and dance.'] },
  { image: 'slit', es: ['SLIT DRUM TRADICIONAL', 'Tronco ahuecado con una o varias hendiduras. Produce un sonido seco, firme y penetrante.'], en: ['TRADITIONAL SLIT DRUM', 'A hollow log with one or more slits. Produces a dry, firm, penetrating sound.'] },
  { image: 'bamboo', es: ['BAMBOO KATA (TRADICIONAL)', 'Versión en bambú, muy utilizada en tradiciones africanas. Similar al Cata moderno.'], en: ['BAMBOO KATA (TRADITIONAL)', 'A bamboo version widely used in African traditions. Similar to the modern Cata.'] },
]

export function RitmoHeritage({ cue, lang }: { cue: PresentationCue; lang: 'es' | 'en'; time: number; src: string }) {
  if (cue.kind === 'instrument') return <div className="lmm-bamboo-card">
    {/* Image is an illustration supplied in the reference, not a new historical claim. */}
    <img src={root + 'bamboo.jpg'} alt="" /><h3>{cue.title[lang]}</h3><p>{cue.label[lang]}</p>
  </div>
  const es = lang === 'es'
  return <div className="lmm-heritage-stage">
    <section className="lmm-heritage-sheet" aria-label={cue.title[lang]}>
      <header><img className="lmm-heritage-africa" src={root + 'africa-pattern.jpg'} alt="" /><h2>{cue.title[lang]}</h2>
        <h3>{es ? 'E INFLUENCIA DEL CATA Y OTROS INSTRUMENTOS AFRICANOS' : 'AND THE INFLUENCE OF CATA AND OTHER AFRICAN INSTRUMENTS'}</h3>
        <h4>{cue.label[lang]}</h4><img className="lmm-heritage-havana" src={root + 'havana.jpg'} alt="" /></header>
      <div className="lmm-heritage-section-title"><b>{es ? 'INSTRUMENTOS ORIGINALES AFRICANOS' : 'ORIGINAL AFRICAN INSTRUMENTS'}</b><span>{es ? 'TAMBORES DE HENDIDURA / SLIT DRUMS' : 'SLIT DRUMS'}</span></div>
      <div className="lmm-heritage-instruments">{instruments.map(item => <article key={item.image}><img src={root + item.image + '.jpg'} alt={item[lang][0]} /><h5>{item[lang][0]}</h5><p>{item[lang][1]}</p></article>)}</div>
      <div className="lmm-heritage-bottom"><div className="lmm-heritage-explanation">
        <div className="lmm-heritage-journey">{[
          { image: 'africa', title: es ? 'ÁFRICA' : 'AFRICA', text: es ? 'Patrones rítmicos ancestrales tocados sobre instrumentos de madera y bambú.' : 'Ancestral rhythmic patterns played on wooden and bamboo instruments.' },
          { image: 'ship', title: es ? 'TRAVESÍA' : 'JOURNEY', text: es ? 'Con la diáspora africana, estos saberes y ritmos llegan al Caribe.' : 'With the African diaspora, this knowledge and these rhythms reach the Caribbean.' },
          { image: 'cuba', title: 'CUBA', text: es ? 'Evolucionan y se adaptan a nuevos instrumentos y contextos musicales.' : 'They evolve and adapt to new instruments and musical contexts.' },
        ].map((item,i) => <div key={item.image}><img src={root + item.image + '.jpg'} alt="" /><h5>{item.title}</h5><p>{item.text}</p>{i < 2 && <span aria-hidden>▸</span>}</div>)}</div>
        <div className="lmm-heritage-notes"><article><h5>{es ? '¿QUÉ ES EL CATA?' : 'WHAT IS CATA?'}</h5><p>{es ? 'El Cata es un patrón rítmico repetitivo (ostinato) que marca el tiempo y organiza la música. Su esencia ha perdurado a través de los siglos, adaptándose sin perder su función fundamental: ser el corazón rítmico.' : 'Cata is a repeating rhythmic pattern (ostinato) that marks time and organizes the music. Its essence has endured through the centuries, adapting while retaining its fundamental role: the rhythmic heart.'}</p></article>
          <article><h5>{es ? 'CARACTERÍSTICAS DEL CATA' : 'CHARACTERISTICS OF CATA'}</h5><div className="lmm-heritage-symbols">{(es ? ['◷|Patrón repetitivo','♫|Sonido seco y penetrante','♬|Base para la música y la danza','♥|Corazón rítmico'] : ['◷|Repeating pattern','♫|Dry, penetrating sound','♬|Foundation for music and dance','♥|Rhythmic heart']).map(s => <span key={s}><b>{s.split('|')[0]}</b>{s.split('|')[1]}</span>)}</div></article></div>
      </div><article className="lmm-heritage-timbal"><h5>{es ? 'LA CÁSCARA EN EL TIMBAL' : 'CÁSCARA ON TIMBALES'}</h5><img src={root + 'timbal.jpg'} alt="Timbal" /><p>{es ? 'El concepto del Cata influyó de manera importante en el ritmo final de la Cáscara, pero no fue el único.' : 'The concept of Cata significantly influenced the final cáscara rhythm, but it was not the only influence.'}</p><p>{es ? 'Hubo otras influencias y la Cáscara es producto de un desarrollo empírico, espontáneo y progresivo dentro de la música cubana.' : 'There were other influences, and cáscara is the product of an empirical, spontaneous and progressive development within Cuban music.'}</p></article></div>
      <footer>{es ? 'DE ÁFRICA A CUBA: UNA HERENCIA QUE SIGUE VIVIENDO EN CADA RITMO' : 'FROM AFRICA TO CUBA: A HERITAGE THAT LIVES ON IN EVERY RHYTHM'}</footer>
    </section>
  </div>
}
