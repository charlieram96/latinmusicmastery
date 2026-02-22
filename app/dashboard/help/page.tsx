import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  Search,
  Video,
  FileText,
} from 'lucide-react'

const faqs = [
  {
    question: 'How do I start a course?',
    answer: 'Browse our course catalog, select a course that interests you, and click "Start Course". You can track your progress through the My Courses page.',
  },
  {
    question: 'Can I download lesson materials?',
    answer: 'Yes! Premium members can download sheet music, backing tracks, and other lesson materials directly from each lesson page.',
  },
  {
    question: 'How does the progress tracking work?',
    answer: 'We automatically track your progress as you complete lessons and exercises. You can view detailed statistics on your My Progress page.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards and debit cards through our secure payment processor, Stripe.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time from the My Subscription page. You\'ll retain access until the end of your current billing period.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 14-day money-back guarantee for new subscriptions. If you\'re not satisfied, contact our support team within 14 days of purchase.',
  },
  {
    question: 'How often is new content added?',
    answer: 'We regularly add new courses, lessons, and exercises. Check back frequently or enable notifications to stay updated on new content.',
  },
  {
    question: 'Can I access courses on mobile devices?',
    answer: 'Yes! Our platform is fully responsive and works great on all devices including smartphones and tablets.',
  },
]

const resources = [
  {
    title: 'Getting Started Guide',
    description: 'Learn the basics and start your journey',
    icon: BookOpen,
    link: '#',
  },
  {
    title: 'Video Tutorials',
    description: 'Watch step-by-step platform tutorials',
    icon: Video,
    link: '#',
  },
  {
    title: 'Documentation',
    description: 'Detailed guides and references',
    icon: FileText,
    link: '#',
  },
]

export default function HelpPage() {
  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Help & Support</h1>
        <p className="text-muted-foreground">
          Find answers and get the help you need
        </p>
      </div>

      {/* Search */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for help..."
                className="pl-10"
              />
            </div>
            <Button>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Resources */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {resources.map((resource) => {
          const Icon = resource.icon
          return (
            <Card key={resource.title} className="hover:bg-secondary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{resource.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {resource.description}
                  </p>
                  <Button variant="link" size="sm" className="p-0 h-auto">
                    Learn more →
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQs */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>
            Quick answers to common questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Live Chat
            </CardTitle>
            <CardDescription>
              Chat with our support team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Get instant help from our support team during business hours.
            </p>
            <Button className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Support
            </CardTitle>
            <CardDescription>
              Send us a message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Send us an email and we'll get back to you within 24 hours.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:support@latinmusicmastery.com">
                Send Email
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
