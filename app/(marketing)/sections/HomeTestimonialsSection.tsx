"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerChild } from "@/lib/animation-variants";
import GradientText from "@/components/marketing/GradientText";
import TestimonialCard from "@/components/marketing/TestimonialCard";

const testimonials = [
  {
    name: "Carlos Rodriguez",
    role: "Guitarist, 3 years learning",
    content:
      "The Soundslice integration is incredible. Being able to slow down passages and loop difficult sections has transformed my practice sessions.",
  },
  {
    name: "Sarah Chen",
    role: "Pianist, 1 year learning",
    content:
      "I never thought I could learn bossa nova rhythms online, but the instructors make it feel like private lessons. The progress tracking keeps me motivated.",
  },
  {
    name: "Marcus Johnson",
    role: "Drummer, 2 years learning",
    content:
      "Finally, a platform that teaches authentic Latin rhythms with proper technique. The quality of instruction is on par with conservatory-level teaching.",
  },
  {
    name: "Ana Martinez",
    role: "Multi-instrumentalist",
    content:
      "The variety of styles covered is amazing. From Cuban son to Argentine tango, I have been able to expand my musical vocabulary tremendously.",
  },
  {
    name: "David Kim",
    role: "Bass player, 6 months learning",
    content:
      "The downloadable resources are fantastic. Having sheet music and backing tracks for offline practice has made a huge difference in my learning.",
  },
  {
    name: "Elena Volkov",
    role: "Jazz musician",
    content:
      "As a jazz musician wanting to incorporate Latin elements, this platform has been invaluable. The instructors explain the cultural context beautifully.",
  },
];

export function HomeTestimonialsSection() {
  return (
    <section className="bg-muted/50 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Loved by{" "}
            <GradientText>musicians worldwide</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            See what our students have to say about their learning experience.
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <motion.div
          variants={staggerContainer(0.1, 0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {testimonials.map((testimonial) => (
            <motion.div key={testimonial.name} variants={staggerChild}>
              <TestimonialCard
                name={testimonial.name}
                role={testimonial.role}
                content={testimonial.content}
                rating={5}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
