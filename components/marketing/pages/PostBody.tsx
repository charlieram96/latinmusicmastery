import { parsePostBody, type Run } from '@/lib/marketing/pages/blog'

function Runs({ runs }: { runs: Run[] }) {
  return <>{runs.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>))}</>
}

/** A post body in the blog's plain-text format, as `.post-prose` markup. */
export function PostBody({ content }: { content: string }) {
  return (
    <div className="post-prose">
      {parsePostBody(content).map((b, i) => {
        if (b.type === 'h2') return <h2 key={i}><Runs runs={b.runs} /></h2>
        if (b.type === 'ol') return <ol key={i}>{b.items.map((item, j) => <li key={j}><Runs runs={item} /></li>)}</ol>
        return <p key={i}><Runs runs={b.runs} /></p>
      })}
    </div>
  )
}
