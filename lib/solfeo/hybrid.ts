/** One public course, preserving the authored IDs of both content variants. */
export const SOLFEO_ROUTE='/dashboard/course/solfeo-aplicado'
export const SOLFEO_AUTHOR_ROUTE='/admin/courses/solfeo-aplicado'
export const SOLFEO_ID='12468ffa-f23f-4e89-b2a2-ac28ffec3540'
export function kidsContentId(id:string|undefined){return id?.replace(/^local-solfeo-(?!kids-)/,'local-solfeo-kids-')}
export function solfeoPresentation(kids:boolean,es:boolean){return {
 title:kids?(es?'Solfeo Infantil Aplicado':'Applied Solfege for Kids'):(es?'Solfeo Aplicado':'Applied Solfege'),
 thumbnailUrl:kids?'/local-course-assets/solfeo-infantil-cover.svg':'/local-course-assets/solfeo-aplicado-cover.png',
}}
