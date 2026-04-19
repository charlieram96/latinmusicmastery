"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InstructorBioModalProps {
  name: string;
  instrument: string;
  bio: string;
  imageUrl?: string | null;
  specialties?: string[] | null;
  children: React.ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function InstructorBioModal({
  name,
  instrument,
  bio,
  imageUrl,
  specialties,
  children,
}: InstructorBioModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="flex flex-row items-center gap-4 border-b border-border/50 p-6 pr-12 text-left sm:text-left">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-card sm:size-20">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/30 via-orange-400/20 to-amber-500/30">
                <span className="text-xl font-bold text-primary/60">
                  {getInitials(name)}
                </span>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <DialogTitle className="text-xl font-semibold">{name}</DialogTitle>
            <DialogDescription className="text-primary">
              {instrument}
            </DialogDescription>
            {specialties && specialties.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-6 text-sm leading-relaxed text-foreground/90">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="mt-6 mb-3 text-2xl font-bold first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-6 mb-3 text-xl font-semibold first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-5 mb-2 text-lg font-semibold first:mt-0">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="mb-4 last:mb-0">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mb-4 list-disc space-y-1 pl-5 last:mb-0">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-4 list-decimal space-y-1 pl-5 last:mb-0">
                  {children}
                </ol>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">
                  {children}
                </strong>
              ),
              em: ({ children }) => <em className="italic">{children}</em>,
              blockquote: ({ children }) => (
                <blockquote className="mb-4 border-l-2 border-primary/60 pl-4 italic text-muted-foreground last:mb-0">
                  {children}
                </blockquote>
              ),
            }}
          >
            {bio}
          </ReactMarkdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
