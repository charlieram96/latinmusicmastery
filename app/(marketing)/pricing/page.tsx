import type { Metadata } from 'next'
import { Music, Crown, Check, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: 'Pricing - Latin Music Mastery',
  description: 'Simple, flexible pricing. Subscribe per instrument at $14.99/mo or get unlimited All-Access for $69.99/mo.',
}
import PageHero from "@/components/marketing/PageHero";
import SectionWrapper from "@/components/marketing/SectionWrapper";
import CTABanner from "@/components/marketing/CTABanner";
import GradientText from "@/components/marketing/GradientText";
import PricingCard from "@/components/marketing/PricingCard";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const plans = [
  {
    name: "Per Instrument",
    price: "$14.99",
    icon: <Music className="h-5 w-5" />,
    description:
      "Full access to all courses, lessons, and tools for a single instrument of your choice.",
    features: [
      "All courses for your instrument",
      "Interactive Soundslice integration",
      "Progress tracking dashboard",
      "PlaySense AI feedback",
      "New content added monthly",
      "Cancel anytime",
    ],
    cta: { label: "Choose Instrument", href: "/signup" },
    popular: false,
  },
  {
    name: "All-Access",
    price: "$69.99",
    icon: <Crown className="h-5 w-5" />,
    description:
      "Unlimited access to every instrument, every course, and every feature on the platform.",
    features: [
      "All 9 instruments included",
      "Every course and lesson",
      "Interactive Soundslice integration",
      "Progress tracking dashboard",
      "PlaySense AI feedback",
      "New content added monthly",
      "Cancel anytime",
    ],
    cta: { label: "Get All-Access", href: "/signup" },
    popular: true,
  },
] as const;

const comparisonRows = [
  { feature: "Number of instruments", perInstrument: "1", allAccess: "All 9" },
  { feature: "Video lessons", perInstrument: true, allAccess: true },
  { feature: "Interactive notation", perInstrument: true, allAccess: true },
  { feature: "Progress tracking", perInstrument: true, allAccess: true },
  { feature: "PlaySense AI", perInstrument: true, allAccess: true },
  { feature: "Downloadable resources", perInstrument: true, allAccess: true },
  { feature: "New monthly content", perInstrument: true, allAccess: true },
  { feature: "Priority support", perInstrument: false, allAccess: true },
] as const;

const instruments = [
  { name: "Guitar", emoji: "\uD83C\uDFB8" },
  { name: "Piano", emoji: "\uD83C\uDFB9" },
  { name: "Bass", emoji: "\uD83C\uDFB5" },
  { name: "Drums/Percussion", emoji: "\uD83E\uDD41" },
  { name: "Vocals", emoji: "\uD83C\uDFA4" },
  { name: "Trumpet", emoji: "\uD83C\uDFBA" },
  { name: "Saxophone", emoji: "\uD83C\uDFB7" },
  { name: "Violin", emoji: "\uD83C\uDFBB" },
  { name: "Cuatro", emoji: "\uD83C\uDFB6" },
];

const faqItems = [
  {
    question: "What's the difference between the plans?",
    answer:
      "The Per Instrument plan gives you full access to all courses, lessons, interactive notation, and AI feedback for one instrument of your choice. The All-Access plan includes everything across all 9 instruments on the platform, plus priority support. Both plans include full access to PlaySense AI, progress tracking, and all new content added each month.",
  },
  {
    question: "Can I switch instruments?",
    answer:
      "Yes, you can change your instrument selection at any time from your account settings. When you switch, you'll immediately get access to all content for your new instrument. Your progress on your previous instrument is saved, so if you switch back later, you can pick up right where you left off.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! You get a 14-day free trial when you sign up for any plan. During the trial you'll have full access to all features included in your chosen plan. If you decide it's not for you, simply cancel before the trial ends and you won't be charged.",
  },
  {
    question: "Can I upgrade later?",
    answer:
      "Absolutely. You can upgrade from the Per Instrument plan to All-Access at any time. When you upgrade, we'll prorate the remaining time on your current billing cycle so you only pay the difference. Your progress and saved content will carry over seamlessly.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express, Discover), PayPal, and Apple Pay. All payments are processed securely through Stripe. You can update your payment method at any time from your account settings.",
  },
];

function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="font-medium">{value}</span>;
  }
  return value ? (
    <Check className="mx-auto h-5 w-5 text-primary" />
  ) : (
    <Minus className="mx-auto h-5 w-5 text-muted-foreground/40" />
  );
}

export default function PricingPage() {
  return (
    <div data-marketing>
      <PageHero
        title="Pricing"
        subtitle="Choose the plan that fits your musical journey. No commitment, cancel anytime."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pricing" },
        ]}
      />

      {/* Pricing Cards */}
      <SectionWrapper className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              icon={plan.icon}
              description={plan.description}
              features={[...plan.features]}
              cta={{ ...plan.cta }}
              popular={plan.popular}
            />
          ))}
        </div>
      </SectionWrapper>

      {/* Comparison Table */}
      <SectionWrapper className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Compare <GradientText>Plans</GradientText>
        </h2>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-4 text-left font-medium text-muted-foreground">
                  Feature
                </th>
                <th className="pb-4 text-center font-medium text-muted-foreground">
                  Per Instrument
                </th>
                <th className="pb-4 text-center font-medium text-muted-foreground">
                  All-Access
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-b last:border-b-0">
                  <td className="py-4 font-medium">{row.feature}</td>
                  <td className="py-4 text-center">
                    <ComparisonCell value={row.perInstrument} />
                  </td>
                  <td className="py-4 text-center">
                    <ComparisonCell value={row.allAccess} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-4 md:hidden">
          {comparisonRows.map((row) => (
            <div
              key={row.feature}
              className="rounded-xl border bg-card p-4"
            >
              <p className="mb-3 font-medium">{row.feature}</p>
              <div className="flex justify-between text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs">Per Instrument</span>
                  <ComparisonCell value={row.perInstrument} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs">All-Access</span>
                  <ComparisonCell value={row.allAccess} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Instrument Grid */}
      <SectionWrapper className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-center text-3xl font-bold">
          9 <GradientText>Instruments</GradientText> Available
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          From guitar and piano to cuatro and beyond, master the instruments
          that define Latin American music.
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {instruments.map((instrument) => (
            <div
              key={instrument.name}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center transition-colors hover:border-primary/30"
            >
              <span className="text-3xl" role="img" aria-label={instrument.name}>
                {instrument.emoji}
              </span>
              <span className="text-sm font-medium">{instrument.name}</span>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">
          Frequently Asked <GradientText>Questions</GradientText>
        </h2>

        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SectionWrapper>

      {/* CTA */}
      <CTABanner
        title="Ready to Start Your Musical Journey?"
        subtitle="Join thousands of musicians mastering authentic Latin American music. Start your free trial today."
        primaryAction={{ label: "Get Started Free", href: "/signup" }}
        secondaryAction={{ label: "Explore Courses", href: "/explore" }}
      />
    </div>
  );
}
