'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, X, Grid3X3, List, ChevronDown } from 'lucide-react'

interface FilterOptions {
  teachers: { id: string; name: string }[]
  styles: { name: string }[]
}

interface CourseFiltersProps {
  options: FilterOptions
  totalCount: number
  filteredCount: number
}

export function CourseFilters({ options, totalCount, filteredCount }: CourseFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Get current filter values from URL
  const search = searchParams.get('search') || ''
  const selectedTeachers = searchParams.get('teachers')?.split(',').filter(Boolean) || []
  const difficulty = searchParams.get('difficulty') || ''
  const style = searchParams.get('style') || ''
  const view = searchParams.get('view') || 'grid'

  // Local search state for debouncing
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync local search when URL changes externally (e.g. clear filters)
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const createQueryString = useCallback(
    (params: Record<string, string | string[] | null>) => {
      const newParams = new URLSearchParams(searchParams.toString())

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          newParams.delete(key)
        } else if (Array.isArray(value)) {
          newParams.set(key, value.join(','))
        } else {
          newParams.set(key, value)
        }
      })

      return newParams.toString()
    },
    [searchParams]
  )

  const updateFilters = useCallback((params: Record<string, string | string[] | null>) => {
    startTransition(() => {
      const queryString = createQueryString(params)
      router.push(`/dashboard/courses${queryString ? `?${queryString}` : ''}`, { scroll: false })
    })
  }, [createQueryString, router])

  // Debounced search handler
  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateFilters({ search: value || null })
    }, 400)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const clearAllFilters = () => {
    setLocalSearch('')
    startTransition(() => {
      // Preserve the instrument param when clearing other filters
      const instrument = searchParams.get('instrument')
      if (instrument) {
        router.push(`/dashboard/courses?instrument=${instrument}`, { scroll: false })
      } else {
        router.push('/dashboard/courses', { scroll: false })
      }
    })
  }

  const toggleTeacher = (teacherId: string) => {
    const newTeachers = selectedTeachers.includes(teacherId)
      ? selectedTeachers.filter(id => id !== teacherId)
      : [...selectedTeachers, teacherId]
    updateFilters({ teachers: newTeachers })
  }

  const hasActiveFilters = search || selectedTeachers.length > 0 || difficulty || style

  return (
    <div className="space-y-4 mb-8">
      {/* Search and View Toggle Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-secondary border-0"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          <Button
            variant={view === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => updateFilters({ view: 'grid' })}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-3"
            onClick={() => updateFilters({ view: 'list' })}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3">
        {/* Teachers Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 gap-2 bg-secondary border-0">
              <Filter className="h-4 w-4" />
              Teachers
              {selectedTeachers.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedTeachers.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              {options.teachers.map((teacher) => (
                <label
                  key={teacher.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 p-1.5 rounded-md -mx-1.5"
                >
                  <Checkbox
                    checked={selectedTeachers.includes(teacher.id)}
                    onCheckedChange={() => toggleTeacher(teacher.id)}
                  />
                  <span className="text-sm">{teacher.name}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Style Select */}
        <Select
          value={style}
          onValueChange={(value) => updateFilters({ style: value || null })}
        >
          <SelectTrigger className="w-[140px] h-9 bg-secondary border-0">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            {options.styles.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Difficulty Select */}
        <Select
          value={difficulty}
          onValueChange={(value) => updateFilters({ difficulty: value || null })}
        >
          <SelectTrigger className="w-[140px] h-9 bg-secondary border-0">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active Filters & Results Count */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedTeachers.length > 0 && selectedTeachers.map((teacherId) => {
          const teacher = options.teachers.find(t => t.id === teacherId)
          return teacher ? (
            <Badge key={teacherId} variant="secondary" className="gap-1 pr-1">
              {teacher.name}
              <button
                onClick={() => toggleTeacher(teacherId)}
                className="ml-1 hover:bg-background/50 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ) : null
        })}
        {style && (
          <Badge variant="secondary" className="gap-1 pr-1">
            {style}
            <button
              onClick={() => updateFilters({ style: null })}
              className="ml-1 hover:bg-background/50 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {difficulty && (
          <Badge variant="secondary" className="gap-1 pr-1 capitalize">
            {difficulty}
            <button
              onClick={() => updateFilters({ difficulty: null })}
              className="ml-1 hover:bg-background/50 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          {isPending ? (
            'Loading...'
          ) : hasActiveFilters ? (
            `Showing ${filteredCount} of ${totalCount} courses`
          ) : (
            `${totalCount} courses`
          )}
        </span>
      </div>
    </div>
  )
}
