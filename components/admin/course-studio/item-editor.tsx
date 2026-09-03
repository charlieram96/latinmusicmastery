'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateClassItem } from '@/app/actions/course-builder'
import { VideoUpload } from '../video-upload'
import { SubtitleTracksEditor } from '../subtitle-tracks-editor'
import { QuizQuestionsEditor } from '../quiz-questions-editor'
import { JamSessionEditor } from '../jam-session-editor'
import { TiptapEditor } from '../tiptap-editor'
import { PlaysenseStudioScoreAttach } from '../playsense-studio-score-attach'
import type { ClassItem } from '@/types/modules'
import type { StoredSubtitle } from '@/lib/subtitles/tracks'
import { useAutosave } from './use-autosave'
import { useSaveStatus } from './save-status'
import { ItemSaveProvider, useItemSave } from './item-save-context'
import { ItemSaveBar } from './item-save-bar'

interface ItemEditorProps {
  item: ClassItem
  onPatched: (patch: Partial<ClassItem>) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
      {children}
    </h4>
  )
}

/** Drawer form for a single class item. Mount keyed by item id — local drafts
    initialize from the item once, and the autosave hook flushes pending edits
    on unmount so switching items mid-debounce never loses keystrokes. The
    ItemSaveProvider scopes the explicit Save button + status footer across both
    these fields and the nested quiz editor. */
export function ItemEditor(props: ItemEditorProps) {
  return (
    <ItemSaveProvider>
      <ItemEditorBody {...props} />
    </ItemSaveProvider>
  )
}

