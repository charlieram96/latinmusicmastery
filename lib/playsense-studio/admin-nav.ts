/**
 * Where the PlaySense Studio "back" link should land for a class item.
 *
 * Class items belong to a course (class → course section → course), so the
 * natural place to return to is that course's overview page in the admin
 * course studio. The courses list is only a fallback when the course id
 * could not be resolved.
 */
export function adminStudioBackHref(courseId: string | null | undefined): string {
  return courseId ? `/admin/courses/${courseId}` : '/admin/courses';
}
