import { stripLanguageLabels } from '@/lib/i18n/content-labels'
import { localizedRichContent } from '@/lib/i18n/rich-content';
import {TiptapReadOnly} from './tiptap-read-only';
/** Keep authored text in the same place for video, score, exercise and quiz parts. */
export function LessonWrittenContent({description,richContent,locale}:{description:string|null;richContent:Record<string,unknown>|null;locale:string}) {
 const hasNotes = !!richContent?.content && JSON.stringify(richContent.content).includes('\"text\"');
 richContent = localizedRichContent(richContent, locale === 'es' ? 'es' : 'en');
 if(!description?.trim()&&!richContent&&!hasNotes)return null;
 return <section data-lesson-written-content className="mx-auto w-full max-w-[78ch] space-y-6 px-1 py-4 text-[15px] leading-[1.8] text-foreground/90 sm:py-6">
  {description?.trim()&&<div><h2 className="mb-2 font-heading text-base font-semibold text-foreground">{locale==='es'?'Descripción':'Description'}</h2><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{stripLanguageLabels(description)}</p></div>}
  {richContent&&<div><h2 className="mb-2 font-heading text-base font-semibold text-foreground">{locale==='es'?'Notas y explicación':'Notes and explanation'}</h2><TiptapReadOnly content={richContent}/></div>}
  {hasNotes&&!richContent&&<p className="text-sm text-muted-foreground">{locale==='es'?'Las notas de esta lección aún no tienen traducción al español.':'The notes for this lesson are not yet available in English.'}</p>}
 </section>;
}
