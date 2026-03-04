"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, Send } from "lucide-react";

interface NewsletterFormProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function NewsletterForm({
  title = "Stay in the Loop",
  subtitle = "Get the latest updates, new courses, and exclusive content.",
  className,
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section className={cn("rounded-2xl bg-muted/50 p-8", className)}>
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-bold">Thanks for subscribing!</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You will receive the latest updates and exclusive content in your
            inbox.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl bg-muted/50 p-8", className)}>
      <div className="mx-auto max-w-md text-center">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" className="shrink-0 rounded-full">
            <Send className="mr-2 h-4 w-4" />
            Subscribe
          </Button>
        </form>
      </div>
    </section>
  );
}
