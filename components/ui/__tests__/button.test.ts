import { describe, expect, it } from 'vitest'
import { buttonVariants } from '../button'

describe('chunky button variants', () => {
  it('chunky has the 3D bottom edge, press-down and heading type', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    expect(cls).toContain('shadow-[0_4px_0_hsl(var(--primary-deep))]')
    expect(cls).toContain('active:translate-y-[4px]')
    expect(cls).toContain('active:shadow-none')
    expect(cls).toContain('font-heading')
    expect(cls).toContain('uppercase')
    // the base press-shrink must not fight the press-down
    expect(cls).not.toContain('active:scale-[0.98]')
  })

  it('press timing uses arbitrary properties Tailwind can emit (utility forms with var() are ambiguous and emit nothing)', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    expect(cls).toContain('[transition-duration:var(--dur-tap)]')
    expect(cls).toContain('[transition-timing-function:var(--ease-out)]')
    expect(cls).not.toMatch(/(^|\s)duration-\[var/)
    expect(cls).not.toMatch(/(^|\s)ease-\[var/)
  })

  it('tones use their own deep edge colour', () => {
    expect(buttonVariants({ variant: 'chunky-success' })).toContain('shadow-[0_4px_0_hsl(var(--success-deep))]')
    expect(buttonVariants({ variant: 'chunky-danger' })).toContain('shadow-[0_4px_0_hsl(var(--danger-deep))]')
    expect(buttonVariants({ variant: 'chunky-ghost' })).toContain('shadow-[0_4px_0_hsl(var(--border)),inset_0_0_0_2px_hsl(var(--border))]')
  })

  it('disabled chunky buttons lose the edge and look muted', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    expect(cls).toContain('disabled:bg-muted')
    expect(cls).toContain('disabled:text-muted-foreground')
    expect(cls).toContain('disabled:shadow-[0_4px_0_hsl(var(--border))]')
  })

  it('existing variants are unchanged', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary text-primary-foreground')
    expect(buttonVariants({ variant: 'default' })).toContain('active:scale-[0.98]')
  })
})
