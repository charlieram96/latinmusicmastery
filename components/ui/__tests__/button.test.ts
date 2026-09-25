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

describe('chunky sizes', () => {
  const tones = ['chunky', 'chunky-success', 'chunky-danger', 'chunky-ghost'] as const
  const has = (cls: string, token: string) => cls.split(/\s+/).includes(token)

  it('sm is 8px 14px with 12px text and no fixed height', () => {
    const cls = buttonVariants({ variant: 'chunky', size: 'sm' })
    for (const t of ['h-auto', 'px-[14px]', 'py-2', 'text-xs', 'has-[>svg]:px-[14px]']) expect(has(cls, t)).toBe(true)
    for (const t of ['h-9', 'px-4', 'has-[>svg]:px-3']) expect(has(cls, t)).toBe(false)
  })

  it('default is 12px 22px with 14px text', () => {
    const cls = buttonVariants({ variant: 'chunky' })
    for (const t of ['h-auto', 'px-[22px]', 'py-3', 'text-sm']) expect(has(cls, t)).toBe(true)
    for (const t of ['h-10', 'px-5']) expect(has(cls, t)).toBe(false)
  })

  it('lg is larger: 14px 28px with 16px text', () => {
    const cls = buttonVariants({ variant: 'chunky', size: 'lg' })
    for (const t of ['h-auto', 'px-7', 'py-3.5', 'text-base']) expect(has(cls, t)).toBe(true)
    expect(has(cls, 'h-11')).toBe(false)
  })

  it('applies to every chunky tone', () => {
    for (const v of tones) expect(has(buttonVariants({ variant: v, size: 'sm' }), 'px-[14px]')).toBe(true)
  })

  it('non-chunky sizes are unchanged', () => {
    expect(buttonVariants({ size: 'sm' })).toContain('h-9 gap-1.5 px-4 text-xs')
    expect(buttonVariants({ variant: 'outline', size: 'lg' })).toContain('h-11 px-6')
  })
})
