'use client'

import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from '@/components/language-provider'

interface Instructor {
  id: string
  name: string
  instrument: string
  bio: string | null
  image_url: string | null
  specialties: string[] | null
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getSpecialty(instrument: string, specialties: string[] | null): string {
  if (specialties && specialties.length > 0) {
    return `${instrument} (${specialties.join(', ')})`
  }
  return instrument
}

interface InstructorGridProps {
  instructors: Instructor[]
}

export function InstructorGrid({ instructors }: InstructorGridProps) {
  const { t } = useTranslation()
  return (
    <section id="instructors" className="py-24 md:py-32 bg-secondary">
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
            {t('homepage.homeSections.instructors.gridHeading')}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            {t('homepage.homeSections.instructors.gridSubheading')}
          </p>
        </motion.div>

        {/* Instructors Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {instructors.map((instructor, index) => (
            <motion.div
              key={instructor.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full hover:shadow-md transition-all duration-300 hover:translate-y-[-2px] group cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    {/* Avatar */}
                    <Avatar className="w-20 h-20 mb-4 ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all">
                      {instructor.image_url && <AvatarImage src={instructor.image_url} alt={instructor.name} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                        {getInitials(instructor.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name & Specialty */}
                    <h3 className="text-lg font-semibold mb-1">{instructor.name}</h3>
                    <p className="text-sm text-primary font-medium mb-2">
                      {getSpecialty(instructor.instrument, instructor.specialties)}
                    </p>

                    {/* Bio */}
                    {instructor.bio && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {instructor.bio}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
