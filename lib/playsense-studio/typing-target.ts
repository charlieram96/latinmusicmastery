// True when a key event comes from somewhere the admin is typing — a field, a
// contenteditable, or anything inside an open menu (role="dialog") — so the
// studio's keyboard shortcuts leave it alone.

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && (target.isContentEditable || !!target.closest('[role="dialog"]')))
  );
}
