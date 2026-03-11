'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createExercise, updateExercise } from '@/app/actions/play-sense'
import { PlaySenseAudioUpload } from '@/components/admin/play-sense-audio-upload'
import { ExerciseWorkspace } from '@/components/admin/sequencer/exercise-workspace'
import type { ExerciseEvent, Instrument, Difficulty } from '@/lib/play-sense/types'
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

const EXAMPLE_EVENTS: ExerciseEvent[] = [
  { beat: 1, measure: 1, instrument: "conga", technique: "heel", hand: "L", duration: 0.5, vexKey: "c/5", accent: false },
  { beat: 1.5, measure: 1, instrument: "conga", technique: "tip", hand: "L", duration: 0.5, vexKey: "c/5", accent: false },
  { beat: 2, measure: 1, instrument: "conga", technique: "touch", hand: "R", duration: 0.5, vexKey: "e/5", accent: false },
  { beat: 2.5, measure: 1, instrument: "conga", technique: "open", hand: "R", duration: 0.5, vexKey: "e/5", accent: true },
]

export function ExerciseEditorForm({ exercise, isNew }: ExerciseEditorFormProps) {
  const router = useRouter()

  // Controlled form state
  const [title, setTitle] = useState(exercise?.title || '')
  const [description, setDescription] = useState(exercise?.description || '')
  const [instrument, setInstrument] = useState<Instrument>((exercise?.instrument || 'conga') as Instrument)
  const [difficulty, setDifficulty] = useState<Difficulty>((exercise?.difficulty || 'beginner') as Difficulty)
  const [bpm, setBpm] = useState(exercise?.bpm || 100)
  const [timeSig, setTimeSig] = useState<[number, number]>(
    (exercise?.time_signature as [number, number]) || [4, 4]
  )
  const [swing, setSwing] = useState(exercise?.swing || 0)
  const [measures, setMeasures] = useState(exercise?.measures || 4)
  const [loopCount, setLoopCount] = useState(exercise?.loop_count || 1)
  const [orderIndex, setOrderIndex] = useState(exercise?.order_index || 0)
  const [audioUrl, setAudioUrl] = useState<string>(exercise?.audio_url || '')
  const [isPublished, setIsPublished] = useState(exercise?.is_published || false)

  // Events state
  const initialEvents: ExerciseEvent[] = (() => {
    try {
      const parsed = exercise?.events
      if (Array.isArray(parsed)) return parsed
    } catch { /* ignore */ }
    return EXAMPLE_EVENTS
  })()

  const [events, setEvents] = useState<ExerciseEvent[]>(initialEvents)
  const [eventsJson, setEventsJson] = useState(JSON.stringify(initialEvents, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const validateJson = useCallback((json: string) => {
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
  }, [])

  // Sequencer -> JSON sync
  const handleEventsChange = useCallback((newEvents: ExerciseEvent[]) => {
    setEvents(newEvents)
    setEventsJson(JSON.stringify(newEvents, null, 2))
    setJsonError(null)
  }, [])

  // JSON -> Sequencer sync
  const handleJsonChange = useCallback((json: string) => {
    setEventsJson(json)
    if (jsonError) validateJson(json)
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        setEvents(parsed)
      }
    } catch { /* ignore during typing */ }
  }, [jsonError, validateJson])

  const handleJsonBlur = useCallback(() => {
    validateJson(eventsJson)
  }, [eventsJson, validateJson])

  const handleSubmit = async (formData: FormData) => {
    if (!validateJson(eventsJson)) return

    setSaving(true)
    try {
      formData.set('title', title)
      formData.set('description', description)
      formData.set('instrument', instrument)
      formData.set('difficulty', difficulty)
      formData.set('bpm', String(bpm))
      formData.set('time_signature', JSON.stringify(timeSig))
      formData.set('swing', String(swing))
      formData.set('measures', String(measures))
      formData.set('loop_count', String(loopCount))
      formData.set('order_index', String(orderIndex))
      formData.set('events', eventsJson)
      formData.set('audio_url', audioUrl)
      formData.set('is_published', isPublished ? 'true' : 'false')
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
            <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument">Instrument</Label>
            <Select
              name="instrument"
              value={instrument}
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
            <Select name="difficulty" value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
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
            <Input
              id="bpm"
              name="bpm"
              type="number"
              min="40"
              max="300"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value) || 100)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time_signature">Time Signature</Label>
            <Select
              name="time_signature"
              value={JSON.stringify(timeSig)}
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
            <Input
              id="swing"
              name="swing"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={swing}
              onChange={(e) => setSwing(Number(e.target.value) || 0)}
            />
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
              value={measures}
              onChange={(e) => setMeasures(Number(e.target.value) || 4)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loop_count">Loop Count</Label>
            <Input
              id="loop_count"
              name="loop_count"
              type="number"
              min="1"
              max="16"
              value={loopCount}
              onChange={(e) => setLoopCount(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="order_index">Sort Order</Label>
            <Input
              id="order_index"
              name="order_index"
              type="number"
              min="0"
              value={orderIndex}
              onChange={(e) => setOrderIndex(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </Card>

      {/* Sequencer Workspace */}
      <ExerciseWorkspace
        events={events}
        onChange={handleEventsChange}
        instrument={instrument}
        measures={measures}
        timeSignature={timeSig}
        bpm={bpm}
        swing={swing}
        difficulty={difficulty}
        audioUrl={audioUrl}
        exerciseId={exercise?.id || 'new'}
        title={title}
        description={description}
        loopCount={loopCount}
        eventsJson={eventsJson}
        onJsonChange={handleJsonChange}
        jsonError={jsonError}
        onJsonBlur={handleJsonBlur}
      />

      {/* Publish & Submit */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="is_published"
              name="is_published"
              checked={isPublished}
              onCheckedChange={setIsPublished}
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
