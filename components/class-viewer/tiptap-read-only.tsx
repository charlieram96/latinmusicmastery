'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import Link from '@tiptap/extension-link'

interface TiptapReadOnlyProps {
  content: Record<string, unknown> | null
}

export function TiptapReadOnly({ content }: TiptapReadOnlyProps) {
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
    content: content ?? undefined,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none',
      },
    },
  })

  useEffect(() => {
    if (editor) editor.commands.setContent(content ?? '', false)
  }, [editor, content])

  if (!editor || !content) {
    return null
  }

  return <EditorContent editor={editor} />
}
