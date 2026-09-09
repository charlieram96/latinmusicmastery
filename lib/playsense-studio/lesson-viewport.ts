/** Use the frame's unscrolled position so ordinary page scrolling does not resize it. */
export function lessonExerciseHeight(viewportBottom: number, frameTop: number, scrollTop: number, footerHeight: number) {
  return Math.max(1, Math.floor(viewportBottom - (frameTop + scrollTop) - footerHeight - 12))
}
