'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createExercise, updateExercise } from '@/app/actions/play-sense'
import { PlaySenseAudioUpload } from '@/components/admin/play-sense-audio-upload'
import { PlaySensePatternGrid } from '@/components/admin/play-sense-pattern-grid'
import type { ExerciseEvent, Instrument } from '@/lib/play-sense/types'
import { Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ExerciseEditorFormProps {
  exercise: {
    id: string
    title: string
    description: string | null
    instrument: string
    bpm: number
    time_signature: unknown
    swing: number
    difficulty: string
    measures: number
    loop_count: number
    events: unknown
    is_published: boolean
    order_index: number
    audio_url?: string | null
  } | null
  isNew: boolean
}

const EXAMPLE_EVENTS = JSON.stringify([
  { beat: 1, measure: 1, instrument: "conga", technique: "heel", hand: "L", duration: 0.5, vexKey: "c/5", accent: false },
  { beat: 1.5, measure: 1, instrument: "conga", technique: "tip", hand: "L", duration: 0.5, vexKey: "c/5", accent: false },
  { beat: 2, measure: 1, instrument: "conga", technique: "touch", hand: "R", duration: 0.5, vexKey: "e/5", accent: false },
  { beat: 2.5, measure: 1, instrument: "conga", technique: "open", hand: "R", duration: 0.5, vexKey: "e/5", accent: true },
], null, 2)

export function ExerciseEditorForm({ exercise, isNew }: ExerciseEditorFormProps) {
  const router = useRouter()
  const [eventsJson, setEventsJson] = useState(
    exercise?.events ? JSON.stringify(exercise.events, null, 2) : EXAMPLE_EVENTS
  )
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string>(exercise?.audio_url || '')
  const [instrument, setInstrument] = useState<Instrument>((exercise?.instrument || 'conga') as Instrument)
  const [measures, setMeasures] = useState(exercise?.measures || 4)
  const [activeTab, setActiveTab] = useState<string>('grid')

  const timeSignature = exercise?.time_signature as [number, number] || [4, 4]
  const [timeSig, setTimeSig] = useState<[number, number]>(timeSignature)

  // Parse events from JSON for grid use
  const parsedEvents: ExerciseEvent[] = (() => {
    try {
      const parsed = JSON.parse(eventsJson)
      if (Array.isArray(parsed)) return parsed
    } catch { /* ignore */ }
    return []
  })()

  const validateJson = (json: string) => {
    try {
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed)) {
        setJsonError('Events must be a JSON array')
        return false
      }
      for (const event of parsed) {
        if (typeof event.beat !== 'number' || typeof event.measure !== 'number') {
          setJsonError('Each event must have numeric "beat" and "measure" fields')
          return false
        }
      }
      setJsonError(null)
      return true
    } catch (e) {
      setJsonError('Invalid JSON: ' + (e as Error).message)
      return false
    }
  }

  // Grid -> JSON sync
  const handleGridChange = useCallback((newEvents: ExerciseEvent[]) => {
    const json = JSON.stringify(newEvents, null, 2)
    setEventsJson(json)
    setJsonError(null)
  }, [])

  // JSON -> Grid sync happens automatically via parsedEvents

  const handleSubmit = async (formData: FormData) => {
    if (!validateJson(eventsJson)) return

    setSaving(true)
    try {
      formData.set('events', eventsJson)
      formData.set('audio_url', audioUrl)
      if (isNew) {
        await createExercise(formData)
      } else {
        await updateExercise(exercise!.id, formData)
      }
      router.push('/admin/play-sense')
    } catch (err) {
      console.error('Failed to save exercise:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/play-sense">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to exercises
        </Link>
      </Button>

      {/* Basic Info */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">Basic Info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={exercise?.title || ''} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" defaultValue={exercise?.description || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument">Instrument</Label>
            <Select
              name="instrument"
              defaultValue={instrument}
              onValueChange={(v) => setInstrument(v as Instrument)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conga">Congas</SelectItem>
                <SelectItem value="timbale">Timbales</SelectItem>
                <SelectItem value="bongo">Bongos</SelectItem>
                <SelectItem value="clave">Clave</SelectItem>
                <SelectItem value="cowbell">Cowbell</SelectItem>
                <SelectItem value="guiro">Guiro</SelectItem>
                <SelectItem value="guitar">Guitar</SelectItem>
                <SelectItem value="bass">Bass</SelectItem>
                <SelectItem value="piano">Piano</SelectItem>
                <SelectItem value="tres">Tres</SelectItem>
                <SelectItem value="cuatro">Cuatro</SelectItem>
                <SelectItem value="trumpet">Trumpet</SelectItem>
                <SelectItem value="saxophone">Saxophone</SelectItem>
                <SelectItem value="flute">Flute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select name="difficulty" defaultValue={exercise?.difficulty || 'beginner'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Audio Upload */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">Backing Track</h2>
        <p className="text-sm text-muted-foreground">
          Upload an audio file to play as a backing track during practice. Optional — exercises work with metronome only.
        </p>
        <PlaySenseAudioUpload
          exerciseId={exercise?.id || 'new'}
          currentAudioUrl={audioUrl || null}
          onAudioUploaded={setAudioUrl}
        />
        <input type="hidden" name="audio_url" value={audioUrl} />
      </Card>

      {/* Timing */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">Timing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bpm">BPM</Label>
            <Input id="bpm" name="bpm" type="number" min="40" max="300" defaultValue={exercise?.bpm || 100} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time_signature">Time Signature</Label>
            <Select
              name="time_signature"
              defaultValue={JSON.stringify(timeSig)}
              onValueChange={(v) => {
                try { setTimeSig(JSON.parse(v)) } catch { /* ignore */ }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="[4,4]">4/4</SelectItem>
                <SelectItem value="[3,4]">3/4</SelectItem>
                <SelectItem value="[6,8]">6/8</SelectItem>
                <SelectItem value="[2,4]">2/4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="swing">Swing (0-1)</Label>
            <Input id="swing" name="swing" type="number" min="0" max="1" step="0.1" defaultValue={exercise?.swing || 0} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="measures">Measures</Label>
            <Input
              id="measures"
              name="measures"
              type="number"
              min="1"
              max="64"
              defaultValue={measures}
              onChange={(e) => setMeasures(Number(e.target.value) || 4)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loop_count">Loop Count</Label>
            <Input id="loop_count" name="loop_count" type="number" min="1" max="16" defaultValue={exercise?.loop_count || 1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order_index">Sort Order</Label>
            <Input id="order_index" name="order_index" type="number" min="0" defaultValue={exercise?.order_index || 0} />
          </div>
        </div>
      </Card>

      {/* Pattern Editor */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">Pattern</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="grid">Grid Editor</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-4">
            <PlaySensePatternGrid
              events={parsedEvents}
              instrument={instrument}
              measures={measures}
              timeSignature={timeSig}
              onChange={handleGridChange}
            />
          </TabsContent>

          <TabsContent value="json" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Define the percussion pattern as an array of events. Each event needs: beat, measure, instrument, technique, hand, duration, vexKey, accent.
            </p>
            <textarea
              className="w-full min-h-[300px] p-3 font-mono text-sm bg-muted rounded-lg border resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              value={eventsJson}
              onChange={(e) => {
                setEventsJson(e.target.value)
                if (jsonError) validateJson(e.target.value)
              }}
              onBlur={() => validateJson(eventsJson)}
            />
            {jsonError && (
              <p className="text-sm text-destructive">{jsonError}</p>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Publish & Submit */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="is_published"
              name="is_published"
              defaultChecked={exercise?.is_published || false}
              value="true"
            />
            <Label htmlFor="is_published">Published</Label>
          </div>
          <Button type="submit" disabled={saving || !!jsonError}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : isNew ? 'Create Exercise' : 'Save Changes'}
          </Button>
        </div>
      </Card>
    </form>
  )
}
