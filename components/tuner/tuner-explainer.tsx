'use client'

import { Gauge, Waves, Music4 } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const SECTIONS = [
  { id: 'howto', icon: Gauge },
  { id: 'cents', icon: Waves },
  { id: 'reference', icon: Music4 },
] as const

export function TunerExplainer() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {t('dashboard.pages.tuner.guide.title')}
      </span>
      <Accordion type="single" collapsible defaultValue="howto" className="w-full">
        {SECTIONS.map(({ id, icon: Icon }) => (
          <AccordionItem key={id} value={id} className="border-border">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-primary" />
                {t(`dashboard.pages.tuner.guide.${id}.q`)}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {t(`dashboard.pages.tuner.guide.${id}.a`)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
