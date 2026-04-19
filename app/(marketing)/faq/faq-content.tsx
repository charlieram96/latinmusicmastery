"use client";

import Link from "next/link";
import { HelpCircle, MessageCircle } from "lucide-react";
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
import { useTranslation } from "@/components/language-provider";

export default function FaqContent() {
  const { t } = useTranslation();

  const faqCategories = [
    {
      title: t("marketing.pages.faq.categories.gettingStarted.title"),
      icon: HelpCircle,
      questions: [
        {
          question: t("marketing.pages.faq.categories.gettingStarted.q.what.question"),
          answer: t("marketing.pages.faq.categories.gettingStarted.q.what.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.gettingStarted.q.experience.question"),
          answer: t("marketing.pages.faq.categories.gettingStarted.q.experience.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.gettingStarted.q.instruments.question"),
          answer: t("marketing.pages.faq.categories.gettingStarted.q.instruments.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.gettingStarted.q.lessons.question"),
          answer: t("marketing.pages.faq.categories.gettingStarted.q.lessons.answer"),
        },
      ],
    },
    {
      title: t("marketing.pages.faq.categories.billing.title"),
      icon: HelpCircle,
      questions: [
        {
          question: t("marketing.pages.faq.categories.billing.q.cost.question"),
          answer: t("marketing.pages.faq.categories.billing.q.cost.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.billing.q.trial.question"),
          answer: t("marketing.pages.faq.categories.billing.q.trial.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.billing.q.cancel.question"),
          answer: t("marketing.pages.faq.categories.billing.q.cancel.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.billing.q.payment.question"),
          answer: t("marketing.pages.faq.categories.billing.q.payment.answer"),
        },
      ],
    },
    {
      title: t("marketing.pages.faq.categories.features.title"),
      icon: HelpCircle,
      questions: [
        {
          question: t("marketing.pages.faq.categories.features.q.playsense.question"),
          answer: t("marketing.pages.faq.categories.features.q.playsense.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.features.q.download.question"),
          answer: t("marketing.pages.faq.categories.features.q.download.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.features.q.mobile.question"),
          answer: t("marketing.pages.faq.categories.features.q.mobile.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.features.q.certificate.question"),
          answer: t("marketing.pages.faq.categories.features.q.certificate.answer"),
        },
      ],
    },
    {
      title: t("marketing.pages.faq.categories.support.title"),
      icon: MessageCircle,
      questions: [
        {
          question: t("marketing.pages.faq.categories.support.q.contact.question"),
          answer: t("marketing.pages.faq.categories.support.q.contact.answer"),
        },
        {
          question: t("marketing.pages.faq.categories.support.q.requestContent.question"),
          answer: t("marketing.pages.faq.categories.support.q.requestContent.answer"),
        },
      ],
    },
  ];

  return (
    <div>
      <PageHero
        title={t("marketing.pages.faq.hero.title")}
        subtitle={t("marketing.pages.faq.hero.subtitle")}
        breadcrumbs={[
          { label: t("marketing.pages.faq.breadcrumbs.home"), href: "/" },
          { label: t("marketing.pages.faq.breadcrumbs.faq") },
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
            {t("marketing.pages.faq.contactCta.titlePrefix")}{" "}
            <GradientText>
              {t("marketing.pages.faq.contactCta.titleHighlight")}
            </GradientText>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("marketing.pages.faq.contactCta.description")}
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/contact">
                {t("marketing.pages.faq.contactCta.button")}
              </Link>
            </Button>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
