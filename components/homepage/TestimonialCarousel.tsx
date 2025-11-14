'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Testimonial {
  name: string
  role: string
  content: string
  initials: string
  rating: number
}

const testimonials: Testimonial[] = [
  {
    name: 'David Chen',
    role: 'Salsa Student',
    content: 'The interactive lessons and expert instructors helped me master salsa rhythms in just 3 months. I can now play confidently with my local band!',
    initials: 'DC',
    rating: 5,
  },
  {
    name: 'Sarah Williams',
    role: 'Bossa Nova Enthusiast',
    content: 'As a jazz guitarist, learning bossa nova opened up a whole new world. The Soundslice integration makes following along so easy.',
    initials: 'SW',
    rating: 5,
  },
  {
    name: 'Miguel Santos',
    role: 'Professional Musician',
    content: 'I wanted to connect with my Colombian roots through music. The cumbia course exceeded my expectations - authentic, detailed, and inspiring.',
    initials: 'MS',
    rating: 5,
  },
  {
    name: 'Emma Taylor',
    role: 'Music Teacher',
    content: 'I use these courses to teach my students about Latin American music. The quality and cultural context are unmatched.',
    initials: 'ET',
    rating: 5,
  },
]

export function TestimonialCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi])
  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  )

  return (
    <section id="testimonials" className="py-24 md:py-32 bg-secondary/50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Student Success Stories
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Join thousands of musicians who have transformed their skills
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="max-w-5xl mx-auto relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="flex-[0_0_100%] min-w-0 px-4">
                  <div className="bg-card rounded-xl border border-border p-6 md:p-10 relative">
                    {/* Quote decoration */}
                    <div className="absolute top-6 left-6 text-6xl text-primary/10 font-serif leading-none">
                      "
                    </div>

                    <div className="relative">
                      {/* Testimonial Content */}
                      <blockquote className="text-lg md:text-xl leading-relaxed mb-6 text-foreground">
                        {testimonial.content}
                      </blockquote>

                      {/* Author Info */}
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 ring-2 ring-primary/10">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {testimonial.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-semibold">{testimonial.name}</div>
                          <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                        </div>
                        {/* Rating */}
                        <div className="flex gap-0.5">
                          {Array.from({ length: testimonial.rating }).map((_, i) => (
                            <svg
                              key={i}
                              className="w-4 h-4 text-yellow-500 fill-current"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="hidden md:flex justify-between absolute top-1/2 -translate-y-1/2 -left-8 -right-8 pointer-events-none">
            <Button
              variant="outline"
              size="icon"
              onClick={scrollPrev}
              className="pointer-events-auto rounded-full bg-background shadow-lg hover:bg-accent"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={scrollNext}
              className="pointer-events-auto rounded-full bg-background shadow-lg hover:bg-accent"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === selectedIndex
                    ? 'bg-primary w-8'
                    : 'bg-border w-2 hover:bg-primary/50'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
