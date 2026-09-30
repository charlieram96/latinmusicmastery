/** "Every plan includes" + the All-access "Coming soon" card that sit beside the calculator. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlanCards({ includesTitle, includes, allAccessTitle, allAccessBody, soon }: {
  includesTitle: string
  includes: string[]
  allAccessTitle: string
  allAccessBody: string
  soon: string
}) {
  return (
    <div className="side-cards">
      <div className="inc">
        <span className="sp-label">{includesTitle}</span>
        <ul>{includes.map(x => <li key={x}><CheckIcon /><span>{x}</span></li>)}</ul>
      </div>
      <div className="allaccess">
        <div><b>{allAccessTitle}</b><p>{allAccessBody}</p></div>
        <span className="tag">{soon}</span>
      </div>
    </div>
  )
}
