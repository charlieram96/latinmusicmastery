'use client'

import { motion } from 'framer-motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

interface Instructor {
  name: string
  specialty: string
  bio: string
  initials: string
}

const instructors: Instructor[] = [
  {
    name: 'Carlos Mendoza',
    specialty: 'Salsa & Latin Jazz',
    bio: '20+ years performing with top orchestras across Latin America',
    initials: 'CM',
  },
  {
    name: 'Maria Rodriguez',
    specialty: 'Bossa Nova & Samba',
    bio: 'Grammy-nominated guitarist and composer from Rio de Janeiro',
    initials: 'MR',
  },
  {
    name: 'Juan Torres',
    specialty: 'Tango & Milonga',
    bio: 'Principal dancer and musician at Teatro Colón',
    initials: 'JT',
  },
  {
    name: 'Sofia Martinez',
    specialty: 'Merengue & Bachata',
    bio: 'Former member of Orquesta Aragón, 15 years teaching experience',
    initials: 'SM',
  },
  {
    name: 'Roberto Jimenez',
    specialty: 'Cumbia & Vallenato',
    bio: 'Master accordionist from Valledupar, Colombia',
    initials: 'RJ',
  },
  {
    name: 'Ana Gutierrez',
    specialty: 'Son Cubano & Rumba',
    bio: 'Percussion specialist trained at ENA Havana',
    initials: 'AG',
  },
]

export function InstructorGrid() {
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
            Learn From the Best
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            Our instructors are world-class musicians with decades of performance and teaching experience
          </p>
        </motion.div>

        {/* Instructors Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {instructors.map((instructor, index) => (
            <motion.div
              key={instructor.name}
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
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                        {instructor.initials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name & Specialty */}
                    <h3 className="text-lg font-semibold mb-1">{instructor.name}</h3>
                    <p className="text-sm text-primary font-medium mb-2">{instructor.specialty}</p>

                    {/* Bio */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {instructor.bio}
                    </p>
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
