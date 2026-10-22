import { describe, expect, it } from 'vitest'
import { isLessonModePath } from '../lesson-mode'

describe('isLessonModePath', () => {
  it.each([
    ['/dashboard/course/c1/class/k1', true],
    ['/dashboard/course/c1/class/k1/', true],
    ['/dashboard/course/c1', false],
    ['/dashboard/course/c1/module/m1', false],
    ['/dashboard/course/c1/class', false],
    ['/dashboard/course/c1/class/k1/extra', false],
    ['/solfeo-preview', true],
    ['/dashboard/course/solfeo-infantil-aplicado', true],
    ['/dashboard/course/solfeo-infantil-aplicado-other', false],
    ['/solfeo-preview-extra', false],
    ['/dashboard', false],
    ['/courses/c1/class/k1', false],
    ['', false],
    [null, false],
  ])('%s → %s', (path, expected) => expect(isLessonModePath(path)).toBe(expected))
})