function ItemEditorBody({ item, onPatched }: ItemEditorProps) {
  const { track } = useSaveStatus()
  const { setDirty, registerFlush } = useItemSave()
  const { queue: queueRaw, saveNow: saveNowRaw, flush } = useAutosave<Record<string, unknown>>({
    save: async (patch) => {
      const res = await track(updateClassItem(item.id, patch))
      setDirty('fields', false)
      return res
    },
  })

  // Mark this editor dirty as soon as edits are queued; cleared when the save
  // resolves. Register the field flush so the Save button persists immediately.
  const queue = (patch: Record<string, unknown>) => {
    setDirty('fields', true)
    queueRaw(patch)
  }
  const saveNow = (patch?: Record<string, unknown>) => {
    setDirty('fields', true)
    saveNowRaw(patch)
  }
  useEffect(() => registerFlush(flush), [registerFlush, flush])

  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [titleEs, setTitleEs] = useState(item.title_es ?? '')
  const [descriptionEs, setDescriptionEs] = useState(item.description_es ?? '')
  const [soundslice, setSoundslice] = useState(item.soundslice_embed_url ?? '')

  const scoreDocumentId =
    (item as ClassItem & { score_document_id?: string | null }).score_document_id ?? null

  const handleTitleChange = (value: string) => {
    setTitle(value)
    const trimmed = value.trim()
    if (!trimmed) return // never persist an empty title
    onPatched({ title: trimmed })
    queue({ title: trimmed })
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    onPatched({ description: value || null })
    queue({ description: value || null })
  }

  const handleTitleEsChange = (value: string) => {
    setTitleEs(value)
    onPatched({ title_es: value || null } as Partial<ClassItem>)
    queue({ title_es: value || null })
  }

  const handleDescriptionEsChange = (value: string) => {
    setDescriptionEs(value)
    onPatched({ description_es: value || null } as Partial<ClassItem>)
    queue({ description_es: value || null })
  }

  const handleVideoUploaded = (url: string) => {
    onPatched({ video_url: url })
    saveNow({ video_url: url })
  }

  const handleSubtitlesChange = (next: StoredSubtitle[]) => {
    onPatched({ subtitles: next })
    saveNow({ subtitles: next })
  }

  const handleJamChange = (data: {
    audio_url?: string
    bpm?: number | null
    key_signature?: string | null
  }) => {
    onPatched(data as Partial<ClassItem>)
    // Typing a BPM debounces; uploads and key selection persist immediately.
    if ('bpm' in data) queue(data)
    else saveNow(data)
  }

  return (
    <>
    <div className="space-y-6 px-5 py-5">
      {/* Basics */}
      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="item-title" className="text-xs">
            Title
          </Label>
          <Input
            id="item-title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Item title"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-title-es" className="text-xs text-muted-foreground">
            Title (Español)
          </Label>
          <Input
            id="item-title-es"
            value={titleEs}
            onChange={(e) => handleTitleEsChange(e.target.value)}
            placeholder="Título en español (opcional)"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="item-description"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={2}
            placeholder="Brief description…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="item-description-es" className="text-xs text-muted-foreground">
            Description (Español)
          </Label>
          <Textarea
            id="item-description-es"
            value={descriptionEs}
            onChange={(e) => handleDescriptionEsChange(e.target.value)}
            rows={2}
            placeholder="Descripción en español (opcional)…"
          />
        </div>
      </div>

      {/* Type-specific content */}
      {item.item_type === 'VIDEO' && (
        <div className="space-y-5 border-t border-border pt-5">
          <SectionLabel>Video</SectionLabel>
          <VideoUpload
            moduleId={item.id}
            currentVideoUrl={item.video_url}
            onVideoUploaded={handleVideoUploaded}
          />
          {item.video_url && (
            <div className="space-y-2">
              <SectionLabel>Subtitles</SectionLabel>
              <SubtitleTracksEditor
                itemId={item.id}
                tracks={item.subtitles ?? []}
                onChange={handleSubtitlesChange}
              />
            </div>
          )}
          <PlaysenseStudioScoreAttach
            classItemId={item.id}
            itemType={item.item_type}
            currentScoreDocumentId={scoreDocumentId}
          />
          <details className="group">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60 transition hover:text-foreground">
              Legacy Soundslice URL
            </summary>
            <div className="mt-3 grid gap-1.5">
              <Input
                value={soundslice}
                onChange={(e) => {
                  setSoundslice(e.target.value)
                  onPatched({ soundslice_embed_url: e.target.value || null })
                  queue({ soundslice_embed_url: e.target.value || null })
                }}
                placeholder="https://www.soundslice.com/slices/…"
              />
              <p className="text-xs text-muted-foreground">
                Fallback when no PlaySense Studio score is attached. New content should use the
                score importer above.
              </p>
            </div>
          </details>
        </div>
      )}

      {item.item_type === 'QUIZ' && (
        <div className="space-y-5 border-t border-border pt-5">
          <details className="group" open={!!item.video_url}>
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60 transition hover:text-foreground">
              Intro video &amp; notation (optional)
            </summary>
            <div className="mt-3 space-y-5">
              <VideoUpload
                moduleId={item.id}
                currentVideoUrl={item.video_url}
                onVideoUploaded={handleVideoUploaded}
              />
              {item.video_url && (
                <div className="space-y-2">
                  <SectionLabel>Subtitles</SectionLabel>
                  <SubtitleTracksEditor
                    itemId={item.id}
                    tracks={item.subtitles ?? []}
                    onChange={handleSubtitlesChange}
                  />
                </div>
              )}
              <PlaysenseStudioScoreAttach
                classItemId={item.id}
                currentScoreDocumentId={scoreDocumentId}
              />
            </div>
          </details>

          <div className="space-y-3">
            <SectionLabel>Questions</SectionLabel>
            <QuizQuestionsEditor classItemId={item.id} kind="Quiz" />
          </div>
        </div>
      )}

      {item.item_type === 'EXERCISE' && (
        <div className="space-y-5 border-t border-border pt-5">
          <SectionLabel>Exercise video &amp; score</SectionLabel>
          <VideoUpload
            moduleId={item.id}
            currentVideoUrl={item.video_url}
            onVideoUploaded={handleVideoUploaded}
          />
          <PlaysenseStudioScoreAttach
            classItemId={item.id}
            currentScoreDocumentId={scoreDocumentId}
          />
          <details className="group border-t border-border pt-5">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60 transition hover:text-foreground">
              Questions (optional)
            </summary>
            <div className="mt-3">
              <QuizQuestionsEditor classItemId={item.id} kind="Exercise" />
            </div>
          </details>
        </div>
      )}

      {item.item_type === 'JAM_SESSION' && (
        <div className="space-y-5 border-t border-border pt-5">
          <SectionLabel>Jam session</SectionLabel>
          <JamSessionEditor
            itemId={item.id}
            audioUrl={item.audio_url}
            bpm={item.bpm}
            keySignature={item.key_signature}
            onChange={handleJamChange}
          />
        </div>
      )}

      {/* Rich content */}
      <div className="space-y-3 border-t border-border pt-5">
        <SectionLabel>Notes &amp; rich content</SectionLabel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Instructions and supporting material rendered below the player on the lesson page.
        </p>
        <TiptapEditor
          content={item.rich_content}
          onChange={(content) => {
            onPatched({ rich_content: content })
            queue({ rich_content: content })
          }}
        />
      </div>
    </div>
    <ItemSaveBar />
    </>
  )
}
