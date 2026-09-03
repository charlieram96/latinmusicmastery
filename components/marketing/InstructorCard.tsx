"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animation-variants";
import InstructorBioModal from "@/components/marketing/InstructorBioModal";
import { useTranslation } from "@/components/language-provider";

interface InstructorCardProps {
  name: string;
  instrument: string;
  bio?: unknown;
  imageUrl?: string | null;
  specialties?: string[] | null;
  href?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function InstructorCard({
  name,
  instrument,
  bio,
  imageUrl,
  specialties,
  href,
}: InstructorCardProps) {
  const { t } = useTranslation();
  const content = (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      {/* Image area */}
      <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-card">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            width={400}
            height={533}
            className="h-full w-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-orange-400/20 to-amber-500/30">
            <span className="text-5xl font-bold text-primary/60">
              {getInitials(name)}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-primary">{instrument}</p>

        {specialties && specialties.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {specialties.slice(0, 3).map((specialty) => (
              <span
                key={specialty}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {specialty}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {content}
      </Link>
    );
  }

  if (bio) {
    return (
      <InstructorBioModal
        name={name}
        instrument={instrument}
        bio={bio}
        imageUrl={imageUrl}
        specialties={specialties}
      >
        <button
          type="button"
          aria-label={t("marketing.common.openBioFor", { name })}
          className="group block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
        >
          {content}
        </button>
      </InstructorBioModal>
    );
  }

  return <div className="group block">{content}</div>;
}
