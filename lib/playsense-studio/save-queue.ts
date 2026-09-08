// Serialize writes per score so an older in-flight save cannot overwrite a newer edit.
const pending = new Map<string, Promise<unknown>>();

export function queueStudioSave<T>(scoreId: string, write: () => Promise<T>): Promise<T> {
  const previous = pending.get(scoreId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  pending.set(scoreId, next);
  const cleanup = () => { if (pending.get(scoreId) === next) pending.delete(scoreId); };
  void next.then(cleanup, cleanup);
  return next;
}
