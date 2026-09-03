import type { Metadata } from 'next'
import { createClient } from "@/lib/supabase/server";
import { getServerTranslator } from "@/lib/i18n/server";
import { localizeTeachers } from "@/lib/i18n/localize";
import InstructorsContent from "./instructors-content";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslator()
  return {
    title: t('marketing.pages.instructors.metadata.title'),
    description: t('marketing.pages.instructors.metadata.description'),
  }
}

export default async function InstructorsPage() {
  const supabase = await createClient();
  const { locale } = await getServerTranslator();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, instrument, instrument_es, bio, bio_es, image_url, specialties")
    .order("name");

  localizeTeachers(teachers as Record<string, unknown>[] | null, locale);

  return <InstructorsContent teachers={teachers} />;
}
