"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import TestimonialCard from "@/components/marketing/TestimonialCard";
import { useTranslation } from "@/components/language-provider";

const testimonials = [
  {
    nameKey: "homepage.homeSections.testimonials.items.carlosRodriguez.name",
    roleKey: "homepage.homeSections.testimonials.items.carlosRodriguez.role",
    contentKey: "homepage.homeSections.testimonials.items.carlosRodriguez.content",
  },
  {
    nameKey: "homepage.homeSections.testimonials.items.sarahChen.name",
    roleKey: "homepage.homeSections.testimonials.items.sarahChen.role",
    contentKey: "homepage.homeSections.testimonials.items.sarahChen.content",
  },
  {
    nameKey: "homepage.homeSections.testimonials.items.marcusJohnson.name",
    roleKey: "homepage.homeSections.testimonials.items.marcusJohnson.role",
    contentKey: "homepage.homeSections.testimonials.items.marcusJohnson.content",
  },
  {
    nameKey: "homepage.homeSections.testimonials.items.anaMartinez.name",
    roleKey: "homepage.homeSections.testimonials.items.anaMartinez.role",
    contentKey: "homepage.homeSections.testimonials.items.anaMartinez.content",
  },
  {
    nameKey: "homepage.homeSections.testimonials.items.davidKim.name",
    roleKey: "homepage.homeSections.testimonials.items.davidKim.role",
    contentKey: "homepage.homeSections.testimonials.items.davidKim.content",
  },
  {
    nameKey: "homepage.homeSections.testimonials.items.elenaVolkov.name",
    roleKey: "homepage.homeSections.testimonials.items.elenaVolkov.role",
    contentKey: "homepage.homeSections.testimonials.items.elenaVolkov.content",
  },
];

export function HomeTestimonialsSection() {
  const { t } = useTranslation();
  return (
    <section className="bg-muted/50 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {t('homepage.homeSections.testimonials.headingPrefix')}{" "}
            <GradientText>{t('homepage.homeSections.testimonials.headingHighlight')}</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t('homepage.homeSections.testimonials.description')}
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <motion.div
          variants={staggerContainer(0.1, 0.1)}
          initial="hidden"
          animate="visible"
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {testimonials.map((testimonial) => (
            <motion.div key={testimonial.nameKey} variants={staggerChild}>
              <TestimonialCard
                name={t(testimonial.nameKey)}
                role={t(testimonial.roleKey)}
                content={t(testimonial.contentKey)}
                rating={5}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
