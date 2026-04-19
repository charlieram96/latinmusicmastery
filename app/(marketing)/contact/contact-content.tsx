"use client";

import Link from "next/link";
import { Mail, Clock, Instagram, Youtube } from "lucide-react";
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
import { useTranslation } from "@/components/language-provider";

export default function ContactContent() {
  const { t } = useTranslation();

  const contactInfo = [
    {
      icon: Mail,
      title: t("marketing.pages.contact.info.email.title"),
      detail: "support@latinmusicmastery.com",
      href: "mailto:support@latinmusicmastery.com",
    },
    {
      icon: Clock,
      title: t("marketing.pages.contact.info.responseTime.title"),
      detail: t("marketing.pages.contact.info.responseTime.detail"),
    },
  ];

  const commonFAQs = [
    {
      question: t("marketing.pages.contact.faq.resetPassword.question"),
      answer: t("marketing.pages.contact.faq.resetPassword.answer"),
    },
    {
      question: t("marketing.pages.contact.faq.switchPlan.question"),
      answer: t("marketing.pages.contact.faq.switchPlan.answer"),
    },
    {
      question: t("marketing.pages.contact.faq.cancel.question"),
      answer: t("marketing.pages.contact.faq.cancel.answer"),
    },
    {
      question: t("marketing.pages.contact.faq.paymentSecurity.question"),
      answer: t("marketing.pages.contact.faq.paymentSecurity.answer"),
    },
  ];

  return (
    <div>
      <PageHero
        title={t("marketing.pages.contact.hero.title")}
        subtitle={t("marketing.pages.contact.hero.subtitle")}
        breadcrumbs={[
          { label: t("marketing.pages.contact.breadcrumbs.home"), href: "/" },
          { label: t("marketing.pages.contact.breadcrumbs.contact") },
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
                {t("marketing.pages.contact.getInTouch.titlePrefix")}{" "}
                <GradientText>
                  {t("marketing.pages.contact.getInTouch.titleHighlight")}
                </GradientText>
              </h2>
              <p className="mt-2 text-muted-foreground">
                {t("marketing.pages.contact.getInTouch.description")}
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
                <h3 className="font-semibold">
                  {t("marketing.pages.contact.social.title")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("marketing.pages.contact.social.description")}
                </p>
                <div className="mt-3 flex gap-3">
                  <a
                    href="https://instagram.com/latinmusicmastery"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Instagram className="h-3.5 w-3.5" />
                    {t("marketing.pages.contact.social.instagram")}
                  </a>
                  <a
                    href="https://youtube.com/@latinmusicmastery"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    {t("marketing.pages.contact.social.youtube")}
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
              {t("marketing.pages.contact.commonQuestions.titlePrefix")}{" "}
              <GradientText>
                {t("marketing.pages.contact.commonQuestions.titleHighlight")}
              </GradientText>
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("marketing.pages.contact.commonQuestions.description")}
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
              <Link href="/faq">
                {t("marketing.pages.contact.commonQuestions.viewAll")}
              </Link>
            </Button>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
