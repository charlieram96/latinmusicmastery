/** Use the frame's unscrolled position so ordinary page scrolling does not resize it. */
export function lessonExerciseHeight(viewportBottom: number, frameTop: number, scrollTop: number, footerHeight: number) {
  return Math.max(1, Math.floor(viewportBottom - (frameTop + scrollTop) - footerHeight - 12))
}

/** In the lesson stage (L2) the frame ends at the stage's bottom, minus the stage content's own bottom padding. */
export function lessonStageHeight(stageBottom: number, frameTop: number, scrollTop: number, bottomPadding: number) {
  return Math.max(1, Math.floor(stageBottom - (frameTop + scrollTop) - bottomPadding))
}
