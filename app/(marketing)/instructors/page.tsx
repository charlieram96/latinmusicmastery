import type { Metadata } from 'next'
import { createClient } from "@/lib/supabase/server";
import InstructorsContent from "./instructors-content";

export const metadata: Metadata = {
  title: 'Our Instructors - Latin Music Mastery',
  description: 'Learn from world-class musicians with decades of performance and teaching experience in Latin American music.',
}

export default async function InstructorsPage() {
  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, instrument, bio, image_url, specialties")
    .order("name");

  return <InstructorsContent teachers={teachers} />;
}
