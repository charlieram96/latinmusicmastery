'use client'

import { AdminText } from '@/components/admin/admin-text'


// Up to MAX_SUBTITLE_TRACKS per-language subtitle rows for one lesson video.
// Owns the row list locally and hands the parent the whole persisted array on
// every change. A row added from the language picker is "pending" until a
// file uploads; only rows with a src are reported upward. While any row is
// uploading the others are frozen, so two uploads can never race a save.

import { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SubtitleUpload } from './subtitle-upload'
import { MAX_SUBTITLE_TRACKS, SUBTITLE_LANGUAGES, subtitleLabel } from '@/lib/subtitles/srt-to-vtt'
import type { StoredSubtitle } from '@/lib/subtitles/tracks'

interface SubtitleTracksEditorProps {
  itemId: string
  tracks: StoredSubtitle[]
  onChange: (next: StoredSubtitle[]) => void
}

/** Editor row: `src` is null until the admin uploads a file for that language. */
interface Row {
  lang: string
  src: string | null
}

function persisted(rows: Row[]): StoredSubtitle[] {
  return rows.flatMap((r) => (r.src ? [{ lang: r.lang, src: r.src }] : []))
}

export function SubtitleTracksEditor({ itemId, tracks, onChange }: SubtitleTracksEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => tracks.map((t) => ({ lang: t.lang, src: t.src })))
  const [uploading, setUploading] = useState(false)

  // Latest rows outside React's batching, so back-to-back commits from async
  // upload callbacks always build on the newest list. Only the persisted shape
  // is reported upward, so adding or discarding a pending row never saves.
  const rowsRef = useRef(rows)
  const commit = (fn: (prev: Row[]) => Row[]) => {
    const prev = rowsRef.current
    const next = fn(prev)
    rowsRef.current = next
    setRows(next)
    const before = JSON.stringify(persisted(prev))
    const after = JSON.stringify(persisted(next))
    if (before !== after) onChange(persisted(next))
  }

  const used = new Set(rows.map((r) => r.lang))
  const available = SUBTITLE_LANGUAGES.filter((l) => !used.has(l.code))
  const atCap = rows.length >= MAX_SUBTITLE_TRACKS

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.lang} className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <SubtitleUpload
              itemId={itemId}
              lang={row.lang}
              currentUrl={row.src}
              disabled={uploading}
              onUploadingChange={setUploading}
              onChanged={(url) =>
                commit((prev) =>
                  url === null
                    ? prev.filter((r) => r.lang !== row.lang)
                    : prev.map((r) => (r.lang === row.lang ? { ...r, src: url } : r))
                )
              }
            />
          </div>
          {row.src === null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              disabled={uploading}
              onClick={() => commit((prev) => prev.filter((r) => r.lang !== row.lang))}
              aria-label={`Remove ${subtitleLabel(row.lang)} subtitles`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}

      {atCap ? (
        <p className="text-xs text-muted-foreground"> <AdminText text={"Maximum"} /> {MAX_SUBTITLE_TRACKS} subtitle tracks per video.
        </p>
      ) : available.length > 0 ? (
        // Keyed on the row set so the picker remounts empty after each add.
        <Select
          key={rows.map((r) => r.lang).join(',')}
          disabled={uploading}
          onValueChange={(code) => commit((prev) => [...prev, { lang: code, src: null }])}
        >
          <SelectTrigger
            className="h-7 w-auto gap-1.5 border-dashed text-xs font-normal text-muted-foreground"
            aria-label="Add subtitle language"
          >
            <Plus className="h-3.5 w-3.5" />
            <SelectValue placeholder="Add subtitle language" />
          </SelectTrigger>
          <SelectContent>
            {available.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {<AdminText text={l.label} />}
                <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{l.code}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
