/**
 * Where the PlaySense Studio "back" link should land for a class item.
 *
 * Class items belong to a lesson inside a module inside a course
 * (class_item → class → course_section → course). The natural place to
 * return to is that course's studio with the owning lesson open and the
 * item selected, so the admin lands exactly where they left. The courses
 * list is only a fallback when the course id could not be resolved.
 */
export interface AdminStudioBackTarget {
  courseId: string | null | undefined;
  classId?: string | null;
  itemId?: string | null;
}

export function adminStudioBackHref(target: AdminStudioBackTarget | string | null | undefined): string {
  const { courseId, classId, itemId } =
    typeof target === 'object' && target !== null ? target : { courseId: target };
  if (!courseId) return '/admin/courses';

  const params = new URLSearchParams();
  if (classId) params.set('class', classId);
  if (classId && itemId) params.set('item', itemId);
  const query = params.toString();
  return `/admin/courses/${courseId}${query ? `?${query}` : ''}`;
}

/** Link to published content; never an admin route or a draft-preview parameter. */
export function studentHrefFromAdmin(backHref?: string): string | undefined {
  if (!backHref) return undefined;
  const url = new URL(backHref, 'https://latinmusicmastery.com');
  const match = url.pathname.match(/^\/admin\/courses\/([^/]+)$/);
  const classId = url.searchParams.get('class'), itemId = url.searchParams.get('item');
  if (!match || !classId || !itemId) return undefined;
  return `/dashboard/course/${encodeURIComponent(match[1])}/class/${encodeURIComponent(classId)}?itemId=${encodeURIComponent(itemId)}`;
}
