/** Approved module copy, kept local until publication is explicitly requested. */
export const TIMBAL_BASIC_MODULE = '616b3242-53e7-4748-9024-5b7bcdd0a7ff'
export const timbalBasicPresentation = {
  title: 'Basic Technical Course',
  title_es: 'Curso básico técnico',
  description: 'In this module, you will get to know the timbales and develop the technical foundations to start playing. You will learn about their parts, setup, tuning, and playing posture, and explore your first sounds and their combinations.\n\nThrough progressive exercises, you will work on stick grip, rebound, alternating hands, single and double strokes, rolls, paradiddles, and other fundamental rudiments. You will also practice accents, dynamics, independence, and coordination, developing endurance and speed control to play with clarity, precision, and ease like a master of Latin music.',
  description_es: 'En este módulo conocerás el timbal y desarrollarás las bases técnicas para comenzar a tocarlo. Aprenderás sus partes, montaje, afinación y postura de ejecución, y explorarás los primeros sonidos y sus combinaciones.\n\nMediante ejercicios progresivos, trabajarás el agarre de las baquetas, el rebote, la alternancia de manos, los golpes simples y dobles, los redobles, los paradiddles y otros rudimentos fundamentales. También practicarás acentos, dinámicas, independencia y coordinación, desarrollando resistencia y control de la velocidad para tocar con claridad, precisión y soltura como un master de la musica latina.',
}
export function applyLocalModulePresentation(section: { id?: string }) {
  if (section.id === TIMBAL_BASIC_MODULE) Object.assign(section, timbalBasicPresentation)
}

export const TIMBAL_WELCOME_MODULE = 'local-timbal-welcome'
export const TIMBAL_WELCOME_CLASS = '8faf1637-106d-4cca-81e4-093cc58e3dff'
export const timbalWelcomePresentation = {
  title: 'Course Introduction and Overview',
  title_es: 'Introducción al curso y descripción general',
}

/** Move the existing class intact; never copy its items or progress identities. */
export function separateTimbalWelcome<T extends { id?: string; order_index?: number; classes?: { id: string; section_id?: string; order_index?: number; description?: string | null; description_es?: string | null }[] }>(sections: T[]) {
  if (sections.some(section => section.id === TIMBAL_WELCOME_MODULE)) return
  const basic = sections.find(section => section.id === TIMBAL_BASIC_MODULE)
  const welcome = basic?.classes?.find(cls => cls.id === TIMBAL_WELCOME_CLASS)
  if (!basic || !welcome) return
  const intro = { ...basic, ...timbalWelcomePresentation, id: TIMBAL_WELCOME_MODULE,
    description: welcome.description ?? null, description_es: welcome.description_es ?? null, order_index: 0,
    classes: [{ ...welcome, section_id: TIMBAL_WELCOME_MODULE, order_index: 0 }],
  } as T
  basic.classes = basic.classes!.filter(cls => cls.id !== TIMBAL_WELCOME_CLASS).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).map((cls, index) => ({ ...cls, order_index: index }))
  sections.unshift(intro)
  sections.forEach((section, index) => { section.order_index = index })
}
