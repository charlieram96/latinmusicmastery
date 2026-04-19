import type { Metadata } from 'next'
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ courseId: string }> }): Promise<Metadata> {
  const { courseId } = await params
  const { createClient: createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()
  const { data: course } = await supabase
    .from('courses')
    .select('title, description')
    .eq('id', courseId)
    .single()
  return {
    title: course ? `${course.title} - Latin Music Mastery` : 'Course Preview - Latin Music Mastery',
    description: course?.description ?? 'Preview this Latin music course and explore the curriculum, instructor, and lessons.',
  }
}
import { Lock, BookOpen, BarChart3, User, Music } from "lucide-react";
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import { tiptapToPlainText } from "@/lib/tiptap/plain-text";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export default async function CoursePreviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select(
      "*, musical_styles(name, slug, countries(name, slug)), teachers(id, name, instrument, bio, image_url)"
    )
    .eq("id", courseId)
    .single();

  if (!course) {
    notFound();
  }

  // Fetch course sections with classes for curriculum preview
  const { data: sections } = await supabase
    .from("course_sections")
    .select("id, title, description, order_index, classes(id, title, order_index, is_free)")
    .eq("course_id", courseId)
    .order("order_index");

  // Build breadcrumbs
  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Home", href: "/" },
    { label: "Explore", href: "/explore" },
  ];

  const style =
    course.musical_styles && !Array.isArray(course.musical_styles)
      ? course.musical_styles
      : null;
  const country =
    style && style.countries && !Array.isArray(style.countries)
      ? style.countries
      : null;

  if (country) {
    breadcrumbs.push({
      label: country.name,
      href: `/explore/${country.slug}`,
    });
  }
  if (country && style) {
    breadcrumbs.push({
      label: style.name,
      href: `/explore/${country.slug}/${style.slug}`,
    });
  }
  breadcrumbs.push({ label: course.title });

  // Get teacher info
  const teacher =
    course.teachers && !Array.isArray(course.teachers)
      ? course.teachers
      : null;

  // Count total classes
  const totalClasses =
    sections?.reduce(
      (sum, sec) => sum + (sec.classes ? sec.classes.length : 0),
      0
    ) ?? 0;

  return (
    <>
      <PageHero
        title={course.title}
        subtitle={course.description ?? undefined}
        breadcrumbs={breadcrumbs}
      />

      {/* Course metadata bar */}
      <div className="border-b bg-card/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-4">
          {course.instrument && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music className="h-4 w-4 text-primary" />
              <span>{course.instrument}</span>
            </div>
          )}
          {course.difficulty && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="capitalize">{course.difficulty}</span>
            </div>
          )}
          {teacher && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 text-primary" />
              <span>{teacher.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>
              {totalClasses} {totalClasses === 1 ? "lesson" : "lessons"}
            </span>
          </div>
        </div>
      </div>

      {/* Description section */}
      {course.description && (
        <div className="mx-auto max-w-7xl px-6 py-16">
          <SectionWrapper>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              About This Course
            </h2>
            <p className="max-w-3xl text-muted-foreground leading-relaxed">
              {course.description}
            </p>
          </SectionWrapper>
        </div>
      )}

      {/* Curriculum Preview section */}
      {sections && sections.length > 0 && (
        <div className="mx-auto max-w-7xl px-6 pb-16">
          <SectionWrapper>
            <h2 className="mb-6 text-2xl font-bold tracking-tight">
              Curriculum Preview
            </h2>
            <div className="rounded-2xl border bg-card">
              <Accordion type="multiple" className="w-full">
                {sections.map((section) => {
                  const classes = section.classes
                    ? [...section.classes].sort(
                        (a, b) => a.order_index - b.order_index
                      )
                    : [];
                  const previewClasses = classes.slice(0, 2);
                  const lockedClasses = classes.slice(2);

                  return (
                    <AccordionItem key={section.id} value={section.id}>
                      <AccordionTrigger className="px-6">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-base font-semibold">
                            {section.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {classes.length}{" "}
                            {classes.length === 1 ? "lesson" : "lessons"}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6">
                        <ul className="space-y-2">
                          {previewClasses.map((cls, idx) => (
                            <li
                              key={cls.id}
                              className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-2.5 text-sm"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                {idx + 1}
                              </span>
                              <span>{cls.title}</span>
                            </li>
                          ))}
                          {lockedClasses.map((cls) => (
                            <li
                              key={cls.id}
                              className="flex items-center gap-3 rounded-lg bg-secondary/10 px-4 py-2.5 text-sm text-muted-foreground/60"
                            >
                              <Lock className="h-4 w-4 shrink-0" />
                              <span>Sign up to access</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </SectionWrapper>
        </div>
      )}

      {/* Instructor bio section */}
      {teacher && (
        <div className="mx-auto max-w-7xl px-6 pb-16">
          <SectionWrapper>
            <h2 className="mb-6 text-2xl font-bold tracking-tight">
              Your Instructor
            </h2>
            <div className="flex flex-col items-start gap-6 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
              {teacher.image_url ? (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src={teacher.image_url}
                    alt={teacher.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-10 w-10 text-primary" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{teacher.name}</h3>
                {teacher.instrument && (
                  <p className="text-sm text-primary">{teacher.instrument}</p>
                )}
                {(() => {
                  const bioPreview = tiptapToPlainText(teacher.bio);
                  return bioPreview ? (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-4">
                      {bioPreview}
                    </p>
                  ) : null;
                })()}
              </div>
            </div>
          </SectionWrapper>
        </div>
      )}

      <CTABanner />
    </>
  );
}
