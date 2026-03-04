import type { Metadata } from 'next'
import Link from "next/link";
import { HelpCircle, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: 'FAQ - Latin Music Mastery',
  description: 'Find answers to common questions about Latin Music Mastery courses, subscriptions, and features.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import GradientText from "@/components/marketing/GradientText";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const faqCategories = [
  {
    title: "Getting Started",
    icon: HelpCircle,
    questions: [
      {
        question: "What is Latin Music Mastery?",
        answer:
          "Latin Music Mastery is a comprehensive online platform dedicated to teaching authentic Latin American music. We offer HD video lessons, interactive notation, AI-powered practice tools, and a supportive community -- all designed to help you master styles from salsa and bossa nova to cumbia, tango, and beyond.",
      },
      {
        question: "Do I need any prior musical experience?",
        answer:
          "Not at all! We have courses designed for every skill level, from absolute beginners who have never touched an instrument to advanced musicians looking to expand their repertoire. Each course clearly indicates the recommended skill level, so you can find the perfect starting point.",
      },
      {
        question: "What instruments are covered?",
        answer:
          "We currently offer courses for Guitar, Piano, Bass, Drums/Percussion, Vocals, Trumpet, Saxophone, Violin, and Cuatro. We are continually expanding our instrument coverage based on student demand.",
      },
      {
        question: "How do the lessons work?",
        answer:
          "Each course includes HD video lessons with synchronized notation that follows along as you watch. You will learn techniques, theory, and repertoire through a structured curriculum. Our PlaySense AI tool can listen to your playing and provide real-time feedback, helping you practice more effectively between lessons.",
      },
    ],
  },
  {
    title: "Subscription & Billing",
    icon: HelpCircle,
    questions: [
      {
        question: "How much does it cost?",
        answer:
          "We offer flexible pricing to fit your needs. The Per Instrument plan is $14.99/month and gives you full access to all courses for a single instrument. The All-Access plan is $69.99/month and unlocks every course, instrument, and feature on the platform -- perfect for multi-instrumentalists and curious learners.",
      },
      {
        question: "Is there a free trial?",
        answer:
          "Yes! You get a 14-day free trial with full access to the platform. No credit card is required to start. Experience everything Latin Music Mastery has to offer before committing to a subscription.",
      },
      {
        question: "Can I cancel anytime?",
        answer:
          "Absolutely. There are no long-term contracts or cancellation fees. You can cancel your subscription at any time from your account settings, and you will continue to have access until the end of your current billing period.",
      },
      {
        question: "What payment methods are accepted?",
        answer:
          "We accept all major credit cards (Visa, Mastercard, American Express, Discover) and PayPal. All payments are processed securely through Stripe.",
      },
    ],
  },
  {
    title: "Features",
    icon: HelpCircle,
    questions: [
      {
        question: "What is PlaySense?",
        answer:
          "PlaySense is our AI-powered practice tool that listens to your playing in real time through your device microphone. It provides instant feedback on pitch accuracy, rhythm, timing, and dynamics -- helping you identify areas for improvement and track your progress over time. Think of it as having a patient, always-available practice partner.",
      },
      {
        question: "Can I download lesson materials?",
        answer:
          "Yes! Sheet music, tablature, and backing tracks are all available for download with your subscription. You can practice offline and use the materials however you like for personal learning.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "Our platform is fully responsive and works great on mobile browsers, tablets, and desktops. A dedicated mobile app is on our roadmap for the future, but for now you can access all features through your mobile browser.",
      },
      {
        question: "Do I get a certificate?",
        answer:
          "We provide achievement badges and progress certificates as you complete courses and reach milestones. These are great for tracking your learning journey and sharing your accomplishments with others.",
      },
    ],
  },
  {
    title: "Support",
    icon: MessageCircle,
    questions: [
      {
        question: "How do I contact support?",
        answer:
          "Visit our contact page at /contact or email us directly at support@latinmusicmastery.com. Our support team typically responds within 24 hours.",
      },
      {
        question: "Can I request new content?",
        answer:
          "Absolutely! We love hearing from our community. You can submit content requests through our contact page or community forums. Many of our most popular courses have been created based on student suggestions.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div>
      <PageHero
        title="Frequently Asked Questions"
        subtitle="Find answers to common questions about Latin Music Mastery."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "FAQ" },
        ]}
      />

      {/* FAQ Sections */}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-12">
          {faqCategories.map((category) => (
            <SectionWrapper key={category.title}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">
                  <GradientText>{category.title}</GradientText>
                </h2>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {category.questions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`${category.title}-${index}`}
                  >
                    <AccordionTrigger className="text-left text-base font-medium">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </SectionWrapper>
          ))}
        </div>
      </div>

      {/* Contact CTA */}
      <SectionWrapper className="border-t bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Still have <GradientText>questions?</GradientText>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our team is here to help. Reach out and we will get back to you
            within 24 hours.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
