'use client'
import { ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/components/language-provider'

export function HistoryDetail({person='guido'}:{person?:'guido'|'john'}={}) {
  const { locale } = useTranslation(); const es = locale === 'es'
  if(person==='john')return <Dialog><DialogTrigger asChild><button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 text-primary hover:bg-primary/10" aria-label={es?'Ver pintura histórica de San Juan Bautista':'View historical painting of John the Baptist'}><ImageIcon size={18}/></button></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogTitle>{es?'San Juan Bautista':'John the Baptist'}</DialogTitle><DialogDescription>{es?'Representación artística posterior; no es un retrato del natural.':'A later artistic depiction, not a portrait made from life.'}</DialogDescription><img src="/local-course-assets/john-baptist-carracci-met.jpg" alt={es?'San Juan Bautista señala a Cristo en un paisaje, pintura de Annibale Carracci':'John the Baptist pointing to Christ in a landscape, painted by Annibale Carracci'} className="mx-auto max-h-[48dvh] w-auto rounded-lg"/><p className="text-sm"><em>Saint John the Baptist Bearing Witness</em> · Annibale Carracci · {es?'hacia 1600 · Óleo sobre cobre.':'ca. 1600 · Oil on copper.'}</p><p className="text-xs text-muted-foreground">The Metropolitan Museum of Art, New York · 2009.252 · {es?'Dominio público. Donación de Fabrizio Moretti y Adam Williams, en honor de Everett Fahy, 2009.':'Public domain. Gift of Fabrizio Moretti and Adam Williams, in honor of Everett Fahy, 2009.'}</p><a href="https://www.metmuseum.org/art/collection/search/438813" target="_blank" rel="noreferrer" className="text-sm text-primary underline">{es?'Ficha de la obra y procedencia · The Met':'Artwork record and provenance · The Met'} ↗</a></DialogContent></Dialog>
  return <Dialog><DialogTrigger asChild><button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 text-primary hover:bg-primary/10" aria-label={es ? 'Ver imagen histórica de Guido de Arezzo' : 'View historical image of Guido of Arezzo'}><ImageIcon size={18} /></button></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogTitle>Guido de Arezzo</DialogTitle><DialogDescription>{es ? 'Una imagen histórica, no una fotografía del personaje.' : 'A historical depiction, not a photograph of the person.'}</DialogDescription><img src="/local-course-assets/guido-e-teodaldo.jpg" alt={es ? 'Miniatura en color de Guido con un monocordio y el obispo Teodaldo' : 'Color illumination of Guido with a monochord and Bishop Tedald'} className="mx-auto max-h-[50dvh] w-auto rounded-lg" /><p className="text-sm">{es ? 'Guido aparece con un monocordio: un instrumento utilizado para estudiar las relaciones entre los sonidos. Esta miniatura fue realizada entre 1180 y 1199, después de su vida.' : 'Guido is depicted with a monochord, an instrument used to study relationships between pitches. This illumination dates from 1180–1199, after his lifetime.'}</p><p className="text-xs text-muted-foreground">{es ? 'Autor desconocido · Biblioteca Nacional de Austria, Ms. 51, f.35v · Dominio público.' : 'Unknown artist · Austrian National Library, Ms. 51, f.35v · Public domain.'}</p><a className="text-sm text-primary underline" href="https://commons.wikimedia.org/wiki/File:Guido_e_Teodaldo.jpg" target="_blank" rel="noreferrer">{es ? 'Procedencia y ficha de la miniatura' : 'Illumination record and source'} ↗</a></DialogContent></Dialog>
}

// Documentary reproductions, not reconstructions or claims to be the first surviving examples.
// Original files are preserved locally without cropping or alteration.
const manuscripts = {
  tetragram: {
    title: ['Tetragrama', 'Four-line staff'],
    image: '/local-course-assets/tetragrama-antifonario.jpg',
    description: ['Antifonario de Beaupré · 1290', 'Beaupré Antiphonary · 1290'],
    alt: ['Libro medieval abierto con tetragramas rojos y notas cuadradas en la página derecha', 'Open medieval book with red four-line staves and square notes on the right-hand page'],
    text: ['Observa los grupos de cuatro líneas rojas en la página derecha: sobre ellas se escribieron notas cuadradas para el canto. Este manuscrito de 1290 muestra cómo se utilizaba el tetragrama en la Edad Media; es un ejemplo conservado, no el primer tetragrama creado.', 'Look at the groups of four red lines on the right-hand page: square chant notes were written on them. This manuscript from 1290 shows how the four-line staff was used in the Middle Ages; it is a surviving example, not the first four-line staff ever made.'],
    credit: 'Walters Art Museum · W.759.1V · CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Flemish_-_Leaf_from_the_Beaupr%C3%A9_Antiphonary_(Volume_I)_-_Walters_W7591V_-_Open_Group.jpg',
    license: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  pentagram: {
    title: ['Pentagrama', 'Five-line staff'],
    image: '/local-course-assets/pentagrama-chansonnier-cordiforme.jpg',
    description: ['Chansonnier cordiforme · hacia 1475', 'Chansonnier cordiforme · around 1475'],
    alt: ['Página en forma de corazón del Chansonnier cordiforme con pentagramas de cinco líneas y notas antiguas', 'Heart-shaped Chansonnier cordiforme page with five-line staves and historical notation'],
    text: ['Cada pentagrama tiene cinco líneas finas: puedes contarlas especialmente bien en el pentagrama vacío del centro. Esta página de «O rosa bella», del Chansonnier cordiforme, muestra cómo se escribía música sobre cinco líneas en el siglo XV. Es un ejemplo histórico conservado, no el primer pentagrama de la historia.', 'Each staff has five fine lines: they are particularly easy to count in the empty staff in the center. This page of “O rosa bella” from the Chansonnier cordiforme shows music written on five lines in the fifteenth century. It is a surviving historical example, not the first five-line staff in history.'],
    credit: 'Bibliothèque nationale de France / Gallica · Rothschild 2973, f.8v · Wikimedia Commons: Patachonf · CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:O_rosa_bella_(John_Bedyngham)_Chansonnier_cordiforme,_Paris,_BnF,_Ms._Rothschild_2973_f%C2%B08v).jpg',
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
} as const

export function ManuscriptDetail({kind}: {kind: keyof typeof manuscripts}) {
  const {locale} = useTranslation()
  const es = locale === 'es', language = es ? 0 : 1, item = manuscripts[kind]
  return <div className="flex items-center gap-3">
    <strong>{item.title[language]}</strong>
    <Dialog>
      <DialogTrigger asChild><button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 text-primary hover:bg-primary/10" aria-label={`${es ? 'Ver imagen histórica de' : 'View historical image of'} ${item.title[language]}`}><ImageIcon size={18}/></button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle>{item.title[language]}</DialogTitle>
        <DialogDescription>{item.description[language]}</DialogDescription>
        <a href={item.image} target="_blank" rel="noreferrer" aria-label={es ? 'Abrir manuscrito a tamaño completo' : 'Open full-size manuscript'}><img src={item.image} alt={item.alt[language]} className="mx-auto max-h-[58dvh] max-w-full rounded-lg object-contain"/></a>
        <p className="text-sm">{item.text[language]}</p>
        <p className="text-xs text-muted-foreground">{item.credit} · {es ? 'Imagen sin modificar.' : 'Unmodified image.'}</p>
        <div className="flex flex-wrap gap-4 text-sm text-primary underline">
          <a href={item.image} target="_blank" rel="noreferrer">{es ? 'Ampliar imagen local' : 'Enlarge local image'} ↗</a>
          <a href={item.source} target="_blank" rel="noreferrer">{es ? 'Procedencia' : 'Source'} ↗</a>
          <a href={item.license} target="_blank" rel="noreferrer">{es ? 'Licencia' : 'License'} ↗</a>
        </div>
      </DialogContent>
    </Dialog>
  </div>
}
