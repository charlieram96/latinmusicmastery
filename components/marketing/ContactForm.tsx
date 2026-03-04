"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  subject: z.string().min(1, "Please select a subject."),
  message: z.string().min(10, "Message must be at least 10 characters."),
});

type ContactFormData = z.infer<typeof contactSchema>;

const subjectOptions = [
  "General Inquiry",
  "Technical Support",
  "Billing",
  "Partnership",
  "Feedback",
];

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  async function onSubmit(data: ContactFormData) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // Silently handle for now
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-bold">Message Sent!</h3>
        <p className="mt-2 text-muted-foreground">
          Thank you for reaching out. We will get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-2xl border bg-card p-8"
    >
      <h3 className="mb-6 text-xl font-bold">Send us a message</h3>

      {/* Name */}
      <div className="mb-5">
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium"
        >
          Name
        </label>
        <input
          id="name"
          type="text"
          placeholder="Your full name"
          className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          {...register("name")}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="mb-5">
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Subject */}
      <div className="mb-5">
        <label
          htmlFor="subject"
          className="mb-1.5 block text-sm font-medium"
        >
          Subject
        </label>
        <select
          id="subject"
          className="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          defaultValue=""
          {...register("subject")}
        >
          <option value="" disabled>
            Select a topic
          </option>
          {subjectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.subject && (
          <p className="mt-1 text-sm text-red-500">
            {errors.subject.message}
          </p>
        )}
      </div>

      {/* Message */}
      <div className="mb-6">
        <label
          htmlFor="message"
          className="mb-1.5 block text-sm font-medium"
        >
          Message
        </label>
        <textarea
          id="message"
          rows={5}
          placeholder="How can we help you?"
          className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          {...register("message")}
        />
        {errors.message && (
          <p className="mt-1 text-sm text-red-500">
            {errors.message.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full rounded-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send Message"
        )}
      </Button>
    </form>
  );
}
