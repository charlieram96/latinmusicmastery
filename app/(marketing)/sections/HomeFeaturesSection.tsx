"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { PlayCircle, BarChart3, Users, ArrowRight } from "lucide-react";
import { fadeInLeft, fadeInRight } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import { useTranslation } from "@/components/language-provider";

interface Feature {
  icon: React.ElementType;
  titleKey: string;
  descriptionKey: string;
  link: string;
  image: string;
}

const features: Feature[] = [
  {
    icon: PlayCircle,
    titleKey: "homepage.homeSections.features.interactiveRealtime.title",
    descriptionKey: "homepage.homeSections.features.interactiveRealtime.description",
    link: "/explore",
    image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&auto=format&fit=crop&q=80",
  },
  {
    icon: BarChart3,
    titleKey: "homepage.homeSections.features.trackProgress.title",
    descriptionKey: "homepage.homeSections.features.trackProgress.description",
    link: "/explore",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
  },
  {
    icon: Users,
    titleKey: "homepage.homeSections.features.worldClass.title",
    descriptionKey: "homepage.homeSections.features.worldClass.description",
    link: "/instructors",
    image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&auto=format&fit=crop&q=80",
  },
];

function FeatureImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="group/img relative aspect-video overflow-hidden rounded-2xl border border-border">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}

export function HomeFeaturesSection() {
  const { t } = useTranslation();
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {t('homepage.homeSections.features.headingPrefix')}{" "}
            <GradientText>{t('homepage.homeSections.features.headingHighlight')}</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t('homepage.homeSections.features.description')}
          </p>
        </motion.div>

        {/* Feature rows */}
        <div className="space-y-24 lg:space-y-32">
          {features.map((feature, index) => {
            const isEven = index % 2 === 0;
            const Icon = feature.icon;

            return (
              <div
                key={feature.titleKey}
                className="grid items-center gap-12 md:grid-cols-2"
              >
                {/* Text side */}
                <motion.div
                  variants={isEven ? fadeInLeft : fadeInRight}
                  initial="hidden"
                  animate="visible"
                  className={isEven ? "md:order-1" : "md:order-2"}
                >
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
                    {t(feature.descriptionKey)}
                  </p>
                  <Link
                    href={feature.link}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    {t('homepage.homeSections.features.learnMore')}
                    <ArrowRight className="size-4" />
                  </Link>
                </motion.div>

                {/* Image side */}
                <motion.div
                  variants={isEven ? fadeInRight : fadeInLeft}
                  initial="hidden"
                  animate="visible"
                  className={isEven ? "md:order-2" : "md:order-1"}
                >
                  <FeatureImage src={feature.image} alt={t(feature.titleKey)} />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
