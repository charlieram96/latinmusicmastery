'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, BookOpen, Music, GraduationCap, Loader2, Disc3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { createClient } from '@/lib/supabase/client'
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'
import { useTranslation } from '@/components/language-provider'
import { pick } from '@/lib/i18n/localize'

interface SearchResult {
  id: string
  title: string
  type: 'course' | 'lesson' | 'teacher' | 'style' | 'instrument'
  href: string
  subtitle?: string
}

export function HeaderSearch() {
  const router = useRouter()
  const { locale } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const searchResults: SearchResult[] = []
    const q = searchQuery.trim().toLowerCase()

    try {
      // Run all queries in parallel
      const [coursesRes, classesRes, teachersRes, stylesRes] = await Promise.allSettled([
        supabase
          .from('courses')
          .select('id, title, title_es, slug, teacher_name, instrument')
          .or(`title.ilike.%${searchQuery}%,title_es.ilike.%${searchQuery}%`)
          .eq('is_published', true)
          .limit(3),
        supabase
          .from('classes')
          .select('id, title, title_es, section:course_sections(id, course:courses(id, slug, title, title_es))')
          .or(`title.ilike.%${searchQuery}%,title_es.ilike.%${searchQuery}%`)
          .limit(3),
        supabase
          .from('teachers')
          .select('id, name, instrument')
          .ilike('name', `%${searchQuery}%`)
          .limit(3),
        supabase
          .from('musical_styles')
          .select('id, name, name_es, slug, countries(name, name_es)')
          .or(`name.ilike.%${searchQuery}%,name_es.ilike.%${searchQuery}%`)
          .limit(3),
      ])

      // Process courses
      if (coursesRes.status === 'fulfilled' && coursesRes.value.data) {
        coursesRes.value.data.forEach((course: any) => {
          searchResults.push({
            id: course.id,
            title: pick(locale, course.title, course.title_es) ?? course.title,
            type: 'course',
            href: `/dashboard/course/${course.slug}`,
            subtitle: [course.teacher_name, course.instrument].filter(Boolean).join(' · ') || undefined,
          })
        })
      }

      // Process classes (lessons)
      if (classesRes.status === 'fulfilled' && classesRes.value.data) {
        classesRes.value.data.forEach((cls: any) => {
          const course = cls.section?.course
          if (course) {
            searchResults.push({
              id: cls.id,
              title: pick(locale, cls.title, cls.title_es) ?? cls.title,
              type: 'lesson',
              href: `/dashboard/course/${course.slug || course.id}`,
              subtitle: (pick(locale, course.title, course.title_es) ?? course.title) || undefined,
            })
          }
        })
      }

      // Process teachers
      if (teachersRes.status === 'fulfilled' && teachersRes.value.data) {
        teachersRes.value.data.forEach((teacher) => {
          searchResults.push({
            id: teacher.id,
            title: teacher.name,
            type: 'teacher',
            href: `/dashboard/teachers`,
            subtitle: teacher.instrument || undefined,
          })
        })
      }

      // Process musical styles
      if (stylesRes.status === 'fulfilled' && stylesRes.value.data) {
        stylesRes.value.data.forEach((style: any) => {
          searchResults.push({
            id: style.id,
            title: pick(locale, style.name, style.name_es) ?? style.name,
            type: 'style',
            href: `/dashboard/courses?style=${style.slug}`,
            subtitle: (pick(locale, style.countries?.name, style.countries?.name_es) ?? style.countries?.name) || undefined,
          })
        })
      }

      // Match instruments locally
      const matchingInstruments = SUBSCRIBABLE_INSTRUMENTS.filter(
        (inst) => inst.toLowerCase().includes(q)
      )
      matchingInstruments.forEach((inst) => {
        searchResults.push({
          id: `instrument-${inst}`,
          title: inst,
          type: 'instrument',
          href: `/dashboard/courses?instrument=${inst}`,
          subtitle: 'Browse courses',
        })
      })

      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [locale])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  const handleSelect = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'course':
        return <BookOpen className="h-4 w-4" />
      case 'lesson':
        return <Music className="h-4 w-4" />
      case 'teacher':
        return <GraduationCap className="h-4 w-4" />
      case 'style':
        return <Music className="h-4 w-4" />
      case 'instrument':
        return <Disc3 className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'course':
        return 'Course'
      case 'lesson':
        return 'Lesson'
      case 'teacher':
        return 'Teacher'
      case 'style':
        return 'Style'
      case 'instrument':
        return 'Instrument'
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center h-9 w-9 md:w-56 md:px-3 md:py-2 rounded-lg bg-card border-0 hover:bg-card/80 transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground md:mr-2" />
        <span className="hidden md:inline-flex text-sm text-muted-foreground">Search...</span>
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex h-5 select-none items-center gap-1 rounded bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            placeholder="Search courses, lessons, teachers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Clear
            </button>
          )}
        </div>
        <CommandList className="max-h-[400px] p-2">
          {isLoading && (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">Searching...</p>
            </div>
          )}
          {!isLoading && query && results.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No results found for &ldquo;{query}&rdquo;</p>
            </div>
          )}
          {!isLoading && results.length > 0 && (
            <>
              {(['course', 'lesson', 'teacher', 'style', 'instrument'] as const).map((type) => {
                const typeResults = results.filter((r) => r.type === type)
                if (typeResults.length === 0) return null
                return (
                  <CommandGroup key={type} heading={`${getTypeLabel(type)}s`} className="mb-2">
                    {typeResults.map((result) => (
                      <CommandItem
                        key={result.id}
                        value={result.title}
                        onSelect={() => handleSelect(result.href)}
                        className="cursor-pointer rounded-lg px-3 py-2.5 hover:bg-primary/10 data-[selected=true]:bg-primary/10"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                            {getIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
            </>
          )}
          {!isLoading && !query && (
            <div className="py-12 text-center">
              <Search className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Start typing to search courses, lessons, and teachers</p>
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
