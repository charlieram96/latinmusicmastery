import type { Metadata } from 'next'
import Link from "next/link";
import { Mail, Clock, Instagram, Youtube } from "lucide-react";

export const metadata: Metadata = {
  title: 'Contact Us - Latin Music Mastery',
  description: 'Get in touch with our team for questions, feedback, or partnership inquiries.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import GradientText from "@/components/marketing/GradientText";
import ContactForm from "@/components/marketing/ContactForm";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const contactInfo = [
  {
    icon: Mail,
    title: "Email",
    detail: "support@latinmusicmastery.com",
    href: "mailto:support@latinmusicmastery.com",
  },
  {
    icon: Clock,
    title: "Response Time",
    detail: "Within 24 hours",
  },
];

const commonFAQs = [
  {
    question: "How do I reset my password?",
    answer:
      "Click the 'Forgot Password' link on the login page and follow the instructions sent to your email.",
  },
  {
    question: "Can I switch my subscription plan?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time from your account settings. Changes take effect at the start of your next billing cycle.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "Go to your account settings, select 'Subscription', and click 'Cancel Plan'. You will retain access until the end of your current billing period.",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "Absolutely. All payments are processed through Stripe, a PCI-compliant payment processor. We never store your credit card information on our servers.",
  },
];

export default function ContactPage() {
  return (
    <div>
      <PageHero
        title="Contact Us"
        subtitle="We'd love to hear from you. Reach out with questions, feedback, or partnership inquiries."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Contact" },
        ]}
      />

      {/* Contact Form + Info */}
      <SectionWrapper className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Left: Contact Form */}
          <ContactForm />

          {/* Right: Contact Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Get in <GradientText>Touch</GradientText>
              </h2>
              <p className="mt-2 text-muted-foreground">
                Choose the best way to reach us. We are always happy to help.
              </p>
            </div>

            {/* Contact Info Cards */}
            {contactInfo.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-xl border bg-card p-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {item.detail}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Social Media Card */}
            <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Instagram className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Social Media</h3>
                <p className="text-sm text-muted-foreground">
                  Follow us for tips, updates, and community highlights.
                </p>
                <div className="mt-3 flex gap-3">
                  <a
                    href="https://instagram.com/latinmusicmastery"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Instagram className="h-3.5 w-3.5" />
                    Instagram
                  </a>
                  <a
                    href="https://youtube.com/@latinmusicmastery"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    YouTube
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* FAQ Preview */}
      <SectionWrapper className="border-t bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Common <GradientText>Questions</GradientText>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Quick answers to questions we hear most often.
            </p>
          </div>

          <div className="mt-8">
            <Accordion type="single" collapsible className="w-full">
              {commonFAQs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left text-base font-medium">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/faq">View All FAQs</Link>
            </Button>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
