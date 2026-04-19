"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TiptapReadOnly } from "@/components/class-viewer/tiptap-read-only";

interface InstructorBioModalProps {
  name: string;
  instrument: string;
  bio: unknown;
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

const bioStyles = [
  "text-sm leading-relaxed text-foreground/90",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1:first-child]:mt-0",
  "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2:first-child]:mt-0",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3:first-child]:mt-0",
  "[&_p]:mb-4 [&_p:last-child]:mb-0",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
  "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_blockquote]:mb-4 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs",
  "[&_hr]:my-6 [&_hr]:border-border/60",
  "[&_img]:my-4 [&_img]:rounded-lg [&_img]:max-w-full",
  "[&_iframe]:my-4 [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg",
].join(" ");

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
        <div className={`max-h-[60vh] overflow-y-auto px-6 py-6 ${bioStyles}`}>
          <TiptapReadOnly
            content={
              bio && typeof bio === "object"
                ? (bio as Record<string, unknown>)
                : null
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
