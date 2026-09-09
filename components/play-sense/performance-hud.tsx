'use client'

import './performance.css'

interface PerformanceHudProps {
  score: number
  combo: number
  accuracy: number
  hasResults: boolean
  playing?: boolean
  compact?: boolean
}

const percent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

export function PerformanceHud({ score, combo, accuracy, hasResults, playing = false, compact = false }: PerformanceHudProps) {
  const streak = Math.max(0, Math.floor(combo))
  return <aside className={`ps-scoreboard${compact ? ' ps-scoreboard-compact' : ''}`} aria-label="Performance stats">
    <div className="ps-scoreboard-heading"><span>YOUR SESSION</span><span className={playing ? 'is-live' : ''}><i />{playing ? 'Live' : 'Ready'}</span></div>
    <div className="ps-scoreboard-numbers">
      <div className="ps-scoreboard-score"><span className="ps-stat-label">Score</span><div><strong>{hasResults ? Math.round(percent(score)) : '—'}</strong><small>/ 100</small></div></div>
      <div className="ps-scoreboard-combo" data-milestone={playing && streak > 0 && streak % 10 === 0}>
        <span className="ps-stat-label">Combo</span><div><strong>{streak}</strong><small>in a row</small></div>
        <div className="ps-combo-lights" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} data-on={i < streak} />)}</div>
      </div>
    </div>
    <div className="ps-scoreboard-accuracy">
      <div><span className="ps-stat-label">Accuracy</span><strong>{hasResults ? `${Math.round(percent(accuracy))}%` : '—'}</strong></div>
      <div className="ps-accuracy-track" aria-hidden="true"><span style={{ width: `${hasResults ? percent(accuracy) : 0}%` }} /></div>
    </div>
  </aside>
}
