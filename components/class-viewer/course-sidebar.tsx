import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { getServerTranslator } from '@/lib/i18n/server'

interface SidebarSection {
  id: string
  title: string
  totalItems: number
  completedItems: number
  classes: {
    id: string
    title: string
    totalItems: number
    completedItems: number
  }[]
}

interface CourseSidebarProps {
  courseId: string
  currentClassId: string
  sections: SidebarSection[]
  courseTitle?: string
  courseDescription?: string
}

export async function CourseSidebar({ courseId, currentClassId, sections, courseTitle, courseDescription }: CourseSidebarProps) {
  const { t } = await getServerTranslator()
  // Find which section contains the current class to default-open it
  const activeSectionId = sections.find(s =>
    s.classes.some(c => c.id === currentClassId)
  )?.id

  return (
    <div className="flex flex-col h-full">
      {courseTitle && (
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">{courseTitle}</h2>
          {courseDescription && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{courseDescription}</p>
          )}
        </div>
      )}
      <div className="p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('dashboard.pages.modules.courseContent')}</h3>
        <div className="border-b mb-4" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
        <Accordion
          type="single"
          collapsible
          defaultValue={activeSectionId}
        >
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id} data-current-module={section.id === activeSectionId ? true : undefined}>
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="lmm-navigation-title min-w-0 flex-1">{section.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pl-2">
                  {section.classes.map((cls) => {
                    const isCurrent = cls.id === currentClassId
                    const isClassComplete = cls.completedItems === cls.totalItems && cls.totalItems > 0
                    return (
                      <Link
                        key={cls.id}
                        aria-current={isCurrent ? "page" : undefined}
                        data-current-location={isCurrent ? "lesson" : undefined}
                        href={`/dashboard/course/${courseId}/class/${cls.id}`}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg text-sm transition-colors',
                          isCurrent ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                        )}
                      >
                        {isClassComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2 flex-shrink-0',
                            isCurrent ? 'border-primary' : 'border-muted-foreground/30'
                          )} />
                        )}
                        <span className="lmm-navigation-title min-w-0 flex-1">{cls.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {cls.completedItems}/{cls.totalItems}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
