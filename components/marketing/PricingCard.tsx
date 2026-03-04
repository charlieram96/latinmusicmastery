"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  cta: { label: string; href: string };
  popular?: boolean;
  icon?: React.ReactNode;
}

export default function PricingCard({
  name,
  price,
  period = "/month",
  description,
  features,
  cta,
  popular = false,
  icon,
}: PricingCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative rounded-3xl border bg-card p-8 flex flex-col h-full",
        popular && "border-primary/50 shadow-lg shadow-primary/10"
      )}
    >
      {/* Popular gradient top bar */}
      {popular && (
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gradient-to-r from-primary via-orange-400 to-primary"
          aria-hidden="true"
        />
      )}

      {/* Icon + Plan name */}
      <div className="flex items-center gap-2">
        {icon && (
          <span className="text-primary" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {name}
        </span>
      </div>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-5xl font-bold">{price}</span>
        <span className="text-muted-foreground">{period}</span>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      )}

      {/* Feature list */}
      <ul className="mt-8 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <div className="mt-8">
        <Button
          asChild
          size="lg"
          variant={popular ? "default" : "outline"}
          className="w-full rounded-full"
        >
          <Link href={cta.href}>{cta.label}</Link>
        </Button>

        {popular && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            14-day money-back guarantee
          </p>
        )}
      </div>
    </motion.div>
  );
}
