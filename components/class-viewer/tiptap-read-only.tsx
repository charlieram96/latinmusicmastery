'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useMemo } from 'react'
import { stripRichLanguageLabels } from '@/lib/i18n/content-labels'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import Link from '@tiptap/extension-link'

interface TiptapReadOnlyProps {
  content: Record<string, unknown> | null
}

export function TiptapReadOnly({ content }: TiptapReadOnlyProps) {
  const displayContent = useMemo(() => content ? stripRichLanguageLabels(content) : null, [content])
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full',
        },
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: 'rounded-lg w-full aspect-video',
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
    ],
    content: displayContent ?? undefined,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  useEffect(() => {
    if (editor) editor.commands.setContent(displayContent ?? '', false)
  }, [editor, displayContent])

  if (!editor || !content) {
    return null
  }

  return <EditorContent editor={editor} />
}
