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
    ['/dashboard', false],
    ['/courses/c1/class/k1', false],
    ['', false],
    [null, false],
  ])('%s → %s', (path, expected) => expect(isLessonModePath(path)).toBe(expected))
})
